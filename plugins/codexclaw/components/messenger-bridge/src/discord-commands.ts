import { AGENT_EFFORTS, AGENT_THREAD_MODES, type BindingRow } from "./db.ts";
import { formatApprovalForDiscord, type ApprovalRequest } from "./approval-relay.ts";
import type { DiscordApi } from "./discord-api.ts";
import type { Interaction, InteractionContext } from "./discord-interactions.ts";
import { buildHelpEntries, dispatchGatewayCommand, GATEWAY_COMMANDS, type GatewayCommandResult, type PlatformCommandMeta } from "./gateway-commands.ts";
import {
  buildEffortSelect,
  buildModeButtons,
  buildModelSelect,
  buildStatusEmbed,
  capDiscordEmbed,
  type CatalogEntry,
  type StatusState,
} from "./discord-components.ts";
import { sendFormattedDiscordOutput } from "./output-formatter.ts";

export interface SlashOption {
  name: string;
  description: string;
  type: 3;
  required?: boolean;
  choices?: Array<{ name: string; value: string }>;
}

export interface SlashCommandDef {
  name: string;
  description: string;
  options?: SlashOption[];
  handler: (interaction: Interaction, ctx: InteractionContext) => Promise<void>;
}


const GATEWAY_COMMANDS_SET = new Set(GATEWAY_COMMANDS.map((c) => c.name));
export const DEFAULT_MODEL_CATALOG: CatalogEntry[] = [
  { id: "default", label: "Default" },
  { id: "gpt-5.5", label: "gpt-5.5" },
  { id: "gpt-5.5-xhigh", label: "gpt-5.5-xhigh" },
  { id: "anthropic/claude-sonnet-5", label: "claude-sonnet-5" },
];

