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
import { realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { TelegramApi, type FetchImpl, type TgMessage, type TgUpdate } from "./telegram-api.ts";
import { markdownToTelegramHtml, chunkTelegramMessage, stripTelegramHtml } from "./telegram-format.ts";
import { probeRichSupport, sendRichOrFallback } from "./telegram-rich-send.ts";

export interface TelegramAdapterOptions {
  db: BridgeDb;
  token: string;
  workdir: string;
  agentService: AgentService;
  /** When set, the adapter is scoped to this named agent (v4): per-agent poll
   *  offset, handshake, allowlist, mention gate, and bindings. Absent = legacy
   *  single-channel behavior, byte-identical to Phase 3. */
  agent?: { id: number };
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
  const agentId = opts.agent?.id ?? null;
  let offset = 0;
  let running = false;
  let state: AdapterStatus = "idle";
  let username: string | null = null;
  let botUserId: number | null = null;
  let richSupported = false;
  let conflictCount = 0;
  let abort: AbortController | null = null;
  let paused = false;

  // Agent-scoped vs legacy channel-scoped persistence/gating.
  const savedOffset = () =>
    agentId === null ? opts.db.getPollOffset("telegram") : (opts.db.getAgent(agentId)?.poll_offset ?? 0);
  const persistOffset = (o: number) =>
    agentId === null ? opts.db.setPollOffset("telegram", o) : opts.db.setAgentPollOffset(agentId, o);
  const isAllowedChat = (chatId: string) =>
    agentId === null ? opts.db.isAllowed("telegram", chatId) : opts.db.isAgentAllowed(agentId, chatId);
  const isHandshakeOpen = () =>
    agentId === null ? opts.db.isHandshakeOpen("telegram") : opts.db.isAgentHandshakeOpen(agentId);
  const admitChat = (chatId: string) => {
    if (agentId === null) {
      opts.db.addAllowlist("telegram", chatId, "");
      opts.db.closeHandshake("telegram");
    } else {
      opts.db.addAgentAllowlist(agentId, chatId, "");
      opts.db.closeAgentHandshake(agentId);
    }
  };
  /** Group mention requirement: legacy always requires; agents follow the live card toggle. */
  const mentionRequired = () =>
    agentId === null ? true : (opts.db.getAgent(agentId)?.mention_only ?? 1) === 1;

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
        persistOffset(offset);
        void dispatch(update).catch((err) => log(`[tg] dispatch error: ${(err as Error).message}`));
      }
    }
    state = state === "conflict" ? "conflict" : "stopped";
  }

  async function dispatch(update: TgUpdate): Promise<void> {
    const msg = update.message;
    const cbq = update.callback_query;
    if (cbq) {
      await api.answerCallbackQuery(cbq.id);
      log(`[tg] callback_query from ${cbq.from?.id}: ${cbq.data ?? ""}`);
      return;
    }
    if (!msg?.chat) return;
    const chatId = String(msg.chat.id);
    const rawText = msg.text ?? msg.caption ?? "";

    if (rawText.startsWith("/start")) return handleStart(chatId);
    if (rawText.startsWith("/id")) {
      await api.sendMessage({ chatId, text: `Chat ID: ${chatId}` });
      return;
    }

    if (!isAllowedChat(chatId)) return; // silent ignore
    if (paused && !rawText.startsWith("/")) return;

    if (rawText.startsWith("/kick")) {
      if (agentId !== null) opts.db.removeAgentAllowlist(agentId, chatId);
      else opts.db.removeAllowlist("telegram", chatId);
      await api.sendMessage({ chatId, text: "Chat removed from allowlist." });
      return;
    }
    if (rawText.startsWith("/pause")) {
      paused = true;
      await api.sendMessage({ chatId, text: "Paused — messages will be ignored until /resume." });
      return;
    }
    if (rawText.startsWith("/resume")) {
      paused = false;
      await api.sendMessage({ chatId, text: "Resumed — messages will be processed." });
      return;
    }
    if (rawText.startsWith("/status")) return handleStatus(chatId, msg);
    if (rawText.startsWith("/reset")) return handleReset(chatId, msg);
    if (rawText.startsWith("/cwd")) return handleCwd(chatId, msg, rawText);
    if (rawText.startsWith("/model")) return handleModel(chatId, msg, rawText);
    if (rawText.startsWith("/help")) return handleHelp(chatId, msg);
    if (rawText.startsWith("/context")) {
      await handleContext(chatId, msg);
      return;
    }

    let text = gateAndStripMention(msg, rawText);
    if (text === null || !text.trim()) return;
    if (msg.reply_to_message?.text) {
      text = `[replying to: "${msg.reply_to_message.text.slice(0, 200)}"] ${text}`;
    }

    await runTurn(msg, chatId, text);
  }

  async function handleStart(chatId: string): Promise<void> {
    if (isAllowedChat(chatId)) {
      await api.sendMessage({ chatId, text: "codexclaw: already connected ✅" });
      return;
    }
    if (isHandshakeOpen()) {
      // Close the window atomically on the first pair so a single open window
      // can't admit multiple chats (security review finding 2).
      admitChat(chatId);
      await api.sendMessage({ chatId, text: "codexclaw: connected ✅ send me a message." });
      log(`[tg] handshake paired chat ${chatId}`);
      return;
    }
    // No open window → silent (no "not allowed" oracle).
  }

  async function handleStatus(chatId: string, msg: TgMessage): Promise<void> {
    void msg;
    const binding =
      agentId !== null
        ? opts.db.getOrCreateAgentBinding(agentId, "telegram", chatId, opts.workdir)
        : opts.db.getOrCreateBinding("telegram", chatId, opts.workdir);
    const agent = agentId !== null ? opts.db.getAgent(agentId) : null;
    const statusText = [
      `thread_id: ${binding.thread_id ?? "none"}`,
      `model: ${agent?.model ?? binding.model}`,
      `status: ${binding.status}`,
      `agent: ${agent?.name ?? "none"}`,
    ].join("\n");
    await api.sendMessage({ chatId, text: statusText });
  }

  async function handleReset(chatId: string, msg: TgMessage): Promise<void> {
    void msg;
    const binding =
      agentId !== null
        ? opts.db.getOrCreateAgentBinding(agentId, "telegram", chatId, opts.workdir)
        : opts.db.getOrCreateBinding("telegram", chatId, opts.workdir);
    opts.db.clearBindingThread(binding.id);
    await api.sendMessage({ chatId, text: "Session reset — next message starts a fresh conversation." });
  }

  async function handleModel(chatId: string, msg: TgMessage, rawText: string): Promise<void> {
    void msg;
    if (agentId === null) {
      await api.sendMessage({ chatId, text: "/model is only available in agent mode" });
      return;
    }

    const modelName = rawText.trim().split(/\s+/).slice(1).join(" ").trim();
    if (!modelName) {
      const agent = opts.db.getAgent(agentId);
      await api.sendMessage({ chatId, text: `Current model: ${agent?.model ?? "default"}` });
      return;
    }

    opts.db.updateAgent(agentId, { model: modelName });
    await api.sendMessage({ chatId, text: `Model set to ${modelName}` });
  }

  /** /cwd — show or repoint this chat's exec working directory. Existing
   *  directories only (realpath-validated); never creates anything. */
  async function handleCwd(chatId: string, msg: TgMessage, rawText: string): Promise<void> {
    void msg;
    const binding =
      agentId !== null
        ? opts.db.getOrCreateAgentBinding(agentId, "telegram", chatId, opts.workdir)
        : opts.db.getOrCreateBinding("telegram", chatId, opts.workdir);

    const arg = rawText.trim().split(/\s+/).slice(1).join(" ").trim();
    if (!arg) {
      await api.sendMessage({ chatId, text: `Current workdir: ${binding.workdir || opts.workdir}` });
      return;
    }

    const expanded = arg === "~" ? homedir() : arg.startsWith("~/") ? homedir() + arg.slice(1) : arg;
    let real: string;
    try {
      real = realpathSync(resolve(expanded));
      if (!statSync(real).isDirectory()) throw new Error("not a directory");
    } catch {
      await api.sendMessage({ chatId, text: `Not a directory: ${arg}` });
      return;
    }

    opts.db.setBindingWorkdir(binding.id, real);
    opts.db.clearBindingThread(binding.id);
    await api.sendMessage({ chatId, text: `Workdir set: ${real} (session reset)` });
  }

  async function handleHelp(chatId: string, msg: TgMessage): Promise<void> {
    void msg;
    const helpText = [
      "Available commands:",
      "/start — Connect this chat",
      "/id — Show chat ID",
      "/status — Show session status",
      "/reset — Reset conversation session",
      "/cwd — Show or set working directory",
      "/model — Show or change AI model",
      "/help — List available commands",
    ].join("\n");
    await api.sendMessage({ chatId, text: helpText });
  }

  async function handleContext(chatId: string, msg: TgMessage): Promise<void> {
    void msg;
    const binding =
      agentId !== null
        ? opts.db.getOrCreateAgentBinding(agentId, "telegram", chatId, opts.workdir)
        : opts.db.getOrCreateBinding("telegram", chatId, opts.workdir);
    const jobs = opts.db.listJobs(binding.id, 5);
    if (jobs.length === 0) {
      await api.sendMessage({ chatId, text: "No conversation history yet." });
      return;
    }
    const summary = jobs
      .map((job) => `User: ${job.prompt_preview}\nAssistant: ${job.result_preview ?? ""}`)
      .join("\n\n");
    await api.sendMessage({ chatId, text: summary });
  }

  function gateAndStripMention(msg: TgMessage, rawText: string): string | null {
    const agent = agentId !== null ? opts.db.getAgent(agentId) : null;
    const prefix = agent?.trigger_prefix;
    if (prefix && rawText.startsWith(prefix)) {
      return rawText.slice(prefix.length).trim();
    }

    const chatType = msg.chat.type;
    if (chatType === "group" || chatType === "supergroup") {
      const hasMention = username ? rawText.includes(`@${username}`) : false;
      if (mentionRequired() && !hasMention) return null;
      // Strip the mention even when it is not required (audit rev-2 fix #5).
      return username ? rawText.replaceAll(`@${username}`, "").trim() : rawText.trim();
    }
    return rawText;
  }

  async function runTurn(msg: TgMessage, chatId: string, text: string): Promise<void> {
    const threadId = msg.message_thread_id;
    let typingTimer: ReturnType<typeof setInterval> | null = null;
    let statusMsgId: number | null = null;
    let statusCreating: Promise<void> | null = null;
    let lastStatusAt = 0;
    let lastTextEditAt = 0;
    let pendingStatus = "";
    const toolLines: string[] = [];

    const fireTyping = () => void api.sendChatAction(chatId, threadId);
    fireTyping();
    typingTimer = setInterval(fireTyping, TYPING_REFRESH_MS);

    const flushStatus = async (textOverride?: string) => {
      const now = Date.now();
      if (textOverride === undefined) {
        if (now - lastStatusAt < STATUS_COALESCE_MS) return;
        lastStatusAt = now;
      }
      const label = textOverride ?? pendingStatus;
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
      if (event.kind === "message") {
        const now = Date.now();
        if (now - lastTextEditAt < 2_000) return;
        lastTextEditAt = now;
        void flushStatus(event.text.slice(0, 4000));
      }
    };

    const result = await opts.agentService.handleIncoming({
      kind: "telegram",
      chatId,
      text,
      workdir: opts.workdir,
      agentId: agentId ?? undefined,
      onEvent,
    });

    if (typingTimer) clearInterval(typingTimer);
    await statusCreating;
    if (statusMsgId !== null) void api.deleteMessage(chatId, statusMsgId);

    if (result.ok && result.text) {
      await sendRichOrFallback(
        {
          api,
          chatId,
          richSupported,
          chatType: msg.chat.type,
          messageThreadId: threadId,
        },
        result.text,
      );
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
      botUserId = me.ok ? (me.result?.id ?? null) : null;
      // Probe Bot API 10.1 rich message support (fail closed → legacy HTML).
      if (botUserId !== null) {
        richSupported = await probeRichSupport(api, botUserId);
        log(`[tg] rich message support: ${richSupported ? "yes" : "no (legacy HTML)"}`);
      }
      await api.setMyCommands([
        { command: "start", description: "Connect this chat" },
        { command: "id", description: "Show chat ID" },
        { command: "status", description: "Show session status" },
        { command: "context", description: "Show recent conversation history" },
        { command: "reset", description: "Reset conversation session" },
        { command: "cwd", description: "Show or set working directory" },
        { command: "pause", description: "Pause message processing" },
        { command: "resume", description: "Resume message processing" },
        { command: "kick", description: "Remove this chat from allowlist" },
        { command: "model", description: "Show or change AI model" },
        { command: "help", description: "List available commands" },
      ]);
      // Resume from the persisted offset. Cold start (offset 0) drops any
      // pending backlog so we never replay a pile of full-permission execs.
      const saved = savedOffset();
      offset = saved;
      await api.deleteWebhook(saved === 0);
      log(`[tg] polling as @${username ?? "unknown"} (offset ${offset})`);
      void loop();
    },
    stop() {
      running = false;
      abort?.abort();
      // The AgentService is SHARED across adapters (v4 multi-agent): its
      // shutdown is owned by BridgeController.stop(), never by one adapter
      // (audit rev-2 fix #1 — stopping one agent must not kill the others'
      // in-flight codex children).
      if (state !== "conflict") state = "stopped";
    },
    status: () => state,
    botUsername: () => username,
  };
}
