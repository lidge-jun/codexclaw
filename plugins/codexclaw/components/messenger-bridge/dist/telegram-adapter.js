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



import { TelegramApi,                                               } from "./telegram-api.js";
import { markdownToTelegramHtml, chunkTelegramMessage, stripTelegramHtml } from "./telegram-format.js";
import { probeRichSupport, sendRichOrFallback } from "./telegram-rich-send.js";


















const POLL_TIMEOUT_SEC = 50;
const MAX_409_RETRIES = 3;
const TYPING_REFRESH_MS = 4_000;
const STATUS_COALESCE_MS = 1_500;








export function createTelegramAdapter(opts                        )                  {
  const api = new TelegramApi(opts.token, opts.fetchImpl);
  const log = opts.log ?? (() => {});
  const pollTimeout = opts.pollTimeoutSec ?? POLL_TIMEOUT_SEC;
  const agentId = opts.agent?.id ?? null;
  let offset = 0;
  let running = false;
  let state                = "idle";
  let username                = null;
  let botUserId                = null;
  let richSupported = false;
  let conflictCount = 0;
  let abort                         = null;

  // Agent-scoped vs legacy channel-scoped persistence/gating.
  const savedOffset = () =>
    agentId === null ? opts.db.getPollOffset("telegram") : (opts.db.getAgent(agentId)?.poll_offset ?? 0);
  const persistOffset = (o        ) =>
    agentId === null ? opts.db.setPollOffset("telegram", o) : opts.db.setAgentPollOffset(agentId, o);
  const isAllowedChat = (chatId        ) =>
    agentId === null ? opts.db.isAllowed("telegram", chatId) : opts.db.isAgentAllowed(agentId, chatId);
  const isHandshakeOpen = () =>
    agentId === null ? opts.db.isHandshakeOpen("telegram") : opts.db.isAgentHandshakeOpen(agentId);
  const admitChat = (chatId        ) => {
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

  async function loop()                {
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
        void dispatch(update).catch((err) => log(`[tg] dispatch error: ${(err         ).message}`));
      }
    }
    state = state === "conflict" ? "conflict" : "stopped";
  }

  async function dispatch(update          )                {
    const msg = update.message;
    if (!msg?.chat) return;
    const chatId = String(msg.chat.id);
    const rawText = msg.text ?? msg.caption ?? "";

    if (rawText.startsWith("/start")) return handleStart(chatId);
    if (rawText.startsWith("/id")) {
      await api.sendMessage({ chatId, text: `Chat ID: ${chatId}` });
      return;
    }

    if (!isAllowedChat(chatId)) return; // silent ignore

    const text = gateAndStripMention(msg, rawText);
    if (text === null || !text.trim()) return;

    await runTurn(msg, chatId, text);
  }

  async function handleStart(chatId        )                {
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

  function gateAndStripMention(msg           , rawText        )                {
    const chatType = msg.chat.type;
    if (chatType === "group" || chatType === "supergroup") {
      const hasMention = username ? rawText.includes(`@${username}`) : false;
      if (mentionRequired() && !hasMention) return null;
      // Strip the mention even when it is not required (audit rev-2 fix #5).
      return username ? rawText.replaceAll(`@${username}`, "").trim() : rawText.trim();
    }
    return rawText;
  }

  async function runTurn(msg           , chatId        , text        )                {
    const threadId = msg.message_thread_id;
    let typingTimer                                        = null;
    let statusMsgId                = null;
    let statusCreating                       = null;
    let lastStatusAt = 0;
    let pendingStatus = "";
    const toolLines           = [];

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

    const onEvent = (event             ) => {
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

  function sleep(ms        )                {
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
