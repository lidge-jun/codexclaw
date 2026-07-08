import type { AgentService } from "./agent-service.ts";
import type { BridgeDb } from "./db.ts";
import type { DiscordApi } from "./discord-api.ts";
import type { CatalogEntry } from "./discord-components.ts";
import { buildActionRow, buildStatusEmbed } from "./discord-components.ts";
import {
  matchCommand,
  resolveInteractionBinding,
  runTurnFromInteraction,
  setEffortFromInteraction,
  updateAgentMode,
  updateBindingModel,
} from "./discord-commands.ts";

export type InteractionType = 1 | 2 | 3 | 5;

export interface InteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
}

export interface InteractionData {
  id?: string;
  name?: string;
  custom_id?: string;
  component_type?: number;
  values?: string[];
  options?: InteractionOption[];
}

export interface Interaction {
  id: string;
  type: InteractionType;
  token: string;
  data?: InteractionData;
  channel_id: string;
  guild_id?: string;
}

export interface InteractionContext {
  db: BridgeDb;
  agentService: AgentService;
  api: DiscordApi;
  applicationId: string;
  workdir: string;
  agentId?: number | null;
  modelCatalog?: CatalogEntry[];
  deferred?: boolean;
  log?: (line: string) => void;
}

export async function handleInteraction(interaction: Interaction, ctx: InteractionContext): Promise<void> {
  if (interaction.type === 1) {
    await ctx.api.createInteractionResponse(interaction.id, interaction.token, { type: 1 });
    return;
  }

  if (interaction.type === 2) {
    if (!ctx.deferred) await deferReply(ctx.api, interaction.id, interaction.token);
    const command = matchCommand(interaction.data?.name ?? "");
    if (!command) {
      await editDeferredReply(ctx.api, ctx.applicationId, interaction.token, {
        embeds: [buildStatusEmbed("error", "Unknown bridge command.")],
      });
      return;
    }
    try {
      await command.handler(interaction, ctx);
    } catch (err) {
      await editDeferredReply(ctx.api, ctx.applicationId, interaction.token, {
        embeds: [buildStatusEmbed("error", err instanceof Error ? err.message : String(err))],
      });
    }
    return;
  }

  if (interaction.type === 3) {
    if (!ctx.deferred) await deferReply(ctx.api, interaction.id, interaction.token);
    try {
      await handleComponentInteraction(interaction, ctx);
    } catch (err) {
      await editDeferredReply(ctx.api, ctx.applicationId, interaction.token, {
        embeds: [buildStatusEmbed("error", err instanceof Error ? err.message : String(err))],
      });
    }
    return;
  }

  await ctx.api.createInteractionResponse(interaction.id, interaction.token, {
    type: 4,
    data: { content: "Unsupported Discord interaction type.", flags: 64 },
  });
}

export async function deferReply(api: DiscordApi, id: string, token: string): Promise<void> {
  await api.createInteractionResponse(id, token, { type: 5 });
}

export async function editDeferredReply(
  api: DiscordApi,
  appId: string,
  token: string,
  data: unknown,
): Promise<void> {
  await api.editOriginalInteractionResponse(appId, token, data);
}