export const COMMANDS: SlashCommandDef[] = [
  {
    name: "ask",
    description: "Run a Codex turn in this chat",
    options: [{ name: "prompt", description: "What should Codex do?", type: 3, required: true }],
    handler: async (interaction, ctx) => {
      const prompt = stringOption(interaction, "prompt");
      if (!prompt) return editCommandReply(ctx.api, ctx.applicationId, interaction, "error", "Prompt is required.");
      await runTurnFromInteraction(interaction, ctx, prompt);
    },
  },
  {
    name: "review",
    description: "Ask Codex to review a change or artifact",
    options: [{ name: "target", description: "What should Codex review?", type: 3, required: true }],
    handler: async (interaction, ctx) => {
      const target = stringOption(interaction, "target");
      if (!target) return editCommandReply(ctx.api, ctx.applicationId, interaction, "error", "Review target is required.");
      await runTurnFromInteraction(interaction, ctx, `Review this and report findings first:\n\n${target}`);
    },
  },
  {
    name: "status",
    description: "Show this Discord chat's bridge status",
    handler: async (interaction, ctx) => {
      await editGatewayReply(interaction, ctx, "status");
    },
  },
  {
    name: "sessions",
    description: "List sessions for this Discord chat",
    handler: async (interaction, ctx) => {
      await editGatewayReply(interaction, ctx, "sessions");
    },
  },
  {
    name: "jobs",
    description: "List recent jobs for this session",
    options: [{ name: "limit", description: "Number of jobs to show (max 15)", type: 3 }],
    handler: async (interaction, ctx) => {
      await editGatewayReply(interaction, ctx, "jobs", stringOption(interaction, "limit") ?? "");
    },
  },
  {
    name: "agent",
    description: "Show this named agent's settings",
    handler: async (interaction, ctx) => {
      await editGatewayReply(interaction, ctx, "agent");
    },
  },
  {
    name: "model",
    description: "Show, list, update, or reset this chat's model",
    options: [{ name: "value", description: "/model [id|list|reset]", type: 3 }],
    handler: async (interaction, ctx) => {
      const value = stringOption(interaction, "value");
      if (value) {
        return editGatewayReply(interaction, ctx, "model", value);
      }
      const binding = resolveInteractionBinding(interaction, ctx);
      const result = await dispatchGatewayCommand("model", gatewayCtx(interaction, ctx, binding, ""));
      const current = String(result?.data?.model ?? "default");
      await ctx.api.editOriginalInteractionResponse(ctx.applicationId, interaction.token, {
        content: "Choose a model for this chat.",
        components: [buildModelSelect(ctx.modelCatalog ?? DEFAULT_MODEL_CATALOG, current)],
      });
    },
  },
  {
    name: "new",
    description: "Start a fresh Codex session for this chat",
    handler: async (interaction, ctx) => {
      await editGatewayReply(interaction, ctx, "new");
    },
  },
  {
    name: "stop",
    description: "Report turn cancellation status",
    handler: async (interaction, ctx) => {
      const result = await dispatchGatewayCommand("stop", gatewayCtx(interaction, ctx, resolveInteractionBinding(interaction, ctx), ""));
      await editCommandReply(
        ctx.api,
        ctx.applicationId,
        interaction,
        result?.text.startsWith("Stop requested") ? "success" : "needs_input",
        result?.text ?? "No running turn for this chat.",
      );
    },
  },
  {
    name: "effort",
    description: "Show, update, or reset this chat's reasoning effort",
    options: [
      {
        name: "value",
        description: "/effort [level|reset]",
        type: 3,
        choices: [...AGENT_EFFORTS, "reset"].map((effort) => ({ name: effort, value: effort })),
      },
    ],
    handler: async (interaction, ctx) => {
      const value = stringOption(interaction, "value");
      if (value) return setEffortFromInteraction(interaction, ctx, value);
      const binding = resolveInteractionBinding(interaction, ctx);
      const result = await dispatchGatewayCommand("effort", gatewayCtx(interaction, ctx, binding, ""));
      const current = String(result?.data?.effort ?? "default");
      await ctx.api.editOriginalInteractionResponse(ctx.applicationId, interaction.token, {
        content: "Choose reasoning effort for this chat.",
        components: [buildEffortSelect(AGENT_EFFORTS, current)],
      });
    },
  },
  {
    name: "mode",
    description: "Show or set thread mode",
    options: [
      {
        name: "value",
        description: "Thread routing mode",
        type: 3,
        choices: AGENT_THREAD_MODES.map((mode) => ({ name: mode, value: mode })),
      },
    ],
    handler: async (interaction, ctx) => {
      const value = stringOption(interaction, "value");
      if (value) return editGatewayReply(interaction, ctx, "mode", value);
      const binding = resolveInteractionBinding(interaction, ctx);
      const result = await dispatchGatewayCommand("mode", gatewayCtx(interaction, ctx, binding, ""));
      const current = String(result?.data?.mode ?? "");
      if (!current) {
        await editGatewayReply(interaction, ctx, "mode");
        return;
      }
      await ctx.api.editOriginalInteractionResponse(ctx.applicationId, interaction.token, {
        embeds: [result?.discordEmbed ?? buildStatusEmbed("needs_input", result?.text ?? `Current mode: ${current}`)],
        components: [buildModeButtons(current)],
      });
    },
  },
  {
    name: "cwd",
    description: "Show, update, or reset this chat's Codex workdir",
    options: [{ name: "path", description: "/cwd [path|reset]", type: 3 }],
    handler: async (interaction, ctx) => {
      const path = stringOption(interaction, "path");
      await editGatewayReply(interaction, ctx, "cwd", path ?? "");
    },
  },
  {
    name: "help",
    description: "List bridge-native Discord commands",
    handler: async (interaction, ctx) => {
      // Unified help: Discord-only commands not in gateway + merged entries
      const dcOnly: PlatformCommandMeta[] = COMMANDS
        .filter((c) => !GATEWAY_COMMANDS_SET.has(c.name) && c.name !== "help")
        .map((c) => ({ name: c.name, description: c.description }));
      const entries = buildHelpEntries("discord", dcOnly);
      const sections = new Map<string, typeof entries>();
      for (const entry of entries) {
        const list = sections.get(entry.section) ?? [];
        list.push(entry);
        sections.set(entry.section, list);
      }
      const fields = [...sections].map(([section, cmds]) => ({
        name: section,
        value: cmds.map((c) => `/${c.name}${c.args ? " " + c.args : ""} - ${c.description}`).join("\n"),
        inline: false,
      }));
      await ctx.api.editOriginalInteractionResponse(ctx.applicationId, interaction.token, {
        embeds: [capDiscordEmbed({ title: "Bridge Commands", fields, color: 0x2ecc71 })],
      });
    },
  },
];

export async function registerGlobalCommands(api: DiscordApi, appId: string): Promise<void> {
  const res = await api.registerGlobalCommands(
    appId,
    COMMANDS.map((command) => ({
      name: command.name,
      description: command.description,
      type: 1,
      options: command.options ?? [],
    })),
  );
  if (!res.ok) throw new Error(res.error ?? `Discord command registration failed (${res.status})`);
}

export function matchCommand(name: string): SlashCommandDef | null {
  return COMMANDS.find((command) => command.name === name) ?? null;
}

export function resolveInteractionBinding(interaction: Interaction, ctx: InteractionContext): BindingRow {
  const channelId = interaction.channel_id;
  return ctx.agentId !== null && ctx.agentId !== undefined
    ? ctx.db.getOrCreateAgentBinding(ctx.agentId, "discord", channelId, ctx.workdir)
    : ctx.db.getOrCreateBinding("discord", channelId, ctx.workdir);
}

