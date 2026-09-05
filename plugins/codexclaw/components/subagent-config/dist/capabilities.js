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








/** V1 uses spawn_agent with items[]; V2 uses create_task with task_name. */





























/**
 * Detect spawn surface from environment signals.
 * V2 is the default for Codex >= 0.1.2025070100 (codex-rs multi_agents_spec v2).
 * V1 fallback when CODEXCLAW_SPAWN_V1=1 is set.
 */
export function detectSpawnSurface(
  env                                     = process.env                                      ,
)               {
  if (env.CODEXCLAW_SPAWN_V1 === "1") return "v1";
  // Default to v2 — the shipped Codex runtime uses deny_unknown_fields on v2
  return "v2";
}

/**
 * Detect tool availability from a list of tool names the runtime exposes.
 * When no tool list is available, all tools default to available (fail-open).
 */
export function detectToolCapabilities(
  exposedTools           ,
)                                          {
  const allTools                   = [
    "web_search", "browser", "apply_patch", "exec_command",
    "spawn_agent", "create_task",
  ];
  const result                                  = {};
  for (const tool of allTools) {
    if (!exposedTools) {
      // fail-open: assume available when we cannot detect
      result[tool] = { available: true, source: null };
    } else {
      const found = exposedTools.includes(tool);
      result[tool] = { available: found, source: found ? "native" : null };
    }
  }
  return result                                           ;
}

/**
 * Resolve concurrency limits.
 * Defaults: 4 concurrent agents, 3 concurrent searches.
 * Overridable via env: CODEXCLAW_MAX_AGENTS, CODEXCLAW_MAX_SEARCHES.
 */
export function resolveConcurrency(
  env                                     = process.env                                      ,
)                    {
  const parseLimit = (val                    , fallback        )         => {
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
export function resolveCapabilities(deps




  = {})                      {
  const env = deps.env ?? (process.env                                      );
  return {
    tools: detectToolCapabilities(deps.exposedTools),
    spawnSurface: detectSpawnSurface(env),
    concurrency: resolveConcurrency(env),
    modelIds: deps.modelIds ?? [],
    ocxActive: deps.ocxActive ?? false,
  };
}