async function handleComponentInteraction(interaction: Interaction, ctx: InteractionContext): Promise<void> {
  const customId = interaction.data?.custom_id ?? "";
  if (customId === "model_select") {
    const value = selectedValue(interaction);
    if (!value) return editDeferredReply(ctx.api, ctx.applicationId, interaction.token, { content: "No model selected." });
    const ok = updateBindingModel(interaction, ctx, value);
    await editDeferredReply(ctx.api, ctx.applicationId, interaction.token, {
      embeds: [
        buildStatusEmbed(
          ok ? "success" : "needs_input",
          ok ? `Model set to ${value}.` : "Model changes are unavailable for this chat.",
        ),
      ],
    });
    return;
  }

  if (customId === "effort_select") {
    const value = selectedValue(interaction);
    if (!value) return editDeferredReply(ctx.api, ctx.applicationId, interaction.token, { content: "No effort selected." });
    await setEffortFromInteraction(interaction, ctx, value);
    return;
  }

  if (customId.startsWith("mode_select:")) {
    const mode = customId.slice("mode_select:".length);
    const status = updateAgentMode(interaction, ctx, mode);
    await editDeferredReply(ctx.api, ctx.applicationId, interaction.token, {
      embeds: [
        buildStatusEmbed(
          status === "updated" ? "success" : "needs_input",
          modeStatusText(status, mode),
        ),
      ],
    });
    return;
  }

  if (customId.startsWith("retry")) {
    const binding = resolveInteractionBinding(interaction, ctx);
    const last = ctx.db.listJobs(binding.id, 1)[0];
    if (!last?.prompt_preview) {
      await editDeferredReply(ctx.api, ctx.applicationId, interaction.token, {
        embeds: [buildStatusEmbed("error", "No previous prompt is available to retry.")],
      });
      return;
    }
    await runTurnFromInteraction(interaction, ctx, last.prompt_preview);
    return;
  }

  if (customId.startsWith("cancel")) {
    const binding = resolveInteractionBinding(interaction, ctx);
    const stopped = ctx.agentService.cancelTurn(binding.id);
    await editDeferredReply(ctx.api, ctx.applicationId, interaction.token, {
      embeds: [buildStatusEmbed(stopped ? "success" : "needs_input", stopped ? "Stop requested for the current turn." : "No running turn for this chat.")],
    });
    return;
  }

  if (customId.startsWith("approval:")) {
    const parsed = parseApprovalCustomId(customId);
    if (!parsed) {
      await editDeferredReply(ctx.api, ctx.applicationId, interaction.token, {
        embeds: [buildStatusEmbed("error", "Invalid approval action.")],
      });
      return;
    }
    const status = ctx.agentService.resolveApproval({
      id: parsed.id,
      decision: parsed.decision,
      chatId: interaction.channel_id,
      agentId: ctx.agentId ?? null,
    });
    await editDeferredReply(ctx.api, ctx.applicationId, interaction.token, {
      embeds: [
        buildStatusEmbed(
          status === "resolved" ? "success" : "needs_input",
          approvalStatusText(status, parsed.decision),
        ),
      ],
    });
    return;
  }

  if (customId.startsWith("approve") || customId.startsWith("deny")) {
    await editDeferredReply(ctx.api, ctx.applicationId, interaction.token, {
      embeds: [buildStatusEmbed("needs_input", "Approval relay is not wired in this phase.")],
      components: [buildActionRow([{ label: "Cancel", style: 2, customId: "cancel" }])],
    });
    return;
  }

  await editDeferredReply(ctx.api, ctx.applicationId, interaction.token, {
    embeds: [buildStatusEmbed("error", "Unknown component action.")],
  });
}

function selectedValue(interaction: Interaction): string | null {
  const value = interaction.data?.values?.[0];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseApprovalCustomId(
  customId: string,
): { id: string; decision: "allow-once" | "allow-always" | "deny" } | null {
  const [, id, decision] = customId.split(":");
  if (!id) return null;
  if (decision === "allow-once" || decision === "allow-always" || decision === "deny") {
    return { id, decision };
  }
  return null;
}

function approvalStatusText(
  status: "resolved" | "not_found" | "unauthorized",
  decision: "allow-once" | "allow-always" | "deny",
): string {
  switch (status) {
    case "resolved":
      return `Approval ${decision}.`;
    case "unauthorized":
      return "This approval belongs to another chat or agent.";
    case "not_found":
      return "Approval not found or already resolved.";
  }
}

function modeStatusText(status: "updated" | "invalid" | "legacy" | "missing", mode: string): string {
  switch (status) {
    case "updated":
      return `Mode set to ${mode}.`;
    case "invalid":
      return "Unknown mode.";
    case "legacy":
      return "Mode requires a named agent.";
    case "missing":
      return "Agent not found.";
  }
}