export async function runTurnFromInteraction(
  interaction: Interaction,
  ctx: InteractionContext,
  text: string,
): Promise<void> {
  const binding = resolveInteractionBinding(interaction, ctx);
  await ctx.api.editOriginalInteractionResponse(ctx.applicationId, interaction.token, {
    embeds: [buildStatusEmbed("running", "Working. The full answer will be sent as a fresh message.")],
  });
  const result = await ctx.agentService.handleIncoming({
    kind: "discord",
    chatId: interaction.channel_id,
    text,
    workdir: binding.workdir || ctx.workdir,
    agentId: ctx.agentId ?? undefined,
    onApprovalRequest: (request) => sendApprovalRequest(interaction.channel_id, ctx, request),
  });
  if (result.ok && result.text) {
    await sendFormattedDiscordOutput(ctx.api, interaction.channel_id, result.text, ctx.log);
  }
  await ctx.api.editOriginalInteractionResponse(ctx.applicationId, interaction.token, {
    embeds: [
      buildStatusEmbed(result.ok ? "success" : "error", result.ok ? "Done. Answer sent below." : result.error ?? "No response."),
    ],
  });
}

async function sendApprovalRequest(
  channelId: string,
  ctx: InteractionContext,
  request: ApprovalRequest,
): Promise<void> {
  const formatted = formatApprovalForDiscord(request);
  const sent = await ctx.api.sendEmbed(channelId, "", formatted.embeds, formatted.components);
  if (sent.ok && sent.data?.id) {
    const messageId = sent.data.id;
    ctx.agentService.registerApprovalCleanup(request.id, async () => {
      const disabled = formatApprovalForDiscord(request, true);
      await ctx.api.editMessage(channelId, messageId, "", disabled.embeds, disabled.components);
    });
  }
}

export async function setEffortFromInteraction(
  interaction: Interaction,
  ctx: InteractionContext,
  value: string,
): Promise<void> {
  if (value === "reset") {
    await editGatewayReply(interaction, ctx, "effort", value);
    return;
  }
  if (!(AGENT_EFFORTS as readonly string[]).includes(value)) {
    return editCommandReply(ctx.api, ctx.applicationId, interaction, "error", `Effort must be one of ${AGENT_EFFORTS.join(", ")}.`);
  }
  await editGatewayReply(interaction, ctx, "effort", value);
}

export function updateBindingModel(interaction: Interaction, ctx: InteractionContext, model: string): boolean {
  const binding = resolveInteractionBinding(interaction, ctx);
  ctx.db.setBindingModel(binding.id, model);
  return true;
}

export function updateAgentMode(interaction: Interaction, ctx: InteractionContext, mode: string): "updated" | "invalid" | "legacy" | "missing" {
  if (!(AGENT_THREAD_MODES as readonly string[]).includes(mode)) return "invalid";
  const binding = resolveInteractionBinding(interaction, ctx);
  if (binding.agent_id === null) return "legacy";
  const agent = ctx.db.getAgent(binding.agent_id);
  if (!agent) return "missing";
  ctx.db.updateAgent(agent.id, { thread_mode: mode });
  return "updated";
}

function stringOption(interaction: Interaction, name: string): string | null {
  const option = interaction.data?.options?.find((entry) => entry.name === name);
  return typeof option?.value === "string" && option.value.trim() ? option.value.trim() : null;
}

async function editCommandReply(
  api: DiscordApi,
  appId: string,
  interaction: Interaction,
  state: StatusState,
  summary: string,
): Promise<void> {
  await api.editOriginalInteractionResponse(appId, interaction.token, {
    embeds: [buildStatusEmbed(state, summary)],
  });
}

function gatewayCtx(
  interaction: Interaction,
  ctx: InteractionContext,
  binding: BindingRow,
  args: string,
) {
  return {
    bindingId: binding.id,
    db: ctx.db,
    agentService: ctx.agentService,
    agentId: ctx.agentId ?? null,
    args,
    defaultWorkdir: ctx.workdir,
  };
}

async function editGatewayReply(
  interaction: Interaction,
  ctx: InteractionContext,
  command: string,
  args = "",
): Promise<GatewayCommandResult | null> {
  const binding = resolveInteractionBinding(interaction, ctx);
  const result = await dispatchGatewayCommand(command, gatewayCtx(interaction, ctx, binding, args));
  const text = result?.text ?? "Unknown bridge command.";
  if (result?.discordEmbed || result?.discordComponents) {
    await ctx.api.editOriginalInteractionResponse(ctx.applicationId, interaction.token, {
      embeds: result.discordEmbed ? [result.discordEmbed] : [buildStatusEmbed(gatewayState(text), text)],
      components: result.discordComponents,
    });
  } else {
    await editCommandReply(ctx.api, ctx.applicationId, interaction, gatewayState(text), text);
  }
  return result;
}

function gatewayState(text: string): StatusState {
  if (
    text.startsWith("Not a directory") ||
    text.startsWith("effort must") ||
    text.startsWith("No previous prompt") ||
    text.startsWith("No running turn") ||
    text.startsWith("❌")
  ) {
    return "needs_input";
  }
  return "success";
}
