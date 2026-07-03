/**
 * telegram-adapter.ts — long-poll Telegram bridge (Phase 3).
 *
 * Polls getUpdates, gates each message (allowlist → group @mention → non-empty),
 * runs it through the Phase 2 AgentService, and renders the turn: typing action,
 * a single status message edited from RunnerEvents, then the chunked final
 * answer. /start pairs a chat when a handshake window is open. Offset is
 * acknowledged BEFORE dispatch (at-most-once) so a crashed full-permission turn
 * is never replayed. 409 (another poller) backs off and eventually stops.
 */
import type { BridgeDb } from "./db.ts";
import type { AgentService } from "./agent-service.ts";
import type { RunnerEvent } from "./runner.ts";
import { TelegramApi, type FetchImpl, type TgMessage, type TgUpdate } from "./telegram-api.ts";
import { markdownToTelegramHtml, chunkTelegramMessage, stripTelegramHtml } from "./telegram-format.ts";

export interface TelegramAdapterOptions {
  db: BridgeDb;
  token: string;
  workdir: string;
  agentService: AgentService;
  fetchImpl?: FetchImpl;
  log?: (line: string) => void;
  pollTimeoutSec?: number;
  handshakeSeconds?: number;
}

type AdapterStatus = "idle" | "running" | "conflict" | "stopped";

const POLL_TIMEOUT_SEC = 50;
const MAX_409_RETRIES = 3;
const TYPING_REFRESH_MS = 4_000;
const STATUS_COALESCE_MS = 1_500;

export interface TelegramAdapter {
  start: () => Promise<void>;
  stop: () => void;
  status: () => AdapterStatus;
  botUsername: () => string | null;
}

