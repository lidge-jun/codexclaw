import { DISCORD_EMBED_TOTAL_MAX,                   } from "./discord-api.js";

export const STATUS_COLORS = {
  queued: 0x95a5a6,
  running: 0xf39c12,
  success: 0x2ecc71,
  error: 0xe74c3c,
  needs_input: 0x3498db,
}         ;














































const EMBED_DESCRIPTION_LIMIT = 4096;
const EMBED_FIELD_VALUE_LIMIT = 1024;
const EMBED_FIELD_NAME_LIMIT = 256;
const EMBED_FIELD_LIMIT = 25;
const LABEL_LIMIT = 100;

export function buildStatusEmbed(
  state             ,
  summary        ,
  details                         = {},
)               {
  const fields = Object.entries(details)
    .filter(([name]) => name.trim().length > 0)
    .slice(0, 25)
    .map(([name, value]) => ({
      name: truncate(name, 256),
      value: truncate(value || "-", EMBED_FIELD_VALUE_LIMIT),
      inline: value.length <= 40,
    }));
  return {
    title: statusTitle(state),
    description: truncate(summary || "-", EMBED_DESCRIPTION_LIMIT),
    color: STATUS_COLORS[state],
    fields,
  };
}

export function capDiscordEmbed(embed              )               {
  const capped               = {
    ...embed,
    title: embed.title ? truncate(embed.title, EMBED_FIELD_NAME_LIMIT) : undefined,
    description: embed.description ? truncate(embed.description, EMBED_DESCRIPTION_LIMIT) : undefined,
  };
  const sourceFields = embed.fields ?? [];
  const fields = sourceFields.slice(0, EMBED_FIELD_LIMIT).map((field) => ({
    ...field,
    name: truncate(field.name || "-", EMBED_FIELD_NAME_LIMIT),
    value: truncate(field.value || "-", EMBED_FIELD_VALUE_LIMIT),
  }));
  const overflow = sourceFields.length - fields.length;
  if (overflow > 0) {
    fields[EMBED_FIELD_LIMIT - 1] = {
      name: `+${overflow + 1} more`,
      value: "Additional fields were omitted.",
      inline: false,
    };
  }

  const budgeted                = [];
  let used = embedTextLength(capped.title) + embedTextLength(capped.description);
  for (const field of fields) {
    const cost = embedTextLength(field.name) + embedTextLength(field.value);
    if (used + cost > DISCORD_EMBED_TOTAL_MAX) {
      const remaining = DISCORD_EMBED_TOTAL_MAX - used - embedTextLength(field.name);
      if (remaining > 3) {
        budgeted.push({ ...field, value: truncate(field.value, remaining) });
      }
      break;
    }
    budgeted.push(field);
    used += cost;
  }
  capped.fields = budgeted.length > 0 ? budgeted : undefined;
  return capped;
}

export function buildActionRow(buttons               )            {
  return {
    type: 1,
    components: buttons.slice(0, 5).map((button) => ({
      type: 2,
      label: truncate(button.label, LABEL_LIMIT),
      style: button.style,
      custom_id: truncate(button.customId, LABEL_LIMIT),
      disabled: button.disabled || undefined,
    })),
  };
}

export function buildModelSelect(catalog                , current        )            {
  return buildSelectRow("model_select", `Model: ${current || "default"}`, normalizeCatalog(catalog, current));
}

export function buildEffortSelect(efforts                   , current        )            {
  const catalog = efforts.map((effort) => ({ id: effort, label: effort }));
  return buildSelectRow("effort_select", `Effort: ${current || "default"}`, normalizeCatalog(catalog, current));
}

export function buildModeButtons(current        )            {
  return buildActionRow([
    { label: `${current === "thread" ? "* " : ""}Thread`, style: current === "thread" ? 1 : 2, customId: "mode_select:thread" },
    { label: `${current === "plain" ? "* " : ""}Plain`, style: current === "plain" ? 1 : 2, customId: "mode_select:plain" },
  ]);
}

export function buildApprovalCard(params




 )                                                      {
  return {
    embeds: [
      buildStatusEmbed("needs_input", "Approval required before Codex can run.", {
        ID: params.id,
        Prompt: params.promptHash,
        Cwd: params.workdir,
      }),
    ],
    components: [
      buildActionRow([
        { label: "Allow once", style: 3, customId: `approval:${params.id}:allow-once`, disabled: params.disabled },
        { label: "Allow always", style: 1, customId: `approval:${params.id}:allow-always`, disabled: params.disabled },
        { label: "Deny", style: 4, customId: `approval:${params.id}:deny`, disabled: params.disabled },
      ]),
    ],
  };
}

function buildSelectRow(customId        , placeholder        , options                      )            {
  return {
    type: 1,
    components: [
      {
        type: 3,
        custom_id: customId,
        placeholder: truncate(placeholder, 150),
        min_values: 1,
        max_values: 1,
        options,
      },
    ],
  };
}

function normalizeCatalog(catalog                , current        )                       {
  const seen = new Set        ();
  const entries = [...catalog];
  if (current && !entries.some((entry) => entry.id === current)) {
    entries.unshift({ id: current, label: current });
  }
  return entries
    .filter((entry) => entry.id.trim().length > 0)
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .slice(0, 25)
    .map((entry) => ({
      label: truncate(entry.label ?? entry.id, LABEL_LIMIT),
      value: truncate(entry.id, LABEL_LIMIT),
      description: entry.description ? truncate(entry.description, LABEL_LIMIT) : undefined,
      default: entry.id === current || undefined,
    }));
}

function statusTitle(state             )         {
  switch (state) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "success":
      return "Done";
    case "error":
      return "Error";
    case "needs_input":
      return "Needs Input";
  }
}

function truncate(value        , limit        )         {
  if (value.length <= limit) return value;
  if (limit <= 3) return value.slice(0, limit);
  return value.slice(0, limit - 3) + "...";
}

function embedTextLength(value                    )         {
  return value?.length ?? 0;
}
