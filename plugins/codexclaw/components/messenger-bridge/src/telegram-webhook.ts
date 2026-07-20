/**
 * telegram-webhook.ts — Telegram webhook ingress for named-agent bots.
 *
 * The HTTP response acknowledges update acceptance only. Long Codex turns run
 * after the 200 via AgentService's per-binding queue and send their result back
 * through the Bot API.
 */
import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { formatApprovalForTelegram, type ApprovalRequest } from "./approval-relay.ts";
import type { AgentService, IncomingResult } from "./agent-service.ts";
import type { BridgeDb } from "./db.ts";
import { findCommandDef, parseCommand, type CommandResult } from "./telegram-commands.ts";
import { handleCallback } from "./telegram-interactive.ts";
import { TelegramApi, telegramReplyThreadId, telegramTopicId, type TgMessage, type TgUpdate } from "./telegram-api.ts";
import { cleanupTmpMedia, downloadTelegramMessageMedia } from "./media-handler.ts";
import { sendFormattedTelegramOutput } from "./output-formatter.ts";
import { createTelegramTurnProgress, type TelegramProgressDeps } from "./telegram-progress.ts";
import { createToolProgressFilter, DEFAULT_TOOL_PROGRESS } from "./tool-progress.ts";
import { createTelegramTurnLifecycleManager } from "./telegram-turn-lifecycle.ts";

export interface TelegramWebhookOptions {
  api: TelegramApi;
  db: BridgeDb;
  agentService: AgentService;
  secretToken: string;
  agentId: number;
  workdir?: string;
  botUsername?: string | null;
  richSupported?: boolean;
  log?: (line: string) => void;
  deleteConfirmTtlMs?: number;
  /** Deterministic clock/timer seam for attended-turn progress. */
  progressDeps?: TelegramProgressDeps;
}

export type TelegramWebhookHandler = ((req: IncomingMessage, res: ServerResponse) => Promise<void>) & {
  cleanup(): Promise<void>;
};

const WEBHOOK_PREFIX = "/webhook/telegram/";
const MAX_BODY_BYTES = 1_000_000;
const DELETE_CONFIRM_TTL_MS = 60_000;

