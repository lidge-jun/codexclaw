/**
 * spawn-wrapper.ts — production spawn payload builder (L9.1 / 091).
 *
 * Turns the shipped per-role config (resolveSpawnConfig) + a role TOML's
 * developer_instructions into a concrete Codex `spawn_agent` payload, closing the
 * L9 gap where the resolver existed but nothing consumed it at spawn time.
 *
 * Contract (omo B-opt2 parity, agents/README.md):
 *  - role -> built-in agent_type (explorer/reviewer -> "explorer", executor -> "worker");
 *    the wrapper NEVER invents a role name (codex plugins can't register roles).
 *  - the role prompt is injected INLINE in the message ("TASK: ..."), since plugin
 *    install dirs are not a config layer.
 *  - model selection comes from the STORE resolver, not the TOML: `model = "default"`
 *    in the TOML is a Phase-1 inherit sentinel; the durable per-role model lives in
 *    `.codexclaw/subagents.json`. So this module reads ONLY developer_instructions from
 *    the TOML and takes the effective model from `resolveSpawnConfig`.
 *  - default mode (usesMainModel) OMITS the `model` key so the subagent inherits the
 *    main Codex model; an explicit `promptOverride` REPLACES the TOML instructions.
 *
 * Zero third-party deps (node:* only) so the build's type-strip stays sound.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveSpawnConfig, type RoleName, type SpawnResolution } from "./store.ts";

/** Built-in codex agent_type each canonical role maps to (core/src/agent/role.rs). */
export const ROLE_AGENT_TYPE: Record<RoleName, "explorer" | "worker"> = {
  explorer: "explorer",
  reviewer: "explorer",
  executor: "worker",
};

export interface RoleTomlFields {
  /** The TOML `model` value (usually the "default" inherit sentinel). Informational
   *  only — the store resolver owns the effective model. null when absent/empty. */
  model: string | null;
  /** The triple-quoted developer_instructions body (trimmed). "" when absent. */
  developerInstructions: string;
}

/**
 * Narrow field reader for a codexclaw role TOML — NOT a general TOML parser. Extracts
 * the simple `model = "..."` scalar and the `developer_instructions = """..."""`
 * triple-quoted block. Total: malformed/missing input yields safe defaults.
 *
 * The triple-quote split is safe because the role bodies never contain a literal
 * triple-quote (verified across explorer/reviewer/executor.toml); a future body that
 * needed one would have to escape it, which TOML forbids anyway.
 */
export function parseRoleToml(text: string): RoleTomlFields {
  const src = typeof text === "string" ? text : "";
  let model: string | null = null;
  // `model = "value"` — first occurrence at a line start (ignore trailing comments).
  const modelMatch = /^\s*model\s*=\s*"([^"]*)"/m.exec(src);
  if (modelMatch && modelMatch[1].length > 0) model = modelMatch[1];

  let developerInstructions = "";
  const open = src.indexOf('developer_instructions');
  if (open !== -1) {
    const firstTriple = src.indexOf('"""', open);
    if (firstTriple !== -1) {
      const bodyStart = firstTriple + 3;
      const closeTriple = src.indexOf('"""', bodyStart);
      if (closeTriple !== -1) {
        developerInstructions = src.slice(bodyStart, closeTriple).trim();
      }
    }
  }
  return { model, developerInstructions };
}

/** Read + parse `<agentsDir>/<role>.toml`. Missing file -> safe defaults (never throws). */
export function readRoleToml(agentsDir: string, role: RoleName): RoleTomlFields {
  try {
    const path = join(agentsDir, `${role}.toml`);
    if (!existsSync(path)) return { model: null, developerInstructions: "" };
    return parseRoleToml(readFileSync(path, "utf8"));
  } catch {
    return { model: null, developerInstructions: "" };
  }
}

/** Concrete Codex `spawn_agent` payload (the subset codexclaw controls). */
export interface SpawnPayload {
  agent_type: "explorer" | "worker";
  message: string;
  /** Present ONLY when a non-default model was configured; absent = inherit main model. */
  model?: string;
}

export interface BuildSpawnPayloadInput {
  role: RoleName;
  /** The concrete task text the subagent must perform. */
  task: string;
  /** Output of resolveSpawnConfig (owns the effective model + promptOverride). */
  resolution: SpawnResolution;
  /** developer_instructions from the role TOML (used unless promptOverride replaces it). */
  developerInstructions: string;
}

/**
 * PURE builder: compose the spawn_agent payload. The effective role prompt is the
 * promptOverride when set, else the TOML developer_instructions. The model key is
 * included only for a non-default (model-mode) resolution with a real id.
 */
export function buildSpawnPayload(input: BuildSpawnPayloadInput): SpawnPayload {
  const { role, task, resolution, developerInstructions } = input;
  const agent_type = ROLE_AGENT_TYPE[role];
  const rolePrompt = (resolution.promptOverride ?? developerInstructions ?? "").trim();
  const taskText = (task ?? "").trim();
  const message = rolePrompt.length > 0 ? `${rolePrompt}\n\nTASK: ${taskText}` : `TASK: ${taskText}`;
  const payload: SpawnPayload = { agent_type, message };
  if (!resolution.usesMainModel && typeof resolution.model === "string" && resolution.model.length > 0) {
    payload.model = resolution.model;
  }
  return payload;
}

/**
 * Production entry point: resolve the role config from `.codexclaw/subagents.json`,
 * read the role TOML developer_instructions, and build the spawn payload. Never throws.
 */
export function resolveSpawnPayload(cwd: string, role: RoleName, task: string, agentsDir: string): SpawnPayload {
  const resolution = resolveSpawnConfig(cwd, role);
  const { developerInstructions } = readRoleToml(agentsDir, role);
  return buildSpawnPayload({ role, task, resolution, developerInstructions });
}
