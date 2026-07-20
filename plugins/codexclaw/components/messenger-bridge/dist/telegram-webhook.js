/**
 * telegram-webhook.ts — Telegram webhook ingress for named-agent bots.
 *
 * The HTTP response acknowledges update acceptance only. Long Codex turns run
 * after the 200 via AgentService's per-binding queue and send their result back
 * through the Bot API.
 */
import { timingSafeEqual } from "node:crypto";

import { formatApprovalForTelegram,                      } from "./approval-relay.js";


import { findCommandDef, parseCommand,                    } from "./telegram-commands.js";
import { handleCallback } from "./telegram-interactive.js";
import { TelegramApi, telegramReplyThreadId, telegramTopicId,                               } from "./telegram-api.js";
import { cleanupTmpMedia, downloadTelegramMessageMedia } from "./media-handler.js";
import { sendFormattedTelegramOutput } from "./output-formatter.js";
import { createTelegramTurnProgress,                           } from "./telegram-progress.js";
import { createToolProgressFilter, DEFAULT_TOOL_PROGRESS } from "./tool-progress.js";


















const WEBHOOK_PREFIX = "/webhook/telegram/";
const MAX_BODY_BYTES = 1_000_000;
const DELETE_CONFIRM_TTL_MS = 60_000;

export function createWebhookHandler(opts                        )                         {
  const log = opts.log ?? (() => {});
  const pendingDeletes = new Map                ();
  let paused = false;

  return async (req, res) => {
    const pathSecret = secretFromPath(new URL(req.url ?? "/", "http://localhost").pathname);
    const headerSecret = headerValue(req.headers["x-telegram-bot-api-secret-token"]);
    const validPath = safeEqual(pathSecret, opts.secretToken);
    const validHeader = safeEqual(headerSecret, opts.secretToken);
    if (!validPath || !validHeader) {
      sendJson(res, 403, { ok: false, error: "forbidden" });
      return;
    }

    let update          ;
    try {
      update = parseUpdate(await readJson(req));
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
      return;
    }

    const agent = opts.db.getAgent(opts.agentId);
    if (!agent) {
      sendJson(res, 404, { ok: false, error: "agent not found" });
      return;
    }

    if (update.update_id < agent.poll_offset) {
      sendJson(res, 200, { ok: true, duplicate: true });
      return;
    }
    opts.db.setAgentPollOffset(opts.agentId, update.update_id + 1);

    await acceptUpdate(update);
    sendJson(res, 200, { ok: true });
  };

  async function acceptUpdate(update          )                {
    if (update.callback_query) {
      void handleCallback(opts.api, update.callback_query, opts.db, {
        agentId: opts.agentId,
        isAllowedChat,
        resolveApproval: (id, decision, chatId) =>
          opts.agentService.resolveApproval({ id, decision, chatId, agentId: opts.agentId }),
      }).catch((err) => log(`[tg-webhook] callback error: ${(err         ).message}`));
      return;
    }
    if (update.message) {
      await acceptMessage(update.message);
    }
  }

  async function acceptMessage(msg           )                {
    const chatId = String(msg.chat.id);
    const rawText = msg.text ?? msg.caption ?? "";
    const parsed = parseCommand(rawText);
    // plain mode: flatten all topics into a single per-chat binding (topicId=null).
    const rawTopicId = telegramTopicId(msg);
    const agent = opts.db.getAgent(opts.agentId);
    const topicId = (agent?.thread_mode ?? "thread") === "plain" ? null : rawTopicId;
    const messageThreadId = telegramReplyThreadId(msg);
    const defaultWorkdir = opts.workdir ?? process.cwd();

    if (parsed) {
      const def = findCommandDef(parsed.command);
      if (!def) return;
      const allowed = isAllowedChat(chatId);
      if (!def.allowUnpaired && !allowed) return;
      const progress = parsed.command === "retry" ? turnProgress(msg, chatId) : null;
      const commandContext = {
        chatId,
        args: parsed.args,
        db: opts.db,
        agentService: opts.agentService,
        binding: allowed ? opts.db.getOrCreateAgentBinding(opts.agentId, "telegram", chatId, defaultWorkdir, topicId) : null,
        agentId: opts.agentId,
        workdir: defaultWorkdir,
        api: opts.api,
        msg,
        pendingDeletes,
        deleteTtlMs: opts.deleteConfirmTtlMs ?? DELETE_CONFIRM_TTL_MS,
        isAllowedChat,
        isHandshakeOpen,
        admitChat,
        removeChat,
        setPaused: (next         ) => {
          paused = next;
        },
        onEvent: progress?.onEvent,
        log,
      };
      if (!progress) {
        void def.handler(commandContext)
          .then((result) => sendCommandResult(chatId, msg, result))
          .catch((err) => log(`[tg-webhook] command error: ${(err         ).message}`));
        return;
      }
      void (async () => {
        await progress.start();
        let result                      ;
        try {
          result = await def.handler(commandContext);
        } finally {
          await progress.finish();
        }
        await sendCommandResult(chatId, msg, result);
      })().catch((err) => log(`[tg-webhook] command error: ${(err         ).message}`));
      return;
    }

    if (!isAllowedChat(chatId) || paused) return;
    const binding = opts.db.getOrCreateAgentBinding(opts.agentId, "telegram", chatId, defaultWorkdir, topicId);
    let text = gateAndStripMention(rawText, msg);
    if (text === null) return;
    const media = await downloadTelegramMessageMedia(opts.api, msg, log);
    text = [media.prefixes.join("\n"), text.trim()].filter(Boolean).join("\n");
    if (!text.trim()) {
      await cleanupTmpMedia(media.tempDirs);
      return;
    }

    const progress = turnProgress(msg, chatId);
    const progressStarted = progress.start();
    const enqueued = opts.agentService.enqueueIncoming({
      kind: "telegram",
      chatId,
      text,
      workdir: binding.workdir,
      topicId,
      agentId: opts.agentId,
      onApprovalRequest: (request) => sendApprovalRequest(chatId, messageThreadId, request),
      onEvent: progress.onEvent,
    });
    void enqueued.result
      .then(async (result) => {
        await progressStarted;
        await progress.finish();
        await sendTurnResult(chatId, msg, result);
      })
      .catch(async (err) => {
        await progressStarted;
        await progress.finish();
        log(`[tg-webhook] turn error: ${(err         ).message}`);
      })
      .finally(() => {
        void cleanupTmpMedia(media.tempDirs).catch((err) =>
          log(`[tg-webhook] media cleanup failed: ${(err         ).message}`),
        );
      });
  }

  function gateAndStripMention(rawText        , msg           )                {
    const agent = opts.db.getAgent(opts.agentId);
    const prefix = agent?.trigger_prefix;
    if (prefix && rawText.startsWith(prefix)) return rawText.slice(prefix.length).trim();

    if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
      const username = opts.botUsername ?? null;
      if ((agent?.mention_only ?? 1) === 1) {
        if (!username || !rawText.includes(`@${username}`)) return null;
      }
      return username ? rawText.replaceAll(`@${username}`, "").trim() : rawText.trim();
    }
    return rawText.trim();
  }

  function isAllowedChat(chatId        )          {
    return opts.db.isAgentAllowed(opts.agentId, chatId);
  }

  function isHandshakeOpen()          {
    return opts.db.isAgentHandshakeOpen(opts.agentId);
  }

  function admitChat(chatId        )       {
    opts.db.addAgentAllowlist(opts.agentId, chatId, "");
    opts.db.closeAgentHandshake(opts.agentId);
  }

  function removeChat(chatId        )       {
    opts.db.removeAgentAllowlist(opts.agentId, chatId);
  }

  async function sendCommandResult(
    chatId        ,
    msg           ,
    result                      ,
  )                {
    if (!result) return;
    if (result.keyboard) {
      await opts.api.sendMessageWithKeyboard({
        chatId,
        text: result.text,
        parseMode: result.parseMode,
        messageThreadId: telegramReplyThreadId(msg),
        inlineKeyboard: result.keyboard,
      });
      return;
    }
    if (result.chunks && result.chunks.length > 0) {
      for (const chunk of result.chunks) {
        await opts.api.sendMessage({
          chatId,
          text: chunk,
          parseMode: result.parseMode,
          messageThreadId: telegramReplyThreadId(msg),
        });
      }
      return;
    }
    await opts.api.sendMessage({
      chatId,
      text: result.text,
      parseMode: result.parseMode,
      messageThreadId: telegramReplyThreadId(msg),
    });
  }

  async function sendTurnResult(chatId        , msg           , result                )                {
    if (result.ok && result.text) {
      await sendFormattedTelegramOutput({
        api: opts.api,
        chatId,
        richSupported: opts.richSupported ?? true,
        chatType: msg.chat.type,
        messageThreadId: telegramReplyThreadId(msg),
        text: result.text,
      });
      return;
    }
    await opts.api.sendMessage({ chatId, text: `❌ ${result.error ?? "no response"}`, messageThreadId: telegramReplyThreadId(msg) });
  }

  function turnProgress(msg           , chatId        ) {
    const toolProgress = opts.db.getAgent(opts.agentId)?.tool_progress ?? DEFAULT_TOOL_PROGRESS;
    return createTelegramTurnProgress({
      api: opts.api,
      chatId,
      chatType: msg.chat.type,
      richSupported: opts.richSupported ?? true,
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
    const sent = await opts.api.sendMessageWithKeyboard({
      chatId,
      text: formatted.text,
      messageThreadId,
      inlineKeyboard: formatted.keyboard,
    });
    if (sent.ok && sent.result?.message_id) {
      const messageId = sent.result.message_id;
      opts.agentService.registerApprovalCleanup(request.id, async () => {
        await opts.api.editMessageReplyMarkup(chatId, messageId);
      });
    }
  }
}

export async function registerWebhook(api             , url        , secret        )                {
  const res = await api.setWebhook(url, secret);
  if (!res.ok) throw new Error(res.description ?? `setWebhook failed (${res.error_code ?? "unknown"})`);
}

export function telegramWebhookSecretFromUrl(url        )                {
  try {
    return secretFromPath(new URL(url).pathname) || null;
  } catch {
    return null;
  }
}

function secretFromPath(pathname        )         {
  if (!pathname.startsWith(WEBHOOK_PREFIX)) return "";
  const raw = pathname.slice(WEBHOOK_PREFIX.length).split("/", 1)[0] ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Length-guarded constant-time string compare (shared by server-side secret gates). */
export function safeEqual(actual        , expected        )          {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(actualBytes, expectedBytes);
}

function headerValue(value                               )         {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function readJson(req                 )                   {
  return new Promise((resolvePromise, rejectPromise) => {
    let raw = "";
    req.on("data", (chunk        ) => {
      raw += chunk.toString();
      if (raw.length > MAX_BODY_BYTES) {
        rejectPromise(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolvePromise(raw ? JSON.parse(raw) : null);
      } catch {
        rejectPromise(new Error("invalid JSON body"));
      }
    });
    req.on("error", rejectPromise);
  });
}

function parseUpdate(body         )           {
  const update = body                            ;
  if (!update || typeof update.update_id !== "number" || !Number.isInteger(update.update_id)) {
    throw new Error("invalid Telegram update");
  }
  return update            ;
}

function sendJson(res                , status        , body         )       {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}
