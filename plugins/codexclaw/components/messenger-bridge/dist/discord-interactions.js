



import { buildActionRow, buildStatusEmbed } from "./discord-components.js";

import {
  matchCommand,
  resolveInteractionBinding,
  runTurnFromInteraction,
  setEffortFromInteraction,
  updateAgentMode,
  updateAgentToolProgress,
  updateBindingModel,
} from "./discord-commands.js";








































export async function handleInteraction(interaction             , ctx                    )                {
  if (interaction.type === 1) {
    const result = await ctx.api.createInteractionResponse(interaction.id, interaction.token, { type: 1 });
    checkDiscordResult("PING response", result);
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
      await reportInteractionFailure(interaction, ctx, err);
    }
    return;
  }

  if (interaction.type === 3) {
    if (!ctx.deferred) await deferReply(ctx.api, interaction.id, interaction.token);
    try {
      await handleComponentInteraction(interaction, ctx);
    } catch (err) {
      await reportInteractionFailure(interaction, ctx, err);
    }
    return;
  }

  const result = await ctx.api.createInteractionResponse(interaction.id, interaction.token, {
    type: 4,
    data: { content: "Unsupported Discord interaction type.", flags: 64 },
  });
  checkDiscordResult("unsupported interaction response", result);
}

export async function deferReply(api            , id        , token        )                {
  const result = await api.createInteractionResponse(id, token, { type: 5 });
  checkDiscordResult("interaction defer", result);
}

export async function editDeferredReply(
  api            ,
  appId        ,
  token        ,
  data         ,
)                {
  const result = await api.editOriginalInteractionResponse(appId, token, data);
  checkDiscordResult("deferred interaction edit", result);
}

function checkDiscordResult(action        , result                                                 )       {
  if (!result.ok) throw new Error(result.error ?? `${action} failed (${result.status})`);
}

async function reportInteractionFailure(
  interaction             ,
  ctx                    ,
  originalError         ,
)                {
  const message = originalError instanceof Error ? originalError.message : String(originalError);
  try {
    await editDeferredReply(ctx.api, ctx.applicationId, interaction.token, {
      embeds: [buildStatusEmbed("error", message)],
    });
  } catch (editError) {
    const editMessage = editError instanceof Error ? editError.message : String(editError);
    ctx.log?.(`[discord] interaction failed: ${message}; error edit failed: ${editMessage}`);
  }
}

async function handleComponentInteraction(interaction             , ctx                    )                {
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

  if (customId === "tool_progress_select") {
    const mode = selectedValue(interaction) ?? "";
    const status = updateAgentToolProgress(interaction, ctx, mode);
    await editDeferredReply(ctx.api, ctx.applicationId, interaction.token, {
      embeds: [buildStatusEmbed(
        status === "updated" ? "success" : "needs_input",
        toolProgressStatusText(status, mode),
      )],
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

function selectedValue(interaction             )                {
  const value = interaction.data?.values?.[0];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseApprovalCustomId(
  customId        ,
)                                                                          {
  const [, id, decision] = customId.split(":");
  if (!id) return null;
  if (decision === "allow-once" || decision === "allow-always" || decision === "deny") {
    return { id, decision };
  }
  return null;
}

function approvalStatusText(
  status                                           ,
  decision                                        ,
)         {
  switch (status) {
    case "resolved":
      return `Approval ${decision}.`;
    case "unauthorized":
      return "This approval belongs to another chat or agent.";
    case "not_found":
      return "Approval not found or already resolved.";
  }
}

function modeStatusText(status                                              , mode        )         {
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

function toolProgressStatusText(status                                              , mode        )         {
  switch (status) {
    case "updated": return `Tool progress set to ${mode}.`;
    case "invalid": return "Unknown tool progress.";
    case "legacy": return "Tool progress requires a named agent.";
    case "missing": return "Agent not found.";
  }
}
