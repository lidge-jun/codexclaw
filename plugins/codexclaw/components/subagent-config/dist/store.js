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
export const ROLES = ["explorer", "reviewer", "executor"]         ;
                                              

                                           

                             
                                                                         
                 
                                                                                
                       
                                                                                   
                                
 

                                  
                                      
 

export function defaultRole()             {
  return { mode: "default", model: null, promptOverride: null };
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
  const promptOverride = typeof r.promptOverride === "string" ? r.promptOverride : null;
  // A "model" mode with no valid model is invalid -> fall back to default (fail safe).
  if (mode === "model" && model === null) return { mode: "default", model: null, promptOverride };
  return { mode, model, promptOverride };
}

/**
 * Read + normalize the config. Missing file -> defaults. Malformed JSON ->
 * defaults (never throws). Each role is strictly reconstructed.
 */
export function readConfig(cwd        )                  {
  const path = storePath(cwd);
  if (!existsSync(path)) return defaultConfig();
  let parsed         ;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return defaultConfig();
  }
  const roles = (parsed && typeof parsed === "object" ? (parsed                       ).roles : null)   
                             
          
               ;
  const out = defaultConfig();
  if (roles && typeof roles === "object") {
    for (const role of ROLES) out.roles[role] = reconstructRole(roles[role]);
  }
  return out;
}

/** Validate a role patch, returning an error message or null. */
export function validateRolePatch(patch                     )                {
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
export function writeConfig(cwd        , config                 )       {
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
export function setRole(cwd        , role          , patch                     )                  {
  if (!ROLES.includes(role)) throw new Error(`unknown role "${role}"`);
  const err = validateRolePatch(patch);
  if (err) throw new Error(err);
  const config = readConfig(cwd);
  const next             = { ...config.roles[role], ...patch };
  // enforce the default-mode invariant: default mode ignores model.
  if (next.mode === "default") next.model = null;
  config.roles[role] = next;
  writeConfig(cwd, config);
  return config;
}

                                  
                 
                                                                         
                       
                                                                    
                         
                                
 

/** Resolve how a role should be spawned given the current config. */
export function resolveSpawnConfig(cwd        , role          )                  {
  const cfg = readConfig(cwd).roles[role];
  const usesMainModel = cfg.mode === "default";
  return {
    role,
    model: usesMainModel ? null : cfg.model,
    usesMainModel,
    promptOverride: cfg.promptOverride,
  };
}
