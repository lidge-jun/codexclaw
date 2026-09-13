/**
 * capabilities.ts — runtime capability resolution (issue #7).
 *
 * One canonical resolver for non-frontend runtime surfaces. Resolves:
 *  - hosted discovery availability (web_search tool)
 *  - browser/proof capabilities
 *  - V1 vs V2 subagent spawn surface
 *  - effective concurrency limits
 *  - available model catalog
 *
 * Skills own workflow semantics (search proof ladder, Luna discovery lane,
 * PABCD dispatch contracts). This module owns exact tool/model/wire identities.
 */

/** Known tool capabilities the runtime may expose. */
export type ToolCapability =
  | "web_search"
  | "browser"
  | "apply_patch"
  | "exec_command"
  | "spawn_agent"
  | "followup_task";

/**
 * Both collab families register a tool named `spawn_agent`, so it discriminates
 * nothing: V1 (`multi_agent_v1`) takes `message`/`items`, V2 (namespace default
 * `collaboration`) requires `task_name` plus `message`. `followup_task` is
 * V2-only and is the signal used here. There is no tool called `create_task` in
 * either family.
 */
export type SpawnSurface = "v1" | "v2" | "unknown";

export interface CapabilityState {
  /** Whether a given tool is available. */
  available: boolean;
  /** null when unknown, "native" or "plugin" when detected. */
  source: "native" | "plugin" | null;
}

export interface ConcurrencyLimits {
  /** Max concurrent subagents. 0 = unknown/unlimited. */
  maxConcurrentAgents: number;
  /** Max concurrent web_search calls. 0 = unknown/unlimited. */
  maxConcurrentSearches: number;
}

export interface RuntimeCapabilities {
  /** Per-tool availability. */
  tools: Record<ToolCapability, CapabilityState>;
  /** Detected spawn surface. */
  spawnSurface: SpawnSurface;
  /** Effective concurrency limits. */
  concurrency: ConcurrencyLimits;
  /** Available model ids from the catalog. */
  modelIds: string[];
  /** Whether ocx (provider bridge) is active. */
  ocxActive: boolean;
}

/**
 * Collab tool names arrive either flat (`followup_task`) or with the namespace
 * prefixed. Two different renderings exist and both are real:
 *
 *  - hook-facing, concatenated without punctuation — `collaborationspawn_agent`,
 *    which is the form `spawn-attach-hook.ts` matches;
 *  - model-facing catalog, double-underscored — `multi_agent_v1__spawn_agent`,
 *    observed live in a Codex Desktop session on 2026-09-13.
 *
 * Single `.` and `_` are accepted defensively. Detection reads a catalog, so it
 * has to accept every rendering rather than pick one.
 */
function exposesTool(exposedTools: readonly string[], tool: string): boolean {
  const forms = [tool];
  for (const ns of ["collaboration", "multi_agent_v1"]) {
    forms.push(`${ns}${tool}`, `${ns}.${tool}`, `${ns}_${tool}`, `${ns}__${tool}`);
  }
  return exposedTools.some((name) => forms.includes(name));
}

/**
 * Detect spawn surface from environment signals.
 * An explicit CODEXCLAW_SPAWN_V1=1 always wins. Otherwise, when a live tool list
 * is supplied, decide from the family-exclusive tools. With no evidence — no list,
 * an empty list, or a list carrying neither family's marker — keep returning v2,
 * which is the shipped default.
 */
export function detectSpawnSurface(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  exposedTools?: readonly string[],
): SpawnSurface {
  if (env.CODEXCLAW_SPAWN_V1 === "1") return "v1";
  if (exposedTools && exposedTools.length > 0) {
    // V2-only follow-up/control tools.
    if (["followup_task", "interrupt_agent", "list_agents"].some((t) => exposesTool(exposedTools, t))) return "v2";
    // V1-only reuse/retirement tools.
    if (["send_input", "close_agent", "resume_agent"].some((t) => exposesTool(exposedTools, t))) return "v1";
    // spawn_agent and wait_agent exist in both families and prove nothing.
  }
  return "v2";
}

/**
 * Detect tool availability from a list of tool names the runtime exposes.
 * When no tool list is available, all tools default to available (fail-open).
 */
export function detectToolCapabilities(
  exposedTools?: string[],
): Record<ToolCapability, CapabilityState> {
  const allTools: ToolCapability[] = [
    "web_search", "browser", "apply_patch", "exec_command",
    "spawn_agent", "followup_task",
  ];
  const result: Record<string, CapabilityState> = {};
  for (const tool of allTools) {
    if (!exposedTools) {
      // fail-open: assume available when we cannot detect
      result[tool] = { available: true, source: null };
    } else {
      const found = exposesTool(exposedTools, tool);
      result[tool] = { available: found, source: found ? "native" : null };
    }
  }
  return result as Record<ToolCapability, CapabilityState>;
}

/**
 * Resolve concurrency limits.
 * Defaults: 4 concurrent agents, 3 concurrent searches.
 * Overridable via env: CODEXCLAW_MAX_AGENTS, CODEXCLAW_MAX_SEARCHES.
 */
export function resolveConcurrency(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): ConcurrencyLimits {
  const parseLimit = (val: string | undefined, fallback: number): number => {
    if (!val) return fallback;
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    maxConcurrentAgents: parseLimit(env.CODEXCLAW_MAX_AGENTS, 4),
    maxConcurrentSearches: parseLimit(env.CODEXCLAW_MAX_SEARCHES, 3),
  };
}

/**
 * Build the complete runtime capabilities snapshot.
 * Pure and deterministic — reads only env vars and optional injected state.
 */
export function resolveCapabilities(deps: {
  env?: Record<string, string | undefined>;
  exposedTools?: string[];
  modelIds?: string[];
  ocxActive?: boolean;
} = {}): RuntimeCapabilities {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  return {
    tools: detectToolCapabilities(deps.exposedTools),
    spawnSurface: detectSpawnSurface(env, deps.exposedTools),
    concurrency: resolveConcurrency(env),
    modelIds: deps.modelIds ?? [],
    ocxActive: deps.ocxActive ?? false,
  };
}
