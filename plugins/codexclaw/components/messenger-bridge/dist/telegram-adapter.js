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

import { formatApprovalForTelegram,                      } from "./approval-relay.js";

import {
  TelegramApi,
  telegramReplyThreadId,
  telegramTopicId,



} from "./telegram-api.js";
import {
  findCommandDef,
  parseCommand,
  registerTelegramCommands,

} from "./telegram-commands.js";
import { handleCallback } from "./telegram-interactive.js";
import { cleanupTmpMedia, downloadTelegramMessageMedia } from "./media-handler.js";
import { sendFormattedTelegramOutput } from "./output-formatter.js";
import { createTelegramTurnProgress,                           } from "./telegram-progress.js";
import { probeRichSupport } from "./telegram-rich-send.js";
import { createToolProgressFilter, DEFAULT_TOOL_PROGRESS } from "./tool-progress.js";
import { createTelegramTurnLifecycleManager } from "./telegram-turn-lifecycle.js";
























const POLL_TIMEOUT_SEC = 50;
const MAX_409_RETRIES = 3;
const DELETE_CONFIRM_TTL_MS = 60_000;









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
  let paused = false;
  // /delete two-step confirmation: chatId -> pending expiry (epoch ms).
  const pendingDeletes = new Map                ();
  const deleteTtl = opts.deleteConfirmTtlMs ?? DELETE_CONFIRM_TTL_MS;
  const lifecycleManager = createTelegramTurnLifecycleManager({ api, log });
  const inFlightTurns = new Set               ();
  let cleanupPromise                       = null;

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
        if (!running) break;
        // At-most-once: advance + PERSIST offset BEFORE dispatch, so a crash
        // mid-turn never redelivers an already-started full-permission exec.
        offset = update.update_id + 1;
        persistOffset(offset);
        const turn = dispatch(update).catch((err) => log(`[tg] dispatch error: ${(err         ).message}`));
        inFlightTurns.add(turn);
        void turn.finally(() => inFlightTurns.delete(turn));
      }
    }
    state = state === "conflict" ? "conflict" : "stopped";
  }

  async function dispatch(update          )                {
    const msg = update.message;
    const cbq = update.callback_query;
    if (cbq) {
      await handleCallback(api, cbq, opts.db, {
        agentId,
        isAllowedChat,
        resolveApproval: (id, decision, chatId) =>
          opts.agentService.resolveApproval({ id, decision, chatId, agentId }),
      });
      log(`[tg] callback_query from ${cbq.from?.id}: ${cbq.data ?? ""}`);
      return;
    }
    if (!msg?.chat) return;
    const chatId = String(msg.chat.id);
    const rawText = msg.text ?? msg.caption ?? "";
    const parsed = parseCommand(rawText);

    if (parsed) {
      const def = findCommandDef(parsed.command);
      if (def) {
        if (!def.allowUnpaired && !isAllowedChat(chatId)) return;
        const attended = parsed.command === "retry" ? lifecycleManager.begin(msg) : null;
        try {
          const progress = attended ? turnProgress(msg, chatId) : null;
          await progress?.start();
          let result                      ;
          try {
            result = await def.handler({
              chatId,
              args: parsed.args,
              db: opts.db,
              agentService: opts.agentService,
              binding: null,
              agentId,
              workdir: opts.workdir,
              api,
              msg,
              pendingDeletes,
              deleteTtlMs: deleteTtl,
              isAllowedChat,
              isHandshakeOpen,
              admitChat,
              removeChat,
              setPaused: (next) => { paused = next; },
              onEvent: progress?.onEvent,
              log,
            });
          } finally {
            await progress?.finish();
          }
          await sendCommandResult(chatId, msg, result);
        } finally {
          await attended?.finish();
        }
        return;
      }
    }

    if (!isAllowedChat(chatId)) return; // silent ignore
    if (paused && !rawText.startsWith("/")) return;

    let mediaTempDirs           = [];
    try {
      let text = gateAndStripMention(msg, rawText);
      if (text === null) return;

      const media = await downloadMediaPrefixes(msg);
      mediaTempDirs = media.tempDirs;
      if (media.prefixes.length > 0) {
        text = [media.prefixes.join("\n"), text.trim()].filter(Boolean).join("\n");
      }
      if (!text.trim()) return;
      if (msg.reply_to_message?.text) {
        text = `[replying to: "${msg.reply_to_message.text.slice(0, 200)}"] ${text}`;
      }

      await runTurn(msg, chatId, text);
    } finally {
      await cleanupMediaTempDirs(mediaTempDirs);
    }
  }

  function removeChat(chatId        )       {
    if (agentId !== null) opts.db.removeAgentAllowlist(agentId, chatId);
    else opts.db.removeAllowlist("telegram", chatId);
  }

  async function sendCommandResult(
    chatId        ,
    msg           ,
    result                      ,
  )                {
    if (!result) return;
    const messageThreadId = telegramReplyThreadId(msg);
    if (result.keyboard) {
      await api.sendMessageWithKeyboard({
        chatId,
        text: result.text,
        parseMode: result.parseMode,
        messageThreadId,
        inlineKeyboard: result.keyboard,
      });
      return;
    }
    if (result.chunks && result.chunks.length > 0) {
      for (const chunk of result.chunks) {
        await api.sendMessage({
          chatId,
          text: chunk,
          parseMode: result.parseMode,
          messageThreadId,
        });
      }
      return;
    }
    await api.sendMessage({
      chatId,
      text: result.text,
      parseMode: result.parseMode,
      messageThreadId,
    });
  }

  function gateAndStripMention(msg           , rawText        )                {
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

  async function downloadMediaPrefixes(msg           )                                                      {
    return downloadTelegramMessageMedia(api, msg, log);
  }

  async function cleanupMediaTempDirs(dirs          )                {
    try {
      await cleanupTmpMedia(dirs);
    } catch (err) {
      log(`[tg] media cleanup failed: ${(err         ).message}`);
    }
  }

  async function runTurn(msg           , chatId        , text        )                {
    const lifecycle = lifecycleManager.begin(msg);
    const threadId = telegramReplyThreadId(msg);
    // plain mode: flatten all topics into a single per-chat binding (topicId=null).
    const rawTopicId = telegramTopicId(msg);
    const threadMode = agentId !== null ? (opts.db.getAgent(agentId)?.thread_mode ?? "thread") : "thread";
    const topicId = threadMode === "plain" ? null : rawTopicId;
    try {
      const progress = turnProgress(msg, chatId);
      await progress.start();
      let result;
      try {
        result = await opts.agentService.handleIncoming({
          kind: "telegram",
          chatId,
          text,
          workdir: opts.workdir,
          topicId,
          agentId: agentId ?? undefined,
          onApprovalRequest: (request) => sendApprovalRequest(chatId, threadId, request),
          onEvent: progress.onEvent,
        });
      } finally {
        await progress.finish();
      }

      if (result.ok && result.text) {
        await sendFormattedTelegramOutput({
          api,
          chatId,
          richSupported,
          chatType: msg.chat.type,
          messageThreadId: threadId,
          text: result.text,
        });
        log(`[tg] out ${chatId}: ${result.text.slice(0, 60)}`);
      } else {
        await api.sendMessage({
          chatId,
          text: `❌ ${result.error ?? "no response"}`,
          messageThreadId: threadId,
        });
      }
    } finally {
      await lifecycle.finish();
    }
  }

  function turnProgress(msg           , chatId        ) {
    const toolProgress = agentId === null
      ? DEFAULT_TOOL_PROGRESS
      : (opts.db.getAgent(agentId)?.tool_progress ?? DEFAULT_TOOL_PROGRESS);
    return createTelegramTurnProgress({
      api,
      chatId,
      chatType: msg.chat.type,
      richSupported,
      messageThreadId: telegramReplyThreadId(msg),
      draftId: msg.message_id,
      progressFilter: createToolProgressFilter(toolProgress),
      deps: opts.progressDeps,
      log,
    });
  }

  async function sendApprovalRequest(
    chatId        ,
    messageThreadId                    ,
    request                 ,
  )                {
    const formatted = formatApprovalForTelegram(request);
    const sent = await api.sendMessageWithKeyboard({
      chatId,
      text: formatted.text,
      messageThreadId,
      inlineKeyboard: formatted.keyboard,
    });
    if (sent.ok && sent.result?.message_id) {
      const messageId = sent.result.message_id;
      opts.agentService.registerApprovalCleanup(request.id, async () => {
        await api.editMessageReplyMarkup(chatId, messageId);
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
      await registerTelegramCommands(api);
      // Resume from the persisted offset. Cold start (offset 0) drops any
      // pending backlog so we never replay a pile of full-permission execs.
      const saved = savedOffset();
      offset = saved;
      await api.deleteWebhook(opts.deleteWebhookDropPending ?? saved === 0);
      log(`[tg] polling as @${username ?? "unknown"} (offset ${offset})`);
      void loop();
    },
    stop() {
      running = false;
      abort?.abort();
      cleanupPromise ??= lifecycleManager.cleanupAll();
      void cleanupPromise;
      // The AgentService is SHARED across adapters (v4 multi-agent): its
      // shutdown is owned by BridgeController.stop(), never by one adapter
      // (audit rev-2 fix #1 — stopping one agent must not kill the others'
      // in-flight codex children).
      if (state !== "conflict") state = "stopped";
    },
    async drain(timeoutMs = 3_000) {
      cleanupPromise ??= lifecycleManager.cleanupAll();
      await boundedDrain(inFlightTurns, cleanupPromise, timeoutMs);
    },
    status: () => state,
    botUsername: () => username,
  };
}

async function boundedDrain(turns                    , cleanup               , timeoutMs        )                {
  const settled = (async () => {
    while (turns.size > 0) await Promise.allSettled([...turns]);
    await cleanup;
  })();
  let timer                                           ;
  await Promise.race([settled, new Promise      ((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  })]);
  if (timer) clearTimeout(timer);
}
