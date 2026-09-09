/**
 * store.ts — `.codexclaw/subagents.json` config store (L24 / 240-242).
 *
 * Per-role subagent model mode + prompt override for the three Phase-1 roles
 * (explorer/reviewer/executor). Missing file -> defaults; malformed values are
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
import { renameWithRetry } from "./atomic-write.js";

export const STATE_DIR = ".codexclaw";
export const STORE_FILE = "subagents.json";
export const ROLES = ["explorer", "reviewer", "executor"]         ;




/**
 * Valid spawn reasoning-effort wire values (codex-rs ReasoningEffort, lowercase
 * serde: protocol/src/openai_models.rs — "xhigh", not "x-high"). null = inherit
 * the parent session's effort (the jawcode/cli-jaw policy default). An invalid
 * effort HARD-FAILS the spawn on the codex side, so the store validates on write.
 */
// Supported wire values retained for backward compatibility. Model capabilities vary;
// the dashboard narrows these options using the current catalog's reasoningEfforts.
export const EFFORTS = ["low", "medium", "high", "xhigh"]         ;
























/** Patch shape: fallback may be a partial nested update or null to clear. */








export function defaultRole()             {
  return { mode: "default", model: null, effort: null, promptOverride: null, fallback: null };
}

export function defaultConfig()                  {
  return { roles: { explorer: defaultRole(), reviewer: defaultRole(), executor: defaultRole() } };
}

function storePath(cwd        )         {
  return join(cwd, STATE_DIR, STORE_FILE);
}

/** Normalize one persisted role value into a valid RoleConfig (strict, total). */
function reconstructRole(raw         )             {
  if (!raw || typeof raw !== "object") return defaultRole();
  const r = raw                           ;
  const mode           = r.mode === "model" ? "model" : "default";
  // model only meaningful in "model" mode; coerce anything non-string to null.
  const model = mode === "model" && typeof r.model === "string" && r.model.length > 0 ? r.model : null;
  // effort: only a known wire value survives; anything else -> null (inherit).
  const effort = (EFFORTS                     ).includes(r.effort          ) ? (r.effort              ) : null;
  const promptOverride = typeof r.promptOverride === "string" ? r.promptOverride : null;
  const fallback = reconstructFallback(r.fallback);
  // A "model" mode with no valid model is invalid -> fall back to default (fail safe).
  if (mode === "model" && model === null) return { mode: "default", model: null, effort, promptOverride, fallback };
  return { mode, model, effort, promptOverride, fallback };
}

/** Missing or malformed fallback becomes null; invalid nested effort becomes inherit. */
function reconstructFallback(raw         )                      {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const f = raw                           ;
  if (typeof f.model !== "string" || f.model.trim().length === 0) return null;
  const effort = (EFFORTS                     ).includes(f.effort          ) ? (f.effort              ) : null;
  return { model: f.model, effort };
}

function mergeFallback(current                     , patch                                          )                      {
  if (patch === undefined) return current;
  if (patch === null) return null;
  const model = typeof patch.model === "string" ? patch.model : (current?.model ?? "");
  const effort = Object.prototype.hasOwnProperty.call(patch, "effort")
    ? (patch.effort === undefined ? null : patch.effort)
    : (current?.effort ?? null);
  return { model, effort };
}










export function configScope(value          = "project")              {
  if (value !== "project" && value !== "global") throw new Error(`invalid scope "${String(value)}"`);
  return value;
}

export function cxcHome(env                    = process.env)         {
  return env.CODEXCLAW_HOME?.trim() || join(homedir(), ".codexclaw");
}

export function globalStorePath(env                    = process.env)         {
  return join(cxcHome(env), STORE_FILE);
}

/** Compatibility with the unpublished first scoped-settings patch. Reads never migrate. */
function readGlobalRaw(env                   , forWrite = false)            {
  const canonical = globalStorePath(env);
  if (!existsSync(canonical) && !env.CODEXCLAW_HOME?.trim()) {
    const legacy = join(env.CODEX_HOME?.trim() || join(homedir(), ".codex"), "codexclaw", STORE_FILE);
    if (existsSync(legacy)) return readRaw(legacy, forWrite);
  }
  return readRaw(canonical, forWrite);
}

function scopedPath(cwd        , scope             , env                   )         {
  return configScope(scope) === "global" ? globalStorePath(env) : storePath(cwd);
}


