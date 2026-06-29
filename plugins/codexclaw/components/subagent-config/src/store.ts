/**
 * store.ts — `.codexclaw/subagents.json` config store (L24 / 240-242).
 *
 * Per-role subagent model mode + prompt override for the three Phase-1 roles
 * (explorer/reviewer/executor). Missing file -> defaults; malformed values are
 * normalized per-field (strict reconstruct, never throws on read). Writes are
 * atomic (temp + rename). NEVER mutates global Codex config; default mode needs
 * no ocx (uses the main Codex model).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

export const STATE_DIR = ".codexclaw";
export const STORE_FILE = "subagents.json";
export const ROLES = ["explorer", "reviewer", "executor"] as const;
export type RoleName = (typeof ROLES)[number];

export type RoleMode = "default" | "model";

export interface RoleConfig {
  /** "default" = main Codex model; "model" = the selected `model` id. */
  mode: RoleMode;
  /** required when mode === "model"; ignored (null) when mode === "default". */
  model: string | null;
  /** role prompt-segment override; null means "no override" (never fabricated). */
  promptOverride: string | null;
}

export interface SubagentsConfig {
  roles: Record<RoleName, RoleConfig>;
}

export function defaultRole(): RoleConfig {
  return { mode: "default", model: null, promptOverride: null };
}

export function defaultConfig(): SubagentsConfig {
  return { roles: { explorer: defaultRole(), reviewer: defaultRole(), executor: defaultRole() } };
}

function storePath(cwd: string): string {
  return join(cwd, STATE_DIR, STORE_FILE);
}

/** Normalize one persisted role value into a valid RoleConfig (strict, total). */
function reconstructRole(raw: unknown): RoleConfig {
  if (!raw || typeof raw !== "object") return defaultRole();
  const r = raw as Record<string, unknown>;
  const mode: RoleMode = r.mode === "model" ? "model" : "default";
  // model only meaningful in "model" mode; coerce anything non-string to null.
  const model = mode === "model" && typeof r.model === "string" && r.model.length > 0 ? r.model : null;
  const promptOverride = typeof r.promptOverride === "string" ? r.promptOverride : null;
  // A "model" mode with no valid model is invalid -> fall back to default (fail safe).
  if (mode === "model" && model === null) return { mode: "default", model: null, promptOverride };
  return { mode, model, promptOverride };
}

/**
 * Read + normalize the config. Missing file -> defaults. Malformed JSON ->
 * defaults (never throws). Each role is strictly reconstructed.
 */
export function readConfig(cwd: string): SubagentsConfig {
  const path = storePath(cwd);
  if (!existsSync(path)) return defaultConfig();
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return defaultConfig();
  }
  const roles = (parsed && typeof parsed === "object" ? (parsed as { roles?: unknown }).roles : null) as
    | Record<string, unknown>
    | null
    | undefined;
  const out = defaultConfig();
  if (roles && typeof roles === "object") {
    for (const role of ROLES) out.roles[role] = reconstructRole(roles[role]);
  }
  return out;
}

/** Validate a role patch, returning an error message or null. */
export function validateRolePatch(patch: Partial<RoleConfig>): string | null {
  if (patch.mode !== undefined && patch.mode !== "default" && patch.mode !== "model") {
    return `invalid mode "${String(patch.mode)}" (must be "default" or "model")`;
  }
  if (patch.mode === "model" && !(typeof patch.model === "string" && patch.model.length > 0)) {
    return 'mode "model" requires a non-empty model id';
  }
  if (patch.promptOverride !== undefined && patch.promptOverride !== null && typeof patch.promptOverride !== "string") {
    return "promptOverride must be a string or null";
  }
  return null;
}

/** Atomic write: temp file then rename. Creates .codexclaw/ if needed. */
export function writeConfig(cwd: string, config: SubagentsConfig): void {
  const dir = join(cwd, STATE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = storePath(cwd);
  const tmp = `${path}.tmp`;
  try {
    writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`);
    renameSync(tmp, path);
  } catch (err) {
    try {
      if (existsSync(tmp)) rmSync(tmp);
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
}

/**
 * Apply a validated patch to one role and persist. Returns the updated config.
 * Throws on an invalid patch (caller surfaces the message).
 */
export function setRole(cwd: string, role: RoleName, patch: Partial<RoleConfig>): SubagentsConfig {
  if (!ROLES.includes(role)) throw new Error(`unknown role "${role}"`);
  const err = validateRolePatch(patch);
  if (err) throw new Error(err);
  const config = readConfig(cwd);
  const next: RoleConfig = { ...config.roles[role], ...patch };
  // enforce the default-mode invariant: default mode ignores model.
  if (next.mode === "default") next.model = null;
  config.roles[role] = next;
  writeConfig(cwd, config);
  return config;
}

export interface SpawnResolution {
  role: RoleName;
  /** model id to spawn with, or null to inherit the main Codex model. */
  model: string | null;
  /** true when this role inherits the main model (default mode). */
  usesMainModel: boolean;
  promptOverride: string | null;
}

/** Resolve how a role should be spawned given the current config. */
export function resolveSpawnConfig(cwd: string, role: RoleName): SpawnResolution {
  const cfg = readConfig(cwd).roles[role];
  const usesMainModel = cfg.mode === "default";
  return {
    role,
    model: usesMainModel ? null : cfg.model,
    usesMainModel,
    promptOverride: cfg.promptOverride,
  };
}
