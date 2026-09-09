/**
 * store.ts — `.codexclaw/subagents.json` config store (L24 / 240-242).
 *
 * Per-role subagent model mode + prompt override for the configurable roles
 * (explorer/reviewer/executor/architect). Missing file -> defaults; malformed values are
 * normalized per-field (strict reconstruct, never throws on read). Writes are
 * atomic (temp + rename). User defaults live in CODEXCLAW_HOME; native
 * Codex config is never mutated. Default mode needs
 * no ocx (uses the main Codex model).
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { renameWithRetry } from "./atomic-write.ts";

export const STATE_DIR = ".codexclaw";
export const STORE_FILE = "subagents.json";
export const ROLES = ["explorer", "reviewer", "executor", "architect"] as const;
export type RoleName = (typeof ROLES)[number];

export type RoleMode = "default" | "model";

/**
 * Valid spawn reasoning-effort wire values (codex-rs ReasoningEffort, lowercase
 * serde: protocol/src/openai_models.rs — "xhigh", not "x-high"). null = inherit
 * the parent session's effort (the jawcode/cli-jaw policy default). An invalid
 * effort HARD-FAILS the spawn on the codex side, so the store validates on write.
 */
// Supported wire values retained for backward compatibility. Model capabilities vary;
// the dashboard narrows these options using the current catalog's reasoningEfforts.
export const EFFORTS = ["low", "medium", "high", "xhigh"] as const;
export type EffortName = (typeof EFFORTS)[number];

export interface RoleConfig {
  /** "default" = main Codex model; "model" = the selected `model` id. */
  mode: RoleMode;
  /** required when mode === "model"; ignored (null) when mode === "default". */
  model: string | null;
  /** reasoning-effort override; null = inherit the parent session's effort. */
  effort: EffortName | null;
  /** role prompt-segment override; null means "no override" (never fabricated). */
  promptOverride: string | null;
}

export interface SubagentsConfig {
  roles: Record<RoleName, RoleConfig>;
}

export function defaultRole(): RoleConfig {
  return { mode: "default", model: null, effort: null, promptOverride: null };
}

export function defaultConfig(): SubagentsConfig {
  return { roles: { explorer: defaultRole(), reviewer: defaultRole(), executor: defaultRole(), architect: defaultRole() } };
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
  // effort: only a known wire value survives; anything else -> null (inherit).
  const effort = (EFFORTS as readonly string[]).includes(r.effort as string) ? (r.effort as EffortName) : null;
  const promptOverride = typeof r.promptOverride === "string" ? r.promptOverride : null;
  // A "model" mode with no valid model is invalid -> fall back to default (fail safe).
  if (mode === "model" && model === null) return { mode: "default", model: null, effort, promptOverride };
  return { mode, model, effort, promptOverride };
}

export type ConfigScope = "project" | "global";
export type ConfigSource = ConfigScope | "session";
export interface SubagentSettings extends SubagentsConfig {
  scope: ConfigScope;
  sources: Record<RoleName, ConfigSource>;
  overrides: Record<RoleName, boolean>;
  trustWarning?: string;
}

export function configScope(value: unknown = "project"): ConfigScope {
  if (value !== "project" && value !== "global") throw new Error(`invalid scope "${String(value)}"`);
  return value;
}

export function cxcHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.CODEXCLAW_HOME?.trim() || join(homedir(), ".codexclaw");
}

export function globalStorePath(env: NodeJS.ProcessEnv = process.env): string {
  return join(cxcHome(env), STORE_FILE);
}

/** Compatibility with the unpublished first scoped-settings patch. Reads never migrate. */
function readGlobalRaw(env: NodeJS.ProcessEnv, forWrite = false): RawConfig {
  const canonical = globalStorePath(env);
  if (!existsSync(canonical) && !env.CODEXCLAW_HOME?.trim()) {
    const legacy = join(env.CODEX_HOME?.trim() || join(homedir(), ".codex"), "codexclaw", STORE_FILE);
    if (existsSync(legacy)) return readRaw(legacy, forWrite);
  }
  return readRaw(canonical, forWrite);
}