function readRaw(path        , forWrite = false)            {
  try {
    const parsed          = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("config must be an object");
    const raw = parsed                           ;
    if (raw.roles !== undefined && (!raw.roles || typeof raw.roles !== "object" || Array.isArray(raw.roles))) {
      throw new Error("roles must be an object");
    }
    return { ...raw, roles: { ...(raw.roles                                       ) } };
  } catch (err) {
    if (forWrite && (err                         ).code !== "ENOENT") {
      throw new Error(`cannot update subagent config: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { roles: {} };
  }
}

function projectTrustWarning(cwd        , env                   )                     {
  if (!isTrackedProjectConfig(cwd)) return undefined;
  const token = projectConfigTrustToken(cwd);
  if (token !== null && env.CODEXCLAW_TRUST_PROJECT_SUBAGENTS === token) return undefined;
  return "ignored Git-tracked .codexclaw/subagents.json; review it, then run `cxc subagents trust-token` and export the printed project-bound value";
}

/** Resolve whole roles, preserving explicit null as original-session inheritance. */
export function readSettings(cwd        , scope              = "project", env                    = process.env)                   {
  configScope(scope);
  const global = readGlobalRaw(env);
  const project = scope === "project" ? readRaw(storePath(cwd)) : { roles: {} };
  const trustWarning = scope === "project" ? projectTrustWarning(cwd, env) : undefined;
  const out                   = {
    ...defaultConfig(), scope,
    sources: { explorer: "session", reviewer: "session", executor: "session" },
    overrides: { explorer: false, reviewer: false, executor: false },
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
export function readConfig(cwd        , scope              = "project", env                    = process.env)                  {
  return { roles: readSettings(cwd, scope, env).roles };
}

/** Validate a role patch, returning an error message or null. */
export function validateRolePatch(patch           )                {
  if (patch.mode !== undefined && patch.mode !== "default" && patch.mode !== "model") {
    return `invalid mode "${String(patch.mode)}" (must be "default" or "model")`;
  }
  if (patch.mode === "model" && !(typeof patch.model === "string" && patch.model.length > 0)) {
    return 'mode "model" requires a non-empty model id';
  }
  if (
    patch.effort !== undefined &&
    patch.effort !== null &&
    !(EFFORTS                     ).includes(patch.effort          )
  ) {
    return `invalid effort "${String(patch.effort)}" (must be one of ${EFFORTS.join("/")} or null)`;
  }
  if (patch.promptOverride !== undefined && patch.promptOverride !== null && typeof patch.promptOverride !== "string") {
    return "promptOverride must be a string or null";
  }
  if (patch.fallback !== undefined && patch.fallback !== null) {
    if (typeof patch.fallback !== "object" || Array.isArray(patch.fallback)) {
      return "fallback must be an object or null";
    }
    if (patch.fallback.model !== undefined && !(typeof patch.fallback.model === "string" && patch.fallback.model.trim().length > 0)) {
      return "fallback requires a non-empty model id";
    }
    if (
      patch.fallback.effort !== undefined &&
      patch.fallback.effort !== null &&
      !(EFFORTS                     ).includes(patch.fallback.effort          )
    ) {
      return `invalid fallback effort "${String(patch.fallback.effort)}" (must be one of ${EFFORTS.join("/")} or null)`;
    }
  }
  if (
    patch.mode === "model" &&
    typeof patch.model === "string" &&
    patch.fallback &&
    typeof patch.fallback.model === "string" &&
    patch.fallback.model === patch.model
  ) {
    return "fallback model must differ from the primary model";
  }
  return null;
}

/** Atomic write with an exclusive temporary file; preserve unrelated JSON fields. */
function writeRaw(path        , config         )       {
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
export function writeConfig(cwd        , config                 )       {
  writeRaw(storePath(cwd), config);
}

/** Merge only the selected role; missing roles continue to inherit dynamically. */
export function setRole(cwd        , role          , patch           , scope              = "project", env                    = process.env)                  {
  if (!ROLES.includes(role)) throw new Error(`unknown role "${role}"`);
  const path = scopedPath(cwd, scope, env);
  const raw = scope === "global" ? readGlobalRaw(env, true) : readRaw(path, true);
  const current = Object.hasOwn(raw.roles, role) ? reconstructRole(raw.roles[role]) : readConfig(cwd, scope, env).roles[role];
  if (patch.fallback !== undefined && patch.fallback !== null && (typeof patch.fallback !== "object" || Array.isArray(patch.fallback))) {
    throw new Error("fallback must be an object or null");
  }
  const fallbackError = validateRolePatch({ fallback: patch.fallback });
  if (fallbackError) throw new Error(fallbackError);
  const { fallback: fallbackPatch, ...rest } = patch;
  const next             = { ...current, ...rest, fallback: mergeFallback(current.fallback, fallbackPatch) };
  const err = validateRolePatch(next);
  if (err) throw new Error(err);
  if (next.mode === "default") next.model = null;
  if (next.fallback) next.fallback = { model: next.fallback.model, effort: next.fallback.effort };
  raw.roles[role] = { ...(typeof raw.roles[role] === "object" && raw.roles[role] !== null ? raw.roles[role]                            : {}), ...next };
  writeRaw(path, raw);
  return readConfig(cwd, scope, env);
}

/** Remove a role override. null fields deliberately do not perform this action. */
export function resetRole(cwd        , role          , scope              = "project", env                    = process.env)                  {
  if (!ROLES.includes(role)) throw new Error(`unknown role "${role}"`);
  const path = scopedPath(cwd, scope, env);
  const raw = scope === "global" ? readGlobalRaw(env, true) : readRaw(path, true);
  if (Object.hasOwn(raw.roles, role)) {
    delete raw.roles[role];
    writeRaw(path, raw);
  }
  return readConfig(cwd, scope, env);
}














/** True only when Git says the project-local config is part of the checkout. */
export function isTrackedProjectConfig(cwd        )          {
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
export function projectConfigTrustToken(cwd        )                {
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
  cwd        ,
  role          ,
  env                    = process.env,
)                  {
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
