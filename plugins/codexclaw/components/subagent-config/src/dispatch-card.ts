import { readNativeCatalog } from "./catalog.ts";

export const ALIAS_MAP_DATE = "2026-09-24";
export const MODEL_ALIASES = {
  deepseek: "command-code/deepseek-deepseek-v4.1-flash",
  swe2: "devin/swe-2",
  kimi: "kimi/kimi-for-coding-highspeed",
  sol: "gpt-6-sol",
  luna: "gpt-6-luna",
} as const;
export type ModelAlias = keyof typeof MODEL_ALIASES;
export interface ResolvedAlias { id: string; verified: boolean; mapDate: string }

export function resolveDispatchAlias(nameOrId: string, env: NodeJS.ProcessEnv = process.env): ResolvedAlias {
  if (!Object.prototype.hasOwnProperty.call(MODEL_ALIASES, nameOrId)) {
    return { id: nameOrId, verified: false, mapDate: ALIAS_MAP_DATE };
  }
  const id = MODEL_ALIASES[nameOrId as ModelAlias];
  const entries = readNativeCatalog(env);
  return { id, verified: entries?.some(entry => entry.id === id) ?? false, mapDate: ALIAS_MAP_DATE };
}

const PROBE = 'Report your model and say OK; do not edit files.';
const V1_CARD = `[codexclaw] Subagent dispatch: V1 requested by CODEXCLAW_SPAWN_V1=1 (override, not host evidence).
Code Mode first cell: await tools.multi_agent_v1__spawn_agent({message:${JSON.stringify(PROBE)},model:"command-code/deepseek-deepseek-v4.1-flash",reasoning_effort:"low"});
Direct: multi_agent_v1.spawn_agent({message,model?,reasoning_effort?}); wait: tools.multi_agent_v1__wait_agent({targets:[agent_id],timeout_ms}); close: tools.multi_agent_v1__close_agent({target:agent_id}). Replace the probe message with the task; obey managed fallback dispatch first.`;
const UNRESOLVED_CARD = `[codexclaw] Subagent dispatch: family unresolved at SessionStart. Replace the probe message/task_name for real work; obey managed fallback dispatch first. First Code Mode cell (resolves and calls):
const matches = ALL_TOOLS.filter(x => x.name.endsWith("spawn_agent"));
if (matches.length !== 1) throw new Error("expected one spawn_agent helper, found " + matches.length);
const name = matches[0].name;
const v1 = name.includes("multi_agent_v1");
if (!v1 && !name.includes("collaboration")) throw new Error("unknown spawn family: " + name);
const common = {message:"Report your model and say OK; do not edit files.",model:"command-code/deepseek-deepseek-v4.1-flash",reasoning_effort:"low"};
const args = v1 ? common : {task_name:"model-probe-" + Date.now(),...common};
text(await tools[name](args));`;

export function renderDispatchCard(env: NodeJS.ProcessEnv = process.env): string {
  const core = env.CODEXCLAW_SPAWN_V1 === "1" ? V1_CARD : UNRESOLVED_CARD;
  if (core.length > 1200) throw new Error("dispatch card core exceeds 1200 characters");
  let card = core + `\nAliases (map ${ALIAS_MAP_DATE}; local Codex catalog membership only):`;
  for (const alias of Object.keys(MODEL_ALIASES) as ModelAlias[]) {
    const item = resolveDispatchAlias(alias, env);
    const line = `\n${alias} -> ${item.id} (${item.verified ? "verified in local catalog" : `unverified, map ${ALIAS_MAP_DATE}`})`;
    if (card.length + line.length > 1200) break;
    card += line;
  }
  return card.length <= 1200 ? card : core;
}
