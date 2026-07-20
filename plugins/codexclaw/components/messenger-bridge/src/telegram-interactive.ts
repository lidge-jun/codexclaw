/**
 * telegram-interactive.ts — inline keyboard callback encoding and dispatch.
 *
 * Telegram callback_data is capped at 64 bytes, so payloads stay compact and
 * model selections use catalog indexes instead of full model ids.
 */
import { buildCatalog } from "../../subagent-config/dist/catalog.js";
import { AGENT_EFFORTS, AGENT_THREAD_MODES, AGENT_TOOL_PROGRESS_MODES, type BridgeDb } from "./db.ts";
import { telegramReplyThreadId, type TelegramApi, type TgCallbackQuery } from "./telegram-api.ts";
import type { InlineKeyboard } from "./telegram-commands.ts";

export interface CallbackAction {
  type: "model_select" | "effort_select" | "mode_select" | "tool_progress_select" | "approve" | "deny" | "retry" | "cancel";
  payload: string;
}

export interface CatalogEntry {
  id: string;
  label?: string;
}

export interface CallbackAuthContext {
  agentId: number | null;
  isAllowedChat: (chatId: string) => boolean;
  resolveApproval?: (
    id: string,
    decision: "allow-once" | "allow-always" | "deny",
    chatId: string,
  ) => Promise<"resolved" | "not_found" | "unauthorized"> | "resolved" | "not_found" | "unauthorized";
}

const CALLBACK_TAGS = {
  model_select: "m",
  effort_select: "e",
  mode_select: "o",
  tool_progress_select: "p",
  approve: "a",
  deny: "d",
  retry: "r",
  cancel: "c",
} as const;

const CALLBACK_TYPES = new Map<string, CallbackAction["type"]>(
  Object.entries(CALLBACK_TAGS).map(([type, tag]) => [tag, type as CallbackAction["type"]]),
);

export function encodeCallback(action: CallbackAction): string {
  const tag = CALLBACK_TAGS[action.type];
  const data = action.payload ? `${tag}:${action.payload}` : tag;
  if (Buffer.byteLength(data, "utf8") > 64) {
    throw new Error("Telegram callback_data exceeds 64 bytes");
  }
  return data;
}

export function decodeCallback(data: string): CallbackAction | null {
  const [tag, ...rest] = data.split(":");
  const type = CALLBACK_TYPES.get(tag);
  if (!type) return null;
  return { type, payload: rest.join(":") };
}

export function loadModelCatalog(): CatalogEntry[] {
  const catalog = buildCatalog() as { entries?: Array<{ id?: unknown; label?: unknown }> };
  const entries = Array.isArray(catalog.entries) ? catalog.entries : [];
  return entries
    .filter((entry): entry is { id: string; label?: string } => typeof entry.id === "string" && entry.id.length > 0)
    .map((entry) => ({
      id: entry.id,
      label: typeof entry.label === "string" ? entry.label : entry.id,
    }));
}

export function buildModelPicker(catalog: CatalogEntry[], current: string, bindingId = 0): InlineKeyboard {
  return rows(
    catalog.map((entry, index) => ({
      text: `${entry.id === current ? "* " : ""}${entry.label ?? entry.id}`,
      callback_data: encodeCallback({ type: "model_select", payload: `${bindingId}:${index}` }),
    })),
    1,
  );
}

export function buildEffortPicker(current: string, bindingId = 0): InlineKeyboard {
  return rows(
    AGENT_EFFORTS.map((effort) => ({
      text: `${effort === current ? "* " : ""}${effort}`,
      callback_data: encodeCallback({ type: "effort_select", payload: `${bindingId}:${effort}` }),
    })),
    3,
  );
}

export function buildModePicker(current: string, bindingId = 0): InlineKeyboard {
  return [
    AGENT_THREAD_MODES.map((mode) => ({
      text: `${mode === current ? "* " : ""}${mode[0].toUpperCase()}${mode.slice(1)}`,
      callback_data: encodeCallback({ type: "mode_select", payload: `${bindingId}:${mode}` }),
    })),
  ];
}

