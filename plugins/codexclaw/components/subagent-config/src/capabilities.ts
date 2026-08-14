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
  | "create_task";

/** V1 uses spawn_agent with items[]; V2 uses create_task with task_name. */
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
 * Detect spawn surface from environment signals.
 * V2 is the default for Codex >= 0.1.2025070100 (codex-rs multi_agents_spec v2).
 * V1 fallback when CODEXCLAW_SPAWN_V1=1 is set.
 */
export function detectSpawnSurface(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): SpawnSurface {
  if (env.CODEXCLAW_SPAWN_V1 === "1") return "v1";
  // Default to v2 — the shipped Codex runtime uses deny_unknown_fields on v2
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
    "spawn_agent", "create_task",
  ];
  const result: Record<string, CapabilityState> = {};
  for (const tool of allTools) {
    if (!exposedTools) {
      // fail-open: assume available when we cannot detect
      result[tool] = { available: true, source: null };
    } else {
      const found = exposedTools.includes(tool);
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
    spawnSurface: detectSpawnSurface(env),
    concurrency: resolveConcurrency(env),
    modelIds: deps.modelIds ?? [],
    ocxActive: deps.ocxActive ?? false,
  };
}
