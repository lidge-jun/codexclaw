/**
 * gateway-commands.ts — platform-neutral bridge command effects.
 *
 * Telegram and Discord keep their own menus, keyboards, embeds, and transport
 * quirks. This module owns shared command behavior so model/effort/session
 * changes cannot drift by platform.
 */
import { realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { buildCatalog } from "../../subagent-config/dist/catalog.js";


import { chunkEmbedDescription,                   } from "./discord-api.js";
import { capDiscordEmbed,                } from "./discord-components.js";
import { AGENT_EFFORTS, AGENT_THREAD_MODES,                                                            } from "./db.js";
import { chunkTelegramMessage } from "./telegram-format.js";






























export const GATEWAY_COMMANDS                   = [
  { name: "status", description: "Show session status", handler: handleStatus },
  { name: "sessions", description: "List sessions for this chat", handler: handleSessions },
  { name: "jobs", description: "List recent jobs for this session", handler: handleJobs },
  { name: "agent", description: "Show this named agent's settings", handler: handleAgent },
  { name: "context", description: "Show recent conversation history", handler: handleContext },
  { name: "new", description: "Start a fresh conversation session", handler: handleNew },
  { name: "reset", description: "Reset conversation session", handler: handleReset },
  { name: "cwd", description: "Show, set, or reset working directory (/cwd [path|reset])", handler: handleCwd },
  { name: "model", description: "Show, list, set, or reset AI model (/model [id|list|reset])", handler: handleModel },
  { name: "effort", description: "Show, set, or reset reasoning effort (/effort [level|reset])", handler: handleEffort },
  { name: "stop", description: "Stop the current turn", handler: handleStop },
  { name: "retry", description: "Retry the last prompt", handler: handleRetry },
  { name: "approve", description: "List or resolve pending approvals (/approve [list|id choice])", handler: handleApprove },
  { name: "mode", description: "Show or set thread mode (thread|plain)", handler: handleMode },
  { name: "help", description: "List available commands", handler: handleHelp },
];

export function dispatchGatewayCommand(
  name        ,
  ctx                       ,
)                                       {
  const command = GATEWAY_COMMANDS.find((entry) => entry.name === name);
  return command ? command.handler(ctx) : Promise.resolve(null);
}

function bindingAndAgent(ctx                       )                                                  {
  const binding = ctx.db.getBinding(ctx.bindingId);
  if (!binding) throw new Error("binding vanished");
  const agent = binding.agent_id !== null ? ctx.db.getAgent(binding.agent_id) : null;
  return { binding, agent };
}

function effectiveModel(binding            , agent                 )         {
  if (binding.model && binding.model !== "default") return binding.model;
  if (agent?.model && agent.model !== "default") return agent.model;
  return "default";
}

function effectiveEffort(binding            , agent                 )         {
  if (binding.effort && binding.effort !== "default") return binding.effort;
  if (agent?.effort && agent.effort !== "default") return agent.effort;
  return "default";
}

async function handleStatus(ctx                       )                                {
  const { binding, agent } = bindingAndAgent(ctx);
  const last = ctx.db.listJobs(binding.id, 1)[0];
  const model = effectiveModel(binding, agent);
  const effort = effectiveEffort(binding, agent);
  const session = shortId(binding.thread_id);
  const transport = agentTransport(agent);
  return {
    text: [
      `thread_id: ${binding.thread_id ?? "none"}`,
      `session: ${session}`,
      `model: ${model}`,
      `effort: ${effort}`,
      `status: ${binding.status}`,
      `thread_mode: ${agent?.thread_mode ?? "thread"}`,
      `transport: ${transport}`,
      `agent: ${agent?.name ?? "none"}`,
      `cwd: ${binding.workdir}`,
      `last_job: ${last ? `${last.state}${last.error ? `: ${last.error}` : ""}` : "none"}`,
    ].join("\n"),
    data: { binding, agent, model, effort, lastJob: last ?? null },
  };
}

async function handleSessions(ctx                       )                                {
  const { binding, agent } = bindingAndAgent(ctx);
  const rows = ctx.db.listBindingsForChat(binding.channel_kind, binding.chat_id, binding.agent_id);
  const now = ctx.now?.() ?? new Date();
  const summary = rows.map((row) => {
    const rowAgent = row.agent_id === agent?.id ? agent : row.agent_id !== null ? ctx.db.getAgent(row.agent_id) : null;
    return {
      binding: row,
      label: topicLabel(row),
      session: shortId(row.thread_id),
      model: effectiveModel(row, rowAgent),
      effort: effectiveEffort(row, rowAgent),
      updated: relativeTime(row.updated_at, now),
    };
  });
  const text = summary.length === 0
    ? "No sessions for this chat."
    : [
      "Sessions for this chat:",
      ...summary.map((row) =>
        `${row.label}: session ${row.session}, ${row.binding.status}, ${row.model}/${row.effort}, updated ${row.updated}`,
      ),
    ].join("\n");
  const telegramHtml = summary.length === 0
    ? "<b>Sessions</b>\nNo sessions for this chat."
    : [
      "<b>Sessions</b>",
      ...summary.map((row) =>
        `<code>${escapeHtml(row.label.padEnd(12).slice(0, 12))}</code> ${escapeHtml(row.binding.status)} ${escapeHtml(row.session)} ${escapeHtml(row.model)}/${escapeHtml(row.effort)} ${escapeHtml(row.updated)}`,
      ),
    ].join("\n");
  const visible = summary.slice(0, 10);
  const extra = summary.length - visible.length;
  return {
    text,
    telegramHtml,
    discordEmbed: {
      title: "Sessions",
      description: summary.length === 0 ? "No sessions for this chat." : extra > 0 ? `Showing 10 of ${summary.length}; +${extra} more.` : undefined,
      color: 0x3498db,
      fields: visible.map((row) => ({
        name: row.label,
        value: `session ${row.session}\n${row.binding.status} · ${row.model}/${row.effort}\nupdated ${row.updated}`,
        inline: false,
      })),
    },
    data: { bindings: rows },
  };
}

async function handleJobs(ctx                       )                                {
  const limit = parseLimit(ctx.args, 5, 15);
  if (typeof limit === "string") return { text: limit };
  const { binding } = bindingAndAgent(ctx);
  const jobs = ctx.db.listJobs(binding.id, limit);
  const text = jobs.length === 0
    ? "No jobs for this session."
    : ["Recent jobs:", ...jobs.map(formatJobText)].join("\n");
  const telegramHtml = jobs.length === 0
    ? "<b>Recent jobs</b>\nNo jobs for this session."
    : ["<b>Recent jobs</b>", ...jobs.map(formatJobHtml)].join("\n");
  return {
    text,
    telegramHtml,
    discordEmbed: {
      title: "Recent Jobs",
      description: jobs.length === 0 ? "No jobs for this session." : undefined,
      color: 0x3498db,
      fields: jobs.slice(0, 15).map((job) => ({
        name: `#${job.id} ${job.state}`,
        value: `${jobDuration(job)} · thread ${shortId(job.thread_id)}\n${job.prompt_preview || "-"}`,
        inline: false,
      })),
    },
    data: { jobs },
  };
}

async function handleAgent(ctx                       )                                {
  const { agent } = bindingAndAgent(ctx);
  if (!agent) {
    return { text: "Agent details require a named agent. Legacy single-channel bindings do not have an agent card." };
  }
  const details = {
    name: agent.name,
    kind: agent.kind,
    enabled: agent.enabled === 1 ? "yes" : "no",
    model: agent.model,
    effort: agent.effort,
    thread_mode: agent.thread_mode,
    full_access: agent.full_access === 1 ? "yes" : "no",
    transport: agentTransport(agent),
    heartbeat: agent.heartbeat_minutes === 0 ? "off" : `${agent.heartbeat_minutes} min`,
    allowlist: String(ctx.db.countAgentAllowlist(agent.id)),
  };
  const text = [
    `agent: ${details.name}`,
    `kind: ${details.kind}`,
    `enabled: ${details.enabled}`,
    `default_model: ${details.model}`,
    `default_effort: ${details.effort}`,
    `thread_mode: ${details.thread_mode}`,
    `full_access: ${details.full_access}`,
    `transport: ${details.transport}`,
    `heartbeat: ${details.heartbeat}`,
    `allowlist: ${details.allowlist}`,
  ].join("\n");
  return {
    text,
    telegramHtml: [
      `<b>Agent ${escapeHtml(agent.name)}</b>`,
      ...Object.entries(details).filter(([key]) => key !== "name").map(([key, value]) =>
        `<code>${escapeHtml(key)}</code>: ${escapeHtml(value)}`,
      ),
    ].join("\n"),
    discordEmbed: {
      title: `Agent ${agent.name}`,
      color: 0x2ecc71,
      fields: Object.entries(details).filter(([key]) => key !== "name").map(([key, value]) => ({
        name: key,
        value,
        inline: value.length <= 16,
      })),
    },
    // Redacted DTO only: AgentRow carries token/webhook_url secrets that must
    // never ride along in a command result object.
    data: {
      agent: {
        id: agent.id,
        name: agent.name,
        kind: agent.kind,
        enabled: agent.enabled === 1,
        model: agent.model,
        effort: agent.effort,
        threadMode: agent.thread_mode,
        fullAccess: agent.full_access === 1,
        transport: agent.webhook_url ? "webhook" : "poll",
        heartbeatMinutes: agent.heartbeat_minutes,
      },
      allowlistCount: details.allowlist,
    },
  };
}

async function handleContext(ctx                       )                                {
  const { binding } = bindingAndAgent(ctx);
  const jobs = ctx.db.listJobs(binding.id, 5);
  if (jobs.length === 0) return { text: "No conversation history yet.", data: { jobs: [] } };
  return {
    text: jobs
      .map((job) => `User: ${job.prompt_preview}\nAssistant: ${job.result_preview ?? ""}`)
      .join("\n\n"),
    data: { jobs },
  };
}

async function handleNew(ctx                       )                                {
  ctx.db.clearBindingThread(ctx.bindingId);
  return { text: "New session — next message starts a fresh conversation." };
}

async function handleReset(ctx                       )                                {
  ctx.db.resetBindingSession(ctx.bindingId);
  return { text: "Session reset — next message starts a fresh conversation." };
}

async function handleCwd(ctx                       )                                {
  const { binding } = bindingAndAgent(ctx);
  if (!ctx.args) return { text: `Current workdir: ${binding.workdir}`, data: { workdir: binding.workdir } };

  const raw = ctx.args.trim();
  const target = raw === "reset" ? ctx.defaultWorkdir : raw;
  if (!target) {
    return { text: "No default workdir is configured for this bridge." };
  }
  const validated = validateWorkdir(target);
  if (!validated) {
    return { text: `Not a directory: ${target}` };
  }

  ctx.db.setBindingWorkdir(binding.id, validated);
  ctx.db.resetBindingSession(binding.id);
  return {
    text: raw === "reset" ? `Workdir reset: ${validated} (session reset)` : `Workdir set: ${validated} (session reset)`,
    data: { workdir: validated },
  };
}

async function handleModel(ctx                       )                                {
  const { binding, agent } = bindingAndAgent(ctx);
  const arg = ctx.args.trim();
  if (arg) {
    // Reserved /model subcommands are checked before save-verbatim so model ids
    // named "list" or "reset" cannot be stored accidentally.
    if (arg === "list") return modelListResult();
    if (arg === "reset") {
      ctx.db.setBindingModel(binding.id, "default");
      const next = effectiveModel(ctx.db.getBinding(binding.id) ?? binding, agent);
      return { text: `Model reset to ${next}`, data: { model: next, bindingId: binding.id } };
    }
    ctx.db.setBindingModel(binding.id, arg);
    return { text: `Model set to ${arg}`, data: { model: arg, bindingId: binding.id } };
  }

  const model = effectiveModel(binding, agent);
  return {
    text: `Current model: ${model}`,
    data: {
      model,
      bindingModel: binding.model,
      agentModel: agent?.model ?? "default",
      bindingId: binding.id,
    },
  };
}

async function handleEffort(ctx                       )                                {
  const { binding, agent } = bindingAndAgent(ctx);
  const arg = ctx.args.trim();
  if (arg) {
    if (arg === "reset") {
      ctx.db.setBindingEffort(binding.id, "default");
      const next = effectiveEffort(ctx.db.getBinding(binding.id) ?? binding, agent);
      return { text: `Effort reset to ${next}`, data: { effort: next, bindingId: binding.id } };
    }
    if (!(AGENT_EFFORTS                     ).includes(arg)) {
      return { text: `effort must be one of ${AGENT_EFFORTS.join(", ")}` };
    }
    ctx.db.setBindingEffort(binding.id, arg);
    return { text: `Effort set to ${arg}`, data: { effort: arg, bindingId: binding.id } };
  }

  const effort = effectiveEffort(binding, agent);
  return {
    text: `Current effort: ${effort}`,
    data: {
      effort,
      bindingEffort: binding.effort,
      agentEffort: agent?.effort ?? "default",
      bindingId: binding.id,
    },
  };
}

async function handleStop(ctx                       )                                {
  const stopped = ctx.agentService.cancelTurn(ctx.bindingId);
  return { text: stopped ? "Stop requested for the current turn." : "No running turn for this chat." };
}

async function handleRetry(ctx                       )                                {
  const { binding } = bindingAndAgent(ctx);
  const [last] = ctx.db.listJobs(binding.id, 1);
  if (!last?.prompt_preview) return { text: "No previous prompt to retry." };

  const result = await ctx.agentService.handleIncoming({
    kind: binding.channel_kind,
    chatId: binding.chat_id,
    text: last.prompt_preview,
    workdir: binding.workdir,
    topicId: binding.topic_id,
    agentId: binding.agent_id ?? undefined,
    onApprovalRequest: ctx.onApprovalRequest,
  });
  return { text: formatIncomingResult(result), data: { retriedJobId: last.id } };
}

async function handleApprove(ctx                       )                                {
  const [id, decisionRaw] = ctx.args.trim().split(/\s+/, 2);
  if (id === "list" && !decisionRaw) {
    return approvalListResult(ctx);
  }
  const decision = normalizeDecision(decisionRaw);
  if (!id || !decision) {
    return { text: "Usage: /approve list OR /approve <id> allow-once|allow-always|deny" };
  }
  const status = ctx.agentService.resolveApproval({
    id,
    decision,
    bindingId: ctx.bindingId,
    agentId: ctx.agentId,
  });
  switch (status) {
    case "resolved":
      return { text: `Approval ${id}: ${decision}` };
    case "unauthorized":
      return { text: "This approval belongs to another chat or agent." };
    case "not_found":
      return { text: "Approval not found or already resolved." };
  }
}

export function validateWorkdir(input        )                {
  const expanded =
    input === "~"
      ? homedir()
      : input.startsWith("~/") || input.startsWith("~\\")
        ? homedir() + input.slice(1)
        : input;
  try {
    const real = realpathSync(resolve(expanded));
    if (!statSync(real).isDirectory()) throw new Error("not a directory");
    return real;
  } catch {
    return null;
  }
}

function modelListResult()                       {
  const catalog = buildCatalog()                                                                            ;
  const groups = groupCatalogEntries(catalog.entries ?? []);
  const text = groups.length === 0
    ? "No models found."
    : ["Available models:", ...groups.flatMap((group) => [group.provider, ...group.entries.map((entry) => `  ${entry.id} — ${entry.label}`)])].join("\n");
  const telegramHtml = groups.length === 0
    ? "<b>Available models</b>\nNo models found."
    : [
      "<b>Available models</b>",
      ...groups.flatMap((group) => [
        `<b>${escapeHtml(group.provider)}</b>`,
        ...group.entries.map((entry) => `<code>${escapeHtml(entry.id)}</code> — ${escapeHtml(entry.label)}`),
      ]),
    ].join("\n");
  const fields = groups.flatMap((group) => {
    const chunks = chunkEmbedDescription(group.entries.map((entry) => `\`${entry.id}\` - ${entry.label}`).join("\n"), 1024);
    return (chunks.length > 0 ? chunks : ["-"]).map((chunk, index, all) => ({
      name: all.length === 1 ? group.provider : `${group.provider} (${index + 1}/${all.length})`,
      value: chunk,
      inline: false,
    }));
  });
  return {
    text,
    telegramHtml,
    telegramHtmlChunks: chunkTelegramMessage(telegramHtml),
    discordEmbed: capDiscordEmbed({
      title: "Available Models",
      description: groups.length === 0 ? "No models found." : undefined,
      color: 0x3498db,
      fields,
    }),
    data: { models: groups },
  };
}

function groupCatalogEntries(entries                                                            )


   {
  const groups = new Map                                              ();
  for (const entry of entries) {
    if (typeof entry.id !== "string" || entry.id.length === 0) continue;
    const source = typeof entry.source === "string" ? entry.source : "";
    const provider = source === "native" || source === "openai" ? "openai" : providerFromId(entry.id, source);
    const list = groups.get(provider) ?? [];
    list.push({ id: entry.id, label: typeof entry.label === "string" ? entry.label : entry.id });
    groups.set(provider, list);
  }
  return [...groups]
    .sort(([a], [b]) => providerRank(a) - providerRank(b) || a.localeCompare(b))
    .map(([provider, grouped]) => ({ provider, entries: grouped }));
}

function providerFromId(id        , fallback = "openai")         {
  const slash = id.indexOf("/");
  return slash > 0 ? id.slice(0, slash) : fallback || "openai";
}

function providerRank(provider        )         {
  return provider === "native" || provider === "openai" ? 0 : 1;
}

function approvalListResult(ctx                       )                       {
  const now = ctx.now?.().getTime() ?? Date.now();
  const pending = ctx.agentService.listPendingApprovals({
    bindingId: ctx.bindingId,
    agentId: ctx.agentId,
  });
  if (pending.length === 0) return { text: "No pending approvals." };
  const rows = pending.map((req) => {
    const seconds = Math.max(0, Math.ceil((req.expiresAt - now) / 1000));
    return `${req.id}  ${req.workdir}  ${req.promptHash.slice(0, 8)}  expires-in ${formatExpires(seconds)}`;
  });
  return { text: ["Pending approvals:", ...rows].join("\n"), data: { approvals: pending } };
}

function formatExpires(seconds        )         {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

async function handleMode(ctx                       )                                {
  const { binding, agent } = bindingAndAgent(ctx);
  if (!agent) {
    return { text: "Mode requires a named agent. Legacy single-channel bindings always use thread mode." };
  }
  const current = agent.thread_mode ?? "thread";
  if (!ctx.args) {
    const explanation = current === "thread"
      ? "Each message gets its own thread/topic session."
      : "All messages share a single session per chat.";
    return { text: `Current mode: ${current}\n${explanation}`, data: { mode: current } };
  }
  const target = ctx.args.trim().toLowerCase();
  if (!(AGENT_THREAD_MODES                     ).includes(target)) {
    return { text: `mode must be one of ${AGENT_THREAD_MODES.join(", ")}` };
  }
  ctx.db.updateAgent(agent.id, { thread_mode: target });
  return { text: `Mode set to ${target}`, data: { mode: target, agentId: agent.id } };
}

async function handleHelp()                                {
  return {
    text: ["Available commands:", ...GATEWAY_COMMANDS.map((def) => `/${def.name} — ${def.description}`)].join("\n"),
  };
}

// ── Unified help generator (A-5) ────────────────────────────────────────















/**
 * Build a merged help list from gateway commands + platform-only commands.
 * Platform-only entries get their own section; gateway commands go in "Session".
 */
export function buildHelpEntries(
  platform                        ,
  platformCommands                        = [],
)              {
  const entries              = GATEWAY_COMMANDS.map((cmd) => ({
    name: cmd.name,
    description: cmd.description,
    section: "Session",
  }));
  for (const pc of platformCommands) {
    entries.push({
      name: pc.name,
      args: pc.args,
      description: pc.description,
      section: pc.section ?? (platform === "telegram" ? "Telegram" : "Discord"),
    });
  }
  return entries;
}

function formatIncomingResult(result                )         {
  if (result.ok) return result.text ?? "Retried.";
  return `❌ ${result.error ?? "retry failed"}`;
}

function parseLimit(raw        , defaultValue        , max        )                  {
  const trimmed = raw.trim();
  if (!trimmed) return defaultValue;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value <= 0) return `Usage: /jobs [1-${max}]`;
  return Math.min(value, max);
}

function topicLabel(binding            )         {
  if (binding.topic_id) return `topic ${binding.topic_id}`;
  if (binding.thread_id) return `thread ${shortId(binding.thread_id)}`;
  return "chat";
}

function shortId(value                           )         {
  return value ? value.slice(0, 8) : "-";
}

function agentTransport(agent                 )         {
  if (!agent) return "legacy";
  if (agent.kind === "telegram") return agent.webhook_url.trim() ? "webhook" : "poll";
  return "gateway";
}

function relativeTime(iso        , now      )         {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now.getTime() - then);
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatJobText(job        )         {
  return `#${job.id} ${job.state} ${jobDuration(job)} thread ${shortId(job.thread_id)} — ${job.prompt_preview}`;
}

function formatJobHtml(job        )         {
  return `<code>#${job.id}</code> ${escapeHtml(job.state)} ${escapeHtml(jobDuration(job))} <code>${escapeHtml(shortId(job.thread_id))}</code> ${escapeHtml(job.prompt_preview)}`;
}

function jobDuration(job        )         {
  if (!job.started_at) return "-";
  if (!job.ended_at) return "running";
  const ms = Math.max(0, new Date(job.ended_at).getTime() - new Date(job.started_at).getTime());
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

function escapeHtml(value        )         {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeDecision(value                    )                          {
  if (value === "allow-once" || value === "allow-always" || value === "deny") return value;
  return null;
}
