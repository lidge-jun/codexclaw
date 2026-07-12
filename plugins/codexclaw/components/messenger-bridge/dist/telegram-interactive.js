/**
 * telegram-interactive.ts — inline keyboard callback encoding and dispatch.
 *
 * Telegram callback_data is capped at 64 bytes, so payloads stay compact and
 * model selections use catalog indexes instead of full model ids.
 */
import { buildCatalog } from "../../subagent-config/dist/catalog.js";
import { AGENT_EFFORTS, AGENT_THREAD_MODES,               } from "./db.js";
import { telegramReplyThreadId,                                        } from "./telegram-api.js";






















const CALLBACK_TAGS = {
  model_select: "m",
  effort_select: "e",
  mode_select: "o",
  approve: "a",
  deny: "d",
  retry: "r",
  cancel: "c",
}         ;

const CALLBACK_TYPES = new Map                                (
  Object.entries(CALLBACK_TAGS).map(([type, tag]) => [tag, type                          ]),
);

export function encodeCallback(action                )         {
  const tag = CALLBACK_TAGS[action.type];
  const data = action.payload ? `${tag}:${action.payload}` : tag;
  if (Buffer.byteLength(data, "utf8") > 64) {
    throw new Error("Telegram callback_data exceeds 64 bytes");
  }
  return data;
}

export function decodeCallback(data        )                        {
  const [tag, ...rest] = data.split(":");
  const type = CALLBACK_TYPES.get(tag);
  if (!type) return null;
  return { type, payload: rest.join(":") };
}

export function loadModelCatalog()                 {
  const catalog = buildCatalog()                                                          ;
  const entries = Array.isArray(catalog.entries) ? catalog.entries : [];
  return entries
    .filter((entry)                                          => typeof entry.id === "string" && entry.id.length > 0)
    .map((entry) => ({
      id: entry.id,
      label: typeof entry.label === "string" ? entry.label : entry.id,
    }));
}

export function buildModelPicker(catalog                , current        , bindingId = 0)                 {
  return rows(
    catalog.map((entry, index) => ({
      text: `${entry.id === current ? "* " : ""}${entry.label ?? entry.id}`,
      callback_data: encodeCallback({ type: "model_select", payload: `${bindingId}:${index}` }),
    })),
    1,
  );
}

export function buildEffortPicker(current        , bindingId = 0)                 {
  return rows(
    AGENT_EFFORTS.map((effort) => ({
      text: `${effort === current ? "* " : ""}${effort}`,
      callback_data: encodeCallback({ type: "effort_select", payload: `${bindingId}:${effort}` }),
    })),
    3,
  );
}

export function buildModePicker(current        , bindingId = 0)                 {
  return [
    AGENT_THREAD_MODES.map((mode) => ({
      text: `${mode === current ? "* " : ""}${mode[0].toUpperCase()}${mode.slice(1)}`,
      callback_data: encodeCallback({ type: "mode_select", payload: `${bindingId}:${mode}` }),
    })),
  ];
}

export async function handleCallback(
  api             ,
  query                 ,
  db          ,
  auth                     ,
)                {
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
  query                 ,
  auth                     ,
  action                ,
)                  {
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
  query                 ,
  action                ,
  db          ,
  auth                     ,
)                {
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

function callbackBindingId(action                )                {
  if (action.type !== "model_select" && action.type !== "effort_select" && action.type !== "mode_select") return null;
  return parsePayload(action.payload)?.bindingId ?? null;
}

async function handleModelSelect(
  api             ,
  query                 ,
  db          ,
  payload        ,
)                  {
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
  api             ,
  query                 ,
  db          ,
  payload        ,
)                  {
  const parsed = parsePayload(payload);
  if (!parsed) return "Invalid effort selection";
  const effort = parsed.value;
  if (!(AGENT_EFFORTS                     ).includes(effort)) return "Unknown effort";
  const binding = db.getBinding(parsed.bindingId);
  if (!binding) return "Binding not found";

  db.setBindingEffort(parsed.bindingId, effort);
  await sendCallbackMessage(api, query, `Effort set to ${effort}`);
  return "Effort set";
}

async function handleModeSelect(
  api             ,
  query                 ,
  db          ,
  payload        ,
)                  {
  const parsed = parsePayload(payload);
  if (!parsed) return "Invalid mode selection";
  const mode = parsed.value;
  if (!(AGENT_THREAD_MODES                     ).includes(mode)) return "Unknown mode";
  const binding = db.getBinding(parsed.bindingId);
  if (!binding) return "Binding not found";
  if (binding.agent_id === null) return "Mode requires a named agent";
  const agent = db.getAgent(binding.agent_id);
  if (!agent) return "Agent not found";

  db.updateAgent(agent.id, { thread_mode: mode });
  await editCallbackMessage(api, query, `Mode set to ${mode}`);
  return "Mode set";
}

function parsePayload(payload        )                                              {
  const [bindingRaw, ...rest] = payload.split(":");
  const bindingId = Number(bindingRaw);
  const value = rest.join(":");
  if (!Number.isInteger(bindingId) || bindingId <= 0 || !value) return null;
  return { bindingId, value };
}

function parseApprovalPayload(
  action                ,
)                                                                          {
  const [id, decisionRaw] = action.payload.split(":");
  if (!id) return null;
  if (action.type === "deny") return { id, decision: "deny" };
  if (decisionRaw === "allow-once" || decisionRaw === "allow-always") {
    return { id, decision: decisionRaw };
  }
  return null;
}

async function sendCallbackMessage(api             , query                 , text        )                {
  const chat = query.message?.chat;
  if (!chat) return;
  await api.sendMessage({
    chatId: String(chat.id),
    text,
    messageThreadId: query.message ? telegramReplyThreadId(query.message) : undefined,
  });
}

async function editCallbackMessage(api             , query                 , text        )                {
  const chat = query.message?.chat;
  const messageId = query.message?.message_id;
  if (!chat || !messageId) return;
  await api.editMessageText(String(chat.id), messageId, text);
}

function rows   (items     , width        )        {
  const out        = [];
  for (let i = 0; i < items.length; i += width) out.push(items.slice(i, i + width));
  return out;
}