export function buildToolProgressPicker(current: string, bindingId = 0): InlineKeyboard {
  return rows(
    AGENT_TOOL_PROGRESS_MODES.map((mode) => ({
      text: `${mode === current ? "* " : ""}${mode}`,
      callback_data: encodeCallback({ type: "tool_progress_select", payload: `${bindingId}:${mode}` }),
    })),
    2,
  );
}

export async function handleCallback(
  api: TelegramApi,
  query: TgCallbackQuery,
  db: BridgeDb,
  auth: CallbackAuthContext,
): Promise<void> {
  let answer = "Action handled";
  try {
    const action = query.data ? decodeCallback(query.data) : null;
    if (!action) {
      answer = "Unknown action";
      return;
    }
    const denied = authorizeCallback(query, action, db, auth);
    if (denied) {
      answer = denied;
      return;
    }

    if (action.type === "model_select") {
      answer = await handleModelSelect(api, query, db, action.payload);
      return;
    }
    if (action.type === "effort_select") {
      answer = await handleEffortSelect(api, query, db, action.payload);
      return;
    }
    if (action.type === "mode_select") {
      answer = await handleModeSelect(api, query, db, action.payload);
      return;
    }
    if (action.type === "tool_progress_select") {
      answer = await handleToolProgressSelect(api, query, db, action.payload);
      return;
    }
    if (action.type === "approve" || action.type === "deny") {
      answer = await handleApproval(query, auth, action);
      return;
    }

    answer = "This action is not wired yet";
  } catch (err) {
    answer = err instanceof Error ? err.message : String(err);
  } finally {
    await api.answerCallbackQuery(query.id, answer);
  }
}

async function handleApproval(
  query: TgCallbackQuery,
  auth: CallbackAuthContext,
  action: CallbackAction,
): Promise<string> {
  const chatId = query.message?.chat ? String(query.message.chat.id) : null;
  if (!chatId) return "Callback chat unavailable";
  if (!auth.resolveApproval) return "Approval relay is not wired";
  const parsed = parseApprovalPayload(action);
  if (!parsed) return "Invalid approval action";
  const status = await auth.resolveApproval(parsed.id, parsed.decision, chatId);
  switch (status) {
    case "resolved":
      return `Approval ${parsed.decision}`;
    case "unauthorized":
      return "This approval belongs to another chat or agent";
    case "not_found":
      return "Approval not found or already resolved";
  }
}

function authorizeCallback(
  query: TgCallbackQuery,
  action: CallbackAction,
  db: BridgeDb,
  auth: CallbackAuthContext,
): string | null {
  const chatId = query.message?.chat ? String(query.message.chat.id) : null;
  if (!chatId) return "Callback chat unavailable";
  if (!auth.isAllowedChat(chatId)) return "This chat is not paired";

  const bindingId = callbackBindingId(action);
  if (bindingId === null) return null;
  const binding = db.getBinding(bindingId);
  if (!binding) return "Binding not found";
  if (binding.chat_id !== chatId || binding.agent_id !== auth.agentId) {
    return "This action belongs to another agent";
  }
  return null;
}

function callbackBindingId(action: CallbackAction): number | null {
  if (
    action.type !== "model_select"
    && action.type !== "effort_select"
    && action.type !== "mode_select"
    && action.type !== "tool_progress_select"
  ) return null;
  return parsePayload(action.payload)?.bindingId ?? null;
}

async function handleModelSelect(
  api: TelegramApi,
  query: TgCallbackQuery,
  db: BridgeDb,
  payload: string,
): Promise<string> {
  const parsed = parsePayload(payload);
  if (!parsed) return "Invalid model selection";
  const binding = db.getBinding(parsed.bindingId);
  if (!binding) return "Binding not found";

  const catalog = loadModelCatalog();
  const entry = catalog[Number(parsed.value)];
  if (!entry) return "Model not found";

  db.setBindingModel(parsed.bindingId, entry.id);
  await sendCallbackMessage(api, query, `Model set to ${entry.id}`);
  return "Model set";
}