function scopedPath(cwd: string, scope: ConfigScope, env: NodeJS.ProcessEnv): string {
  return configScope(scope) === "global" ? globalStorePath(env) : storePath(cwd);
}

type RawConfig = Record<string, unknown> & { roles: Record<string, unknown> };
function readRaw(path: string, forWrite = false): RawConfig {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("config must be an object");
    const raw = parsed as Record<string, unknown>;
    if (raw.roles !== undefined && (!raw.roles || typeof raw.roles !== "object" || Array.isArray(raw.roles))) {
      throw new Error("roles must be an object");
    }
    return { ...raw, roles: { ...(raw.roles as Record<string, unknown> | undefined) } };
  } catch (err) {
    if (forWrite && (err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`cannot update subagent config: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { roles: {} };
  }
}

function projectTrustWarning(cwd: string, env: NodeJS.ProcessEnv): string | undefined {
  if (!isTrackedProjectConfig(cwd)) return undefined;
  const token = projectConfigTrustToken(cwd);
  if (token !== null && env.CODEXCLAW_TRUST_PROJECT_SUBAGENTS === token) return undefined;
  return "ignored Git-tracked .codexclaw/subagents.json; review it, then run `cxc subagents trust-token` and export the printed project-bound value";
}

/** Resolve whole roles, preserving explicit null as original-session inheritance. */
export function readSettings(cwd: string, scope: ConfigScope = "project", env: NodeJS.ProcessEnv = process.env): SubagentSettings {
  configScope(scope);
  const global = readGlobalRaw(env);
  const project = scope === "project" ? readRaw(storePath(cwd)) : { roles: {} };
  const trustWarning = scope === "project" ? projectTrustWarning(cwd, env) : undefined;
  const out: SubagentSettings = {
    ...defaultConfig(), scope,
    sources: { explorer: "session", reviewer: "session", executor: "session", architect: "session" },
    overrides: { explorer: false, reviewer: false, executor: false, architect: false },
    ...(trustWarning ? { trustWarning } : {}),
  };
  for (const role of ROLES) {
    out.overrides[role] = Object.hasOwn((scope === "project" ? project : global).roles, role);
    if (Object.hasOwn(global.roles, role)) {
      out.roles[role] = reconstructRole(global.roles[role]);
      out.sources[role] = "global";
    }
    if (!trustWarning && Object.hasOwn(project.roles, role)) {
      out.roles[role] = reconstructRole(project.roles[role]);
      out.sources[role] = "project";
    }
  }
  return out;
}

/** Effective config without UI metadata; reads never change persisted settings. */
export function readConfig(cwd: string, scope: ConfigScope = "project", env: NodeJS.ProcessEnv = process.env): SubagentsConfig {
  return { roles: readSettings(cwd, scope, env).roles };
}

/** Validate a role patch, returning an error message or null. */
export function validateRolePatch(patch: Partial<RoleConfig>): string | null {
  if (patch.mode !== undefined && patch.mode !== "default" && patch.mode !== "model") {
    return `invalid mode "${String(patch.mode)}" (must be "default" or "model")`;
  }
  if (patch.mode === "model" && !(typeof patch.model === "string" && patch.model.length > 0)) {
    return 'mode "model" requires a non-empty model id';
  }
  if (
    patch.effort !== undefined &&
    patch.effort !== null &&
    !(EFFORTS as readonly string[]).includes(patch.effort as string)
  ) {
    return `invalid effort "${String(patch.effort)}" (must be one of ${EFFORTS.join("/")} or null)`;
  }
  if (patch.promptOverride !== undefined && patch.promptOverride !== null && typeof patch.promptOverride !== "string") {
    return "promptOverride must be a string or null";
  }
  return null;
}

/** Atomic write with an exclusive temporary file; preserve unrelated JSON fields. */
function writeRaw(path: string, config: unknown): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    renameWithRetry(tmp, path);
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** Explicit full-config writes remain available to existing callers. */
export function writeConfig(cwd: string, config: SubagentsConfig): void {
  writeRaw(storePath(cwd), config);
}

/** Merge only the selected role; missing roles continue to inherit dynamically. */
export function setRole(cwd: string, role: RoleName, patch: Partial<RoleConfig>, scope: ConfigScope = "project", env: NodeJS.ProcessEnv = process.env): SubagentsConfig {
  if (!ROLES.includes(role)) throw new Error(`unknown role "${role}"`);
  const path = scopedPath(cwd, scope, env);
  const raw = scope === "global" ? readGlobalRaw(env, true) : readRaw(path, true);
  const current = Object.hasOwn(raw.roles, role) ? reconstructRole(raw.roles[role]) : readConfig(cwd, scope, env).roles[role];
  const next: RoleConfig = { ...current, ...patch };
  const err = validateRolePatch(next);
  if (err) throw new Error(err);
  if (next.mode === "default") next.model = null;
  raw.roles[role] = { ...(typeof raw.roles[role] === "object" && raw.roles[role] !== null ? raw.roles[role] as Record<string, unknown> : {}), ...next };
  writeRaw(path, raw);
  return readConfig(cwd, scope, env);
}

/** Remove a role override. null fields deliberately do not perform this action. */
export function resetRole(cwd: string, role: RoleName, scope: ConfigScope = "project", env: NodeJS.ProcessEnv = process.env): SubagentsConfig {
  if (!ROLES.includes(role)) throw new Error(`unknown role "${role}"`);
  const path = scopedPath(cwd, scope, env);
  const raw = scope === "global" ? readGlobalRaw(env, true) : readRaw(path, true);
  if (Object.hasOwn(raw.roles, role)) {
    delete raw.roles[role];
    writeRaw(path, raw);
  }
  return readConfig(cwd, scope, env);
}

export interface SpawnResolution {
  role: RoleName;
  /** model id to spawn with, or null to inherit the main Codex model. */
  model: string | null;
  /** true when this role inherits the main model (default mode). */
  usesMainModel: boolean;
  /** reasoning-effort override, or null to inherit the parent session's effort. */
  effort: EffortName | null;
  promptOverride: string | null;
  /** Why a repository-provided config was ignored, if applicable. */
  trustWarning?: string;
}

/** True only when Git says the project-local config is part of the checkout. */
export function isTrackedProjectConfig(cwd: string): boolean {
  try {
    return spawnSync(
      "git",
      ["-C", cwd, "ls-files", "--error-unmatch", "--", `${STATE_DIR}/${STORE_FILE}`],
      { stdio: "ignore", timeout: 1_500 },
    ).status === 0;
  } catch {
    return false;
  }
}

/**
 * Review token bound to both the canonical repository root and the exact config
 * bytes. A global boolean leaked trust to every later cwd in the same shell.
 */
export function projectConfigTrustToken(cwd: string): string | null {
  try {
    const configPath = realpathSync(storePath(cwd));
    const rootResult = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      timeout: 1_500,
    });
    const rawRoot = rootResult.status === 0 ? rootResult.stdout.trim() : cwd;
    const root = realpathSync(resolve(rawRoot));
    const digest = createHash("sha256")
      .update(root)
      .update("\0")
      .update(configPath)
      .update("\0")
      .update(readFileSync(configPath))
      .digest("hex");
    return `sha256:${digest}`;
  } catch {
    return null;
  }
}

/** Resolve how a role should be spawned given the current config. */
export function resolveSpawnConfig(
  cwd: string,
  role: RoleName,
  env: NodeJS.ProcessEnv = process.env,
): SpawnResolution {
  const settings = readSettings(cwd, "project", env);
  const cfg = settings.roles[role];
  const usesMainModel = cfg.mode === "default";
  return {
    role,
    model: usesMainModel ? null : cfg.model,
    usesMainModel,
    effort: cfg.effort,
    promptOverride: cfg.promptOverride,
    ...(settings.trustWarning ? { trustWarning: settings.trustWarning } : {}),
  };
}
