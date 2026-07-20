/**
 * telegram-commands.ts — Telegram command registry and handlers.
 *
 * The adapter owns polling/gating; this module owns bridge command behavior so
 * the Telegram command menu and dispatch table cannot drift.
 */
import { createHash } from "node:crypto";
import { formatApprovalForTelegram,                      } from "./approval-relay.js";

import {                                } from "./db.js";
import {
  buildHelpEntries,
  GATEWAY_COMMANDS,
  dispatchGatewayCommand,


} from "./gateway-commands.js";
import { telegramReplyThreadId, telegramTopicId,                                  } from "./telegram-api.js";
import {
  buildEffortPicker,
  buildModePicker,
  buildModelPicker,
  buildToolProgressPicker,
  loadModelCatalog,
} from "./telegram-interactive.js";
import { chunkTelegramMessage, escapeHtmlTg } from "./telegram-format.js";








































const GATEWAY_COMMANDS_SET = new Set(GATEWAY_COMMANDS.map((c) => c.name));
export function parseCommand(text        )                                           {
  const match = /^\/([A-Za-z0-9_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/.exec(text.trimStart());
  if (!match) return null;
  return { command: match[1].toLowerCase(), args: (match[2] ?? "").trim() };
}

export function buildCommandDefs()               {
  return [
    { name: "start", description: "Connect this chat", handler: handleStart, allowUnpaired: true },
    { name: "id", description: "Show chat ID", handler: handleId, allowUnpaired: true },
    { name: "status", description: "Show session status", handler: (ctx) => handleGateway(ctx, "status") },
    { name: "sessions", description: "List sessions for this chat", handler: (ctx) => handleGateway(ctx, "sessions") },
    { name: "jobs", description: "List recent jobs for this session", handler: (ctx) => handleGateway(ctx, "jobs") },
    { name: "agent", description: "Show this named agent's settings", handler: (ctx) => handleGateway(ctx, "agent") },
    { name: "context", description: "Show recent conversation history", handler: (ctx) => handleGateway(ctx, "context") },
    { name: "new", description: "Start a fresh conversation session", handler: (ctx) => handleGateway(ctx, "new") },
    { name: "reset", description: "Reset conversation session", handler: (ctx) => handleGateway(ctx, "reset") },
    { name: "cwd", description: "Show, set, or reset working directory", handler: (ctx) => handleGateway(ctx, "cwd") },
    { name: "model", description: "Show, list, set, or reset AI model", handler: handleModel },
    { name: "effort", description: "Show, set, or reset reasoning effort", handler: handleEffort },
    { name: "mode", description: "Show or set thread mode (thread|plain)", handler: handleMode },
    { name: "toolprogress", description: "Show or set tool progress", handler: handleToolProgress },
    { name: "stop", description: "Stop the current turn", handler: (ctx) => handleGateway(ctx, "stop") },
    { name: "retry", description: "Retry the last prompt", handler: (ctx) => handleGateway(ctx, "retry") },
    { name: "approve", description: "List or resolve pending approvals", handler: (ctx) => handleGateway(ctx, "approve") },
    { name: "pause", description: "Pause message processing", handler: handlePause },
    { name: "resume", description: "Resume message processing", handler: handleResume },
    { name: "kick", description: "Remove this chat from allowlist", handler: handleKick },
    { name: "delete", description: "Remove this chat's session and pairing", handler: handleDelete },
    { name: "help", description: "List available commands", handler: handleHelp },
  ];
}

export async function registerTelegramCommands(api             )                {
  const commands = buildCommandDefs()
    .filter((def) => def.menu !== false)
    .map((def) => ({ command: def.name, description: def.description }));
  await api.setMyCommands(commands);
}

export function findCommandDef(command        )                    {
  return buildCommandDefs().find((def) => def.name === command) ?? null;
}

async function handleStart(ctx                )                                {
  if (ctx.isAllowedChat(ctx.chatId)) return { text: "codexclaw: already connected ✅" };
  const payload = ctx.args.trim().split(/\s+/, 1)[0] ?? "";
  if (payload && ctx.agentId !== null) {
    const hash = createHash("sha256").update(payload).digest("hex");
    if (ctx.db.consumeAgentPairingCode(ctx.agentId, hash)) {
      ctx.admitChat(ctx.chatId);
      ctx.log(`[tg] deep-link paired chat ${ctx.chatId}`);
      return { text: "codexclaw: connected ✅ send me a message." };
    }
  }
  if (ctx.isHandshakeOpen()) {
    ctx.admitChat(ctx.chatId);
    ctx.log(`[tg] handshake paired chat ${ctx.chatId}`);
    return { text: "codexclaw: connected ✅ send me a message." };
  }
  return null;
}

async function handleId(ctx                )                         {
  return { text: `Chat ID: ${ctx.chatId}` };
}

async function handleGateway(ctx                , name        )                         {
  const binding = getBinding(ctx);
  return toTelegramCommandResult(
    await dispatchGatewayCommand(name, {
      bindingId: binding.id,
      db: ctx.db,
      agentService: ctx.agentService,
      agentId: ctx.agentId,
      args: ctx.args,
      defaultWorkdir: ctx.workdir,
      onApprovalRequest: (request) => sendApprovalRequest(ctx, request),
      onEvent: ctx.onEvent,
    }),
  );
}

async function handleModel(ctx                )                         {
  const binding = getBinding(ctx);
  const result = await dispatchGatewayCommand("model", {
    bindingId: binding.id,
    db: ctx.db,
    agentService: ctx.agentService,
    agentId: ctx.agentId,
    args: ctx.args,
    defaultWorkdir: ctx.workdir,
  });
  if (ctx.args) return toTelegramCommandResult(result);
  const current = String(result?.data?.model ?? "default");
  return {
    text: result?.text ?? `Current model: ${current}`,
    keyboard: buildModelPicker(loadModelCatalog(), current, binding.id),
  };
}

async function handleEffort(ctx                )                         {
  const binding = getBinding(ctx);
  const result = await dispatchGatewayCommand("effort", {
    bindingId: binding.id,
    db: ctx.db,
    agentService: ctx.agentService,
    agentId: ctx.agentId,
    args: ctx.args,
    defaultWorkdir: ctx.workdir,
  });
  if (ctx.args) return toTelegramCommandResult(result);
  const current = String(result?.data?.effort ?? "default");
  return {
    text: result?.text ?? `Current effort: ${current}`,
    keyboard: buildEffortPicker(current, binding.id),
  };
}

async function handleMode(ctx                )                         {
  const binding = getBinding(ctx);
  const result = await dispatchGatewayCommand("mode", {
    bindingId: binding.id,
    db: ctx.db,
    agentService: ctx.agentService,
    agentId: ctx.agentId,
    args: ctx.args,
    defaultWorkdir: ctx.workdir,
  });
  if (ctx.args) return toTelegramCommandResult(result);
  if (!result?.data?.mode) return toTelegramCommandResult(result);
  const current = String(result?.data?.mode ?? "thread");
  return {
    text: result?.text ?? `Current mode: ${current}`,
    keyboard: buildModePicker(current, binding.id),
  };
}

async function handleToolProgress(ctx                )                         {
  const binding = getBinding(ctx);
  const result = await dispatchGatewayCommand("toolprogress", {
    bindingId: binding.id,
    db: ctx.db,
    agentService: ctx.agentService,
    agentId: ctx.agentId,
    args: ctx.args,
    defaultWorkdir: ctx.workdir,
  });
  if (ctx.args || !result?.data?.agentId) return toTelegramCommandResult(result);
  const current = String(result.data.toolProgress ?? "new");
  return {
    text: result.text,
    keyboard: buildToolProgressPicker(current, binding.id),
  };
}

async function handlePause(ctx                )                         {
  ctx.setPaused(true);
  return { text: "Paused — messages will be ignored until /resume." };
}

async function handleResume(ctx                )                         {
  ctx.setPaused(false);
  return { text: "Resumed — messages will be processed." };
}

async function handleKick(ctx                )                         {
  ctx.removeChat(ctx.chatId);
  return { text: "Chat removed from allowlist." };
}

async function handleDelete(ctx                )                                {
  const confirmed = ctx.args.trim().split(/\s+/)[0] === "confirm";
  const pendingKey = deletePendingKey(ctx);
  const pendingUntil = ctx.pendingDeletes.get(pendingKey) ?? 0;

  if (!confirmed || pendingUntil < Date.now()) {
    ctx.pendingDeletes.set(pendingKey, Date.now() + ctx.deleteTtlMs);
    const target = telegramTopicId(ctx.msg) === null
      ? "this chat's session, history, and pairing"
      : "this topic's session and history";
    return {
      text: `This will remove ${target}. Send /delete confirm within 60s to proceed.`,
    };
  }

  ctx.pendingDeletes.delete(pendingKey);
  const binding = getBinding(ctx);
  ctx.db.deleteBindingCascade(binding.id);

  const topicId = telegramTopicId(ctx.msg);
  if (topicId !== null) {
    ctx.log(`[tg] /delete wiped chat ${ctx.chatId} topic ${topicId}`);
    return { text: "Topic session deleted — this chat remains paired." };
  }

  ctx.removeChat(ctx.chatId);
  ctx.log(`[tg] /delete wiped chat ${ctx.chatId}`);
  return {
    text: "Chat deleted — pairing and history removed on the bot side. Reconnecting requires a new pairing window from the desktop.",
  };
}

async function handleHelp()                         {
  // Telegram-only commands not shared with gateway
  const tgOnly                        = buildCommandDefs()
    .filter((def) => !GATEWAY_COMMANDS_SET.has(def.name) && def.name !== "help")
    .map((def) => ({ name: def.name, description: def.description }));
  const entries = buildHelpEntries("telegram", tgOnly);

  // Group by section and render as rich HTML
  const sections = new Map                        ();
  for (const entry of entries) {
    const list = sections.get(entry.section) ?? [];
    list.push(entry);
    sections.set(entry.section, list);
  }
  const parts           = [];
  for (const [section, cmds] of sections) {
    parts.push(`<b>${escapeHtmlTg(section)}</b>`);
    for (const cmd of cmds) {
      const args = cmd.args ? ` ${escapeHtmlTg(cmd.args)}` : "";
      parts.push(`<code>/${escapeHtmlTg(cmd.name)}${args}</code> — ${escapeHtmlTg(cmd.description)}`);
    }
  }
  return { text: parts.join("\n"), parseMode: "HTML" };
}

function getBinding(ctx                )             {
  const rawTopicId = telegramTopicId(ctx.msg);
  const agent = ctx.agentId !== null ? ctx.db.getAgent(ctx.agentId) : null;
  const topicId = agent && (agent.thread_mode ?? "thread") === "plain" ? null : rawTopicId;
  return (
    ctx.binding ??
    (ctx.agentId !== null
      ? ctx.db.getOrCreateAgentBinding(ctx.agentId, "telegram", ctx.chatId, ctx.workdir, topicId)
      : ctx.db.getOrCreateBinding("telegram", ctx.chatId, ctx.workdir, topicId))
  );
}

function deletePendingKey(ctx                )         {
  return `${ctx.chatId}:${telegramTopicId(ctx.msg) ?? "plain"}`;
}

async function sendApprovalRequest(ctx                , request                 )                {
  const formatted = formatApprovalForTelegram(request);
  const sent = await ctx.api.sendMessageWithKeyboard({
    chatId: ctx.chatId,
    text: formatted.text,
    messageThreadId: telegramReplyThreadId(ctx.msg),
    inlineKeyboard: formatted.keyboard,
  });
  if (sent.ok && sent.result?.message_id) {
    const messageId = sent.result.message_id;
    ctx.agentService.registerApprovalCleanup(request.id, async () => {
      await ctx.api.editMessageReplyMarkup(ctx.chatId, messageId);
    });
  }
}

function toTelegramCommandResult(result                             )                {
  const chunks = result?.telegramHtmlChunks ?? (result?.telegramHtml ? chunkTelegramMessage(result.telegramHtml) : undefined);
  return {
    text: chunks?.[0] ?? result?.telegramHtml ?? result?.text ?? "Unknown command.",
    chunks,
    parseMode: result?.telegramHtml ? "HTML" : undefined,
    keyboard: result?.telegramKeyboard,
  };
}