async function handleEffortSelect(
  api: TelegramApi,
  query: TgCallbackQuery,
  db: BridgeDb,
  payload: string,
): Promise<string> {
  const parsed = parsePayload(payload);
  if (!parsed) return "Invalid effort selection";
  const effort = parsed.value;
  if (!(AGENT_EFFORTS as readonly string[]).includes(effort)) return "Unknown effort";
  const binding = db.getBinding(parsed.bindingId);
  if (!binding) return "Binding not found";

  db.setBindingEffort(parsed.bindingId, effort);
  await sendCallbackMessage(api, query, `Effort set to ${effort}`);
  return "Effort set";
}

async function handleModeSelect(
  api: TelegramApi,
  query: TgCallbackQuery,
  db: BridgeDb,
  payload: string,
): Promise<string> {
  const parsed = parsePayload(payload);
  if (!parsed) return "Invalid mode selection";
  const mode = parsed.value;
  if (!(AGENT_THREAD_MODES as readonly string[]).includes(mode)) return "Unknown mode";
  const binding = db.getBinding(parsed.bindingId);
  if (!binding) return "Binding not found";
  if (binding.agent_id === null) return "Mode requires a named agent";
  const agent = db.getAgent(binding.agent_id);
  if (!agent) return "Agent not found";

  db.updateAgent(agent.id, { thread_mode: mode });
  await editCallbackMessage(api, query, `Mode set to ${mode}`);
  return "Mode set";
}

async function handleToolProgressSelect(
  api: TelegramApi,
  query: TgCallbackQuery,
  db: BridgeDb,
  payload: string,
): Promise<string> {
  const parsed = parsePayload(payload);
  if (!parsed) return "Invalid tool progress selection";
  const mode = parsed.value;
  if (!(AGENT_TOOL_PROGRESS_MODES as readonly string[]).includes(mode)) return "Unknown tool progress";
  const binding = db.getBinding(parsed.bindingId);
  if (!binding) return "Binding not found";
  if (binding.agent_id === null) return "Tool progress requires a named agent";
  const agent = db.getAgent(binding.agent_id);
  if (!agent) return "Agent not found";

  db.updateAgent(agent.id, { tool_progress: mode as typeof agent.tool_progress });
  await editCallbackMessage(api, query, `Tool progress set to ${mode}`);
  return "Tool progress set";
}

function parsePayload(payload: string): { bindingId: number; value: string } | null {
  const [bindingRaw, ...rest] = payload.split(":");
  const bindingId = Number(bindingRaw);
  const value = rest.join(":");
  if (!Number.isInteger(bindingId) || bindingId <= 0 || !value) return null;
  return { bindingId, value };
}

function parseApprovalPayload(
  action: CallbackAction,
): { id: string; decision: "allow-once" | "allow-always" | "deny" } | null {
  const [id, decisionRaw] = action.payload.split(":");
  if (!id) return null;
  if (action.type === "deny") return { id, decision: "deny" };
  if (decisionRaw === "allow-once" || decisionRaw === "allow-always") {
    return { id, decision: decisionRaw };
  }
  return null;
}

async function sendCallbackMessage(api: TelegramApi, query: TgCallbackQuery, text: string): Promise<void> {
  const chat = query.message?.chat;
  if (!chat) return;
  await api.sendMessage({
    chatId: String(chat.id),
    text,
    messageThreadId: query.message ? telegramReplyThreadId(query.message) : undefined,
  });
}

async function editCallbackMessage(api: TelegramApi, query: TgCallbackQuery, text: string): Promise<void> {
  const chat = query.message?.chat;
  const messageId = query.message?.message_id;
  if (!chat || !messageId) return;
  await api.editMessageText(String(chat.id), messageId, text);
}

function rows<T>(items: T[], width: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += width) out.push(items.slice(i, i + width));
  return out;
}