export function createTelegramAdapter(opts: TelegramAdapterOptions): TelegramAdapter {
  const api = new TelegramApi(opts.token, opts.fetchImpl);
  const log = opts.log ?? (() => {});
  const pollTimeout = opts.pollTimeoutSec ?? POLL_TIMEOUT_SEC;
  let offset = 0;
  let running = false;
  let state: AdapterStatus = "idle";
  let username: string | null = null;
  let conflictCount = 0;
  let abort: AbortController | null = null;

  async function loop(): Promise<void> {
    while (running) {
      abort = new AbortController();
      const res = await api.getUpdates(offset, pollTimeout, abort.signal);
      if (!running) break;

      if (!res.ok) {
        if (res.error_code === 409) {
          conflictCount += 1;
          if (conflictCount > MAX_409_RETRIES) {
            state = "conflict";
            log(`[tg] 409 conflict — gave up after ${MAX_409_RETRIES} retries`);
            running = false;
            break;
          }
          const delay = Math.min(5000 * 2 ** (conflictCount - 1), 30_000);
          log(`[tg] 409 conflict — retry ${conflictCount}/${MAX_409_RETRIES} in ${delay / 1000}s`);
          await sleep(delay);
          continue;
        }
        // Transient network/other error — brief backoff, keep the loop alive.
        if (res.description && !/aborted/i.test(res.description)) {
          log(`[tg] getUpdates failed: ${res.description}`);
          await sleep(2000);
        }
        continue;
      }

      conflictCount = 0;
      const updates = res.result ?? [];
      for (const update of updates) {
        // At-most-once: advance + PERSIST offset BEFORE dispatch, so a crash
        // mid-turn never redelivers an already-started full-permission exec.
        offset = update.update_id + 1;
        opts.db.setPollOffset("telegram", offset);
        void dispatch(update).catch((err) => log(`[tg] dispatch error: ${(err as Error).message}`));
      }
    }
    state = state === "conflict" ? "conflict" : "stopped";
  }

  async function dispatch(update: TgUpdate): Promise<void> {
    const msg = update.message;
    if (!msg?.chat) return;
    const chatId = String(msg.chat.id);
    const rawText = msg.text ?? msg.caption ?? "";

    if (rawText.startsWith("/start")) return handleStart(chatId);
    if (rawText.startsWith("/id")) {
      await api.sendMessage({ chatId, text: `Chat ID: ${chatId}` });
      return;
    }

    if (!opts.db.isAllowed("telegram", chatId)) return; // silent ignore

    const text = gateAndStripMention(msg, rawText);
    if (text === null || !text.trim()) return;

    await runTurn(msg, chatId, text);
  }

  async function handleStart(chatId: string): Promise<void> {
    if (opts.db.isAllowed("telegram", chatId)) {
      await api.sendMessage({ chatId, text: "codexclaw: already connected ✅" });
      return;
    }
    if (opts.db.isHandshakeOpen("telegram")) {
      opts.db.addAllowlist("telegram", chatId, "");
      // Close the window atomically on the first pair so a single open window
      // can't admit multiple chats (security review finding 2).
      opts.db.closeHandshake("telegram");
      await api.sendMessage({ chatId, text: "codexclaw: connected ✅ send me a message." });
      log(`[tg] handshake paired chat ${chatId}`);
      return;
    }
    // No open window → silent (no "not allowed" oracle).
  }

  function gateAndStripMention(msg: TgMessage, rawText: string): string | null {
    const chatType = msg.chat.type;
    if (chatType === "group" || chatType === "supergroup") {
      if (!username || !rawText.includes(`@${username}`)) return null;
      return rawText.replaceAll(`@${username}`, "").trim();
    }
    return rawText;
  }

  async function runTurn(msg: TgMessage, chatId: string, text: string): Promise<void> {
    const threadId = msg.message_thread_id;
    let typingTimer: ReturnType<typeof setInterval> | null = null;
    let statusMsgId: number | null = null;
    let statusCreating: Promise<void> | null = null;
    let lastStatusAt = 0;
    let pendingStatus = "";
    const toolLines: string[] = [];

    const fireTyping = () => void api.sendChatAction(chatId, threadId);
    fireTyping();
    typingTimer = setInterval(fireTyping, TYPING_REFRESH_MS);

    const flushStatus = async () => {
      const now = Date.now();
      if (now - lastStatusAt < STATUS_COALESCE_MS) return;
      lastStatusAt = now;
      const label = pendingStatus;
      if (!label) return;
      if (statusMsgId === null) {
        if (!statusCreating) {
          statusCreating = api
            .sendMessage({ chatId, text: `🔄 ${label}`, messageThreadId: threadId })
            .then((r) => {
              if (r.ok && r.result) statusMsgId = r.result.message_id;
            })
            .finally(() => {
              statusCreating = null;
            });
        }
        await statusCreating;
      } else {
        await api.editMessageText(chatId, statusMsgId, `🔄 ${label}`);
      }
    };

    const onEvent = (event: RunnerEvent) => {
      if (event.kind === "status") {
        if (toolLines[toolLines.length - 1] !== event.label) toolLines.push(event.label);
        pendingStatus = toolLines.slice(-5).join("\n");
        void flushStatus();
      }
    };

    const result = await opts.agentService.handleIncoming({
      kind: "telegram",
      chatId,
      text,
      workdir: opts.workdir,
      onEvent,
    });

    if (typingTimer) clearInterval(typingTimer);
    await statusCreating;
    if (statusMsgId !== null) void api.deleteMessage(chatId, statusMsgId);

    if (result.ok && result.text) {
      const html = markdownToTelegramHtml(result.text);
      for (const chunk of chunkTelegramMessage(html)) {
        const sent = await api.sendMessage({
          chatId,
          text: chunk,
          parseMode: "HTML",
          messageThreadId: threadId,
        });
        if (!sent.ok) {
          await api.sendMessage({ chatId, text: stripTelegramHtml(chunk), messageThreadId: threadId });
        }
      }
      log(`[tg] out ${chatId}: ${result.text.slice(0, 60)}`);
    } else {
      await api.sendMessage({
        chatId,
        text: `❌ ${result.error ?? "no response"}`,
        messageThreadId: threadId,
      });
    }
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      t.unref?.();
    });
  }

  return {
    async start() {
      if (running) return;
      running = true;
      state = "running";
      conflictCount = 0;
      const me = await api.getMe();
      username = me.ok ? (me.result?.username ?? null) : null;
      // Resume from the persisted offset. Cold start (offset 0) drops any
      // pending backlog so we never replay a pile of full-permission execs.
      const saved = opts.db.getPollOffset("telegram");
      offset = saved;
      await api.deleteWebhook(saved === 0);
      log(`[tg] polling as @${username ?? "unknown"} (offset ${offset})`);
      void loop();
    },
    stop() {
      running = false;
      abort?.abort();
      opts.agentService.shutdown();
      if (state !== "conflict") state = "stopped";
    },
    status: () => state,
    botUsername: () => username,
  };
}
