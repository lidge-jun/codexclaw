import { readNativeCatalog } from "./catalog.ts";

export const ALIAS_MAP_DATE = "2026-10-09";
export const MODEL_ALIASES = {
  deepseek: "command-code/deepseek-deepseek-v4.1-flash-fast",
  swe2: "devin/swe-2",
  kimi: "kimi/k3",
  sol: "gpt-6.1-sol",
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

const PROBE = "Report your model and say OK; do not edit files.";
/** Where the resolver cell and the dispatch protocol live (L4 owner). */
export const DISPATCH_OWNER = "$codexclaw:cxc-pabcd delegation.md#sessionstart-dispatch-card";

/**
 * One Code Mode cell that finds the single spawn helper, tells the V1 and V2 families
 * apart by their companion tools, and spawns once. Kept verbatim in delegation.md
 * (a test compares them); the SessionStart card only points at it.
 */
export const RESOLVER_CELL = [
  "const n = ALL_TOOLS.map(t => t.name), has = r => n.some(x => r.test(x));",
  "const s = n.filter(x => /spawn_agent$/.test(x));",
  'if (s.length !== 1) throw new Error("expected one spawn_agent helper, found " + s.length);',
  "const v1 = has(/(send_input|close_agent|resume_agent)$/), v2 = has(/(followup_task|interrupt_agent|list_agents)$/);",
  'if (v1 === v2) throw new Error("collab family unresolved: v1=" + v1 + " v2=" + v2);',
  "const a = {message:" + JSON.stringify(PROBE) + ",model:" + JSON.stringify(MODEL_ALIASES.deepseek) + ',reasoning_effort:"low"};',
  'text(await tools[s[0]](v1 ? a : {...a, task_name:"model_probe", fork_turns:"none"}));',
].join("\n");

const V1_CARD = "[codexclaw] Subagent dispatch: V1 requested by CODEXCLAW_SPAWN_V1=1 (override, not host evidence). " +
  "Spawn with tools.multi_agent_v1__spawn_agent; managed fallback first. Protocol: " + DISPATCH_OWNER + ".";
const UNRESOLVED_CARD = "[codexclaw] Subagent dispatch: family unresolved at SessionStart. Before the first spawn, " +
  "run the resolver cell in " + DISPATCH_OWNER + "; managed fallback first.";

/** Hard cap on the card; the alias line is dropped before the core is ever cut. */
export const DISPATCH_CARD_MAX = 450;

export function renderDispatchCard(env: NodeJS.ProcessEnv = process.env): string {
  const core = env.CODEXCLAW_SPAWN_V1 === "1" ? V1_CARD : UNRESOLVED_CARD;
  if (core.length > DISPATCH_CARD_MAX) throw new Error("dispatch card core exceeds " + DISPATCH_CARD_MAX + " characters");
  const items = (Object.keys(MODEL_ALIASES) as ModelAlias[]).map((alias) => {
    const item = resolveDispatchAlias(alias, env);
    return alias + "=" + item.id + (item.verified ? "" : "?");
  });
  const card = core + "\nAliases (map " + ALIAS_MAP_DATE + ", ? = not in local catalog): " + items.join(", ");
  return card.length <= DISPATCH_CARD_MAX ? card : core;
}