export function createWebhookHandler(opts: TelegramWebhookOptions): TelegramWebhookHandler {
  const log = opts.log ?? (() => {});
  const pendingDeletes = new Map<string, number>();
  const lifecycleManager = createTelegramTurnLifecycleManager({ api: opts.api, log });
  const inFlightTurns = new Set<Promise<void>>();
  let paused = false;
  let accepting = true;
  let cleanupPromise: Promise<void> | null = null;

  function launch(turn: Promise<void>, label: string): void {
    const tracked = turn.catch((err) => log(`[tg-webhook] ${label} error: ${(err as Error).message}`));
    inFlightTurns.add(tracked);
    void tracked.finally(() => inFlightTurns.delete(tracked));
  }

  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    if (!accepting) {
      sendJson(res, 503, { ok: false, error: "shutting down" });
      return;
    }
    const pathSecret = secretFromPath(new URL(req.url ?? "/", "http://localhost").pathname);
    const headerSecret = headerValue(req.headers["x-telegram-bot-api-secret-token"]);
    const validPath = safeEqual(pathSecret, opts.secretToken);
    const validHeader = safeEqual(headerSecret, opts.secretToken);
    if (!validPath || !validHeader) {
      sendJson(res, 403, { ok: false, error: "forbidden" });
      return;
    }

    let update: TgUpdate;
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
  handler.cleanup = async () => {
    accepting = false;
    cleanupPromise ??= (async () => {
      await lifecycleManager.cleanupAll();
      while (inFlightTurns.size > 0) await Promise.allSettled([...inFlightTurns]);
    })();
    await cleanupPromise;
  };
  return handler;

  async function acceptUpdate(update: TgUpdate): Promise<void> {
    if (update.callback_query) {
      void handleCallback(opts.api, update.callback_query, opts.db, {
        agentId: opts.agentId,
        isAllowedChat,
        resolveApproval: (id, decision, chatId) =>
          opts.agentService.resolveApproval({ id, decision, chatId, agentId: opts.agentId }),
      }).catch((err) => log(`[tg-webhook] callback error: ${(err as Error).message}`));
      return;
    }
    if (update.message) {
      await acceptMessage(update.message);
    }
  }

  async function acceptMessage(msg: TgMessage): Promise<void> {
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
      const attended = parsed.command === "retry" ? lifecycleManager.begin(msg) : null;
      const progress = attended ? turnProgress(msg, chatId) : null;
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
        setPaused: (next: boolean) => {
          paused = next;
        },
        onEvent: progress?.onEvent,
        log,
      };
      if (!progress) {
        launch(def.handler(commandContext)
          .then((result) => sendCommandResult(chatId, msg, result))
          , "command");
        return;
      }
      launch((async () => {
        try {
          await progress.start();
          let result: CommandResult | null;
          try {
            result = await def.handler(commandContext);
          } finally {
            await progress.finish();
          }
          await sendCommandResult(chatId, msg, result);
        } finally {
          await attended?.finish();
        }
      })(), "command");
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
    const lifecycle = lifecycleManager.begin(msg);
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
    launch(enqueued.result
      .then(async (result) => {
        await progressStarted;
        await progress.finish();
        await sendTurnResult(chatId, msg, result);
      })
      .catch(async (err) => {
        await progressStarted;
        await progress.finish();
        log(`[tg-webhook] turn error: ${(err as Error).message}`);
      })
      .finally(async () => {
        try {
          await cleanupTmpMedia(media.tempDirs);
        } catch (err) {
          log(`[tg-webhook] media cleanup failed: ${(err as Error).message}`);
        } finally {
          await lifecycle.finish();
        }
      }), "turn");
  }

  function gateAndStripMention(rawText: string, msg: TgMessage): string | null {
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

  function isAllowedChat(chatId: string): boolean {
    return opts.db.isAgentAllowed(opts.agentId, chatId);
  }

  function isHandshakeOpen(): boolean {
    return opts.db.isAgentHandshakeOpen(opts.agentId);
  }

  function admitChat(chatId: string): void {
    opts.db.addAgentAllowlist(opts.agentId, chatId, "");
    opts.db.closeAgentHandshake(opts.agentId);
  }

  function removeChat(chatId: string): void {
    opts.db.removeAgentAllowlist(opts.agentId, chatId);
  }

  async function sendCommandResult(
    chatId: string,
    msg: TgMessage,
    result: CommandResult | null,
  ): Promise<void> {
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

  async function sendTurnResult(chatId: string, msg: TgMessage, result: IncomingResult): Promise<void> {
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

  function turnProgress(msg: TgMessage, chatId: string) {
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
    chatId: string,
    messageThreadId: number | undefined,
    request: ApprovalRequest,
  ): Promise<void> {
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

export async function registerWebhook(api: TelegramApi, url: string, secret: string): Promise<void> {
  const res = await api.setWebhook(url, secret);
  if (!res.ok) throw new Error(res.description ?? `setWebhook failed (${res.error_code ?? "unknown"})`);
}

export function telegramWebhookSecretFromUrl(url: string): string | null {
  try {
    return secretFromPath(new URL(url).pathname) || null;
  } catch {
    return null;
  }
}

function secretFromPath(pathname: string): string {
  if (!pathname.startsWith(WEBHOOK_PREFIX)) return "";
  const raw = pathname.slice(WEBHOOK_PREFIX.length).split("/", 1)[0] ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Length-guarded constant-time string compare (shared by server-side secret gates). */
export function safeEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(actualBytes, expectedBytes);
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, rejectPromise) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => {
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

function parseUpdate(body: unknown): TgUpdate {
  const update = body as Partial<TgUpdate> | null;
  if (!update || typeof update.update_id !== "number" || !Number.isInteger(update.update_id)) {
    throw new Error("invalid Telegram update");
  }
  return update as TgUpdate;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}
