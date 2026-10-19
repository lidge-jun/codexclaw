/**
 * state-root.ts — where codexclaw's DURABLE project state lives (261020 external state root).
 *
 * Volatile runtime state (sessions, caches, bridge db, friction/edit-shape logs, ...) always
 * stays in the checkout at <cwd>/.codexclaw. Durable state — the transition ledger, goalplans,
 * evidence, interview ledgers — and the devlog plan units resolve through this module:
 *
 *   repo      <cwd>/.codexclaw + <cwd>/devlog (the historical layout)
 *   local     same locations, kept out of git through <git common dir>/info/exclude
 *   external  <base>/<projectId>/state + <base>/<projectId>/devlog, outside the checkout, keyed by
 *             the normalized origin so every worktree of one repository shares it and it
 *             survives worktree removal
 *   none      durable writes refused (DurableStateDisabledError); readers see empty state
 *
 * Precedence: env CODEXCLAW_STATE_MODE > config state.projects[<host/owner/repo>] > config
 * state.mode > auto. Auto: not a git checkout -> repo; git without a usable origin -> local;
 * origin owner allowlisted -> repo; otherwise external. Config is the user config
 * ($CODEXCLAW_HOME|~/.codexclaw)/config.json, ignored when it resolves inside the checkout so a
 * repository cannot choose its own state root. Plan: devlog/_plan/261020_external_state_root.
 *
 * Byte-identical copies live in every component that owns a codexclaw-dir.ts (cross-component
 * imports are banned); plugins/codexclaw/test/codexclaw-dir-copies.test.mjs pins them.
 */
import { createHash } from "node:crypto";
import {
  closeSync, constants as fsConstants, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, statSync,
  writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";


export const STATE_MODES                       = ["repo", "local", "external", "none"];
/** Owners whose repositories keep the in-repo layout by default (github.com unless host-qualified). */
export const DEFAULT_OWNER_ALLOWLIST                    = ["lidge-jun", "goat-si", "lidge-ai"];
export const VOLATILE_DIRNAME = ".codexclaw";
export const DEVLOG_DIRNAME = "devlog";
/** Durable items that may still sit in a checkout from before this resolver existed. */
export const LEGACY_DURABLE_ITEMS                    = [
  "ledger.jsonl", "goalplans", "evidence", "evidence-attempts", "evidence-unrecordable", "interviews",
];

export class DurableStateDisabledError extends Error {
  constructor(message        ) {
    super(message);
    this.name = "DurableStateDisabledError";
  }
}








































const gitCache = new Map                        ();
let configCache                                                                             = null;
const excludeDone = new Set        ();

export function clearStateRootCache()       {
  gitCache.clear();
  configCache = null;
  excludeDone.clear();
}

function sha(value        )         {
  return createHash("sha256").update(value).digest("hex");
}

export function isInside(child        , parent        )          {
  const rel = relative(parent, child);
  // "..x" is a real child named "..x"; only ".." or "../..." leaves the parent.
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel));
}

/** realpath of the nearest existing ancestor, with the missing tail re-appended. */
export function realpathLoose(p        )         {
  let cur = resolve(p);
  const tail           = [];
  for (;;) {
    try {
      return join(realpathSync(cur), ...tail.reverse());
    } catch {
      const parent = dirname(cur);
      if (parent === cur) return resolve(p);
      tail.push(basename(cur));
      cur = parent;
    }
  }
}

/**
 * Normalize an origin URL to host/owner/repo. Accepts scp-like (git@host:o/r.git), ssh://,
 * git://, http(s):// forms; drops userinfo, port, query, fragment and a trailing .git.
 * Local paths and file:// URLs have no owner and return null.
 */
export function normalizeRemoteUrl(raw                           )                   {
  if (typeof raw !== "string") return null;
  const url = raw.trim().replace(/^"(.*)"$/, "$1");
  if (url.length === 0) return null;
  let host = "";
  let path = "";
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(url);
  if (scheme) {
    const proto = scheme[1].toLowerCase();
    if (proto === "file") return null;
    try {
      const parsed = new URL(url);
      host = parsed.hostname;
      path = decodeURIComponent(parsed.pathname);
    } catch {
      return null;
    }
  } else {
    const scp = /^(?:[^@/]+@)?([^:/]+):(.+)$/.exec(url);
    if (!scp || url.startsWith("/") || url.startsWith(".")) return null;
    host = scp[1];
    path = scp[2].split(/[?#]/)[0];
  }
  host = host.toLowerCase().replace(/^\[|\]$/g, "");
  const segments = path.replace(/\\/g, "/").split("/").filter((s) => s.length > 0);
  if (segments.length > 0) segments[segments.length - 1] = segments[segments.length - 1].replace(/\.git$/i, "");
  const parts = segments.map((s) => s.toLowerCase()).filter((s) => s.length > 0);
  if (host.length === 0 || parts.length < 2) return null;
  if (parts.some((s) => s === "." || s === "..") || host === "." || host === "..") return null;
  return { key: [host, ...parts].join("/"), host, owner: parts[0] };
}

function sanitizePart(value        )         {
  const s = value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return s.length === 0 || s === "." || s === ".." ? "x" : s.slice(0, 40);
}

function readTextSafe(path        )                {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** A git config value: double quotes group, backslash escapes, unquoted # or ; starts a comment. */
export function parseGitConfigValue(raw        )         {
  let out = "";
  let quoted = false;
  let pendingSpace = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\" && i + 1 < raw.length) {
      const n = raw[++i];
      out += pendingSpace + (n === "n" ? "\n" : n === "t" ? "\t" : n === "b" ? "" : n);
      pendingSpace = "";
    } else if (c === '"') {
      quoted = !quoted;
      out += pendingSpace;
      pendingSpace = "";
    } else if (!quoted && (c === "#" || c === ";")) {
      break;
    } else if (!quoted && (c === " " || c === "\t")) {
      if (out.length > 0) pendingSpace += c;
    } else {
      out += pendingSpace + c;
      pendingSpace = "";
    }
  }
  return out;
}

/**
 * True when a config line continues onto the next physical line: a backslash ends the line
 * outside quotes and outside a comment. Comment and section lines never continue.
 */
function continuesLine(text        )          {
  if (/^\s*[#;[]/.test(text)) return false;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") {
      if (i === text.length - 1) return true;
      i += 1;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (!quoted && (c === "#" || c === ";")) {
      return false;
    }
  }
  return false;
}

/** First url of [remote "origin"] in a git config file (no include/includeIf/insteadOf). */
export function parseOriginUrl(configText        )                {
  let inOrigin = false;
  // Join git's backslash line continuations into logical lines first.
  const logical           = [];
  let carry = "";
  for (const physical of configText.split(/\r?\n/)) {
    if (continuesLine(carry + physical)) {
      carry += physical.slice(0, -1);
      continue;
    }
    logical.push(carry + physical);
    carry = "";
  }
  if (carry) logical.push(carry);
  for (const line of logical) {
    const section = /^\s*\[\s*([^\]]+?)\s*\]/.exec(line);
    if (section) {
      inOrigin = /^remote\s+"origin"$/i.test(section[1].trim());
      continue;
    }
    if (!inOrigin) continue;
    const m = /^\s*url\s*=(.*)$/i.exec(line);
    if (m) {
      const value = parseGitConfigValue(m[1]);
      if (value.length > 0) return value;
    }
  }
  return null;
}

/** File-based git discovery (no subprocess: this runs on hot hook paths). Cached per cwd. */
export function readGitInfo(cwd        )                 {
  const start = resolve(cwd);
  if (gitCache.has(start)) return gitCache.get(start) ?? null;
  let info                 = null;
  let dir = start;
  for (;;) {
    const dotgit = join(dir, ".git");
    let st;
    try {
      st = statSync(dotgit);
    } catch {
      st = null;
    }
    if (st) {
      let gitDir                = null;
      if (st.isDirectory()) gitDir = dotgit;
      else if (st.isFile()) {
        const m = /^gitdir:\s*(.+?)\s*$/m.exec(readTextSafe(dotgit) ?? "");
        if (m) gitDir = resolve(dir, m[1]);
      }
      if (gitDir) {
        const commonRel = readTextSafe(join(gitDir, "commondir"))?.trim();
        const commonDir = commonRel ? resolve(gitDir, commonRel) : gitDir;
        const originUrl = parseOriginUrl(readTextSafe(join(commonDir, "config")) ?? "");
        info = { worktreeRoot: dir, gitDir, commonDir, originUrl };
      }
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  gitCache.set(start, info);
  return info;
}

/**
 * Project id: readable sanitized parts plus 128 bits (32 hex) of the full key's sha256, so two
 * keys that sanitize or truncate alike still get different ids. All worktrees of one repository share the id: the
 * origin is read from the shared config, and the no-origin fallback hashes the common git dir.
 */
export function deriveProjectId(cwd        , git                , remote                  )         {
  if (remote) {
    return remote.key.split("/").map(sanitizePart).join("__") + "-" + sha(remote.key).slice(0, 32);
  }
  if (git) {
    const common = realpathLoose(git.commonDir);
    const name = basename(common) === ".git" ? basename(dirname(common)) : basename(common);
    return "local__" + sanitizePart(name) + "-" + sha(common).slice(0, 32);
  }
  const real = realpathLoose(cwd);
  return "path__" + sanitizePart(basename(real)) + "-" + sha(real).slice(0, 32);
}

function homeOf(env                   )         {
  const h = env.HOME?.trim();
  return h && isAbsolute(h) ? h : homedir();
}

/** $CODEXCLAW_HOME (absolute only) or ~/.codexclaw. */
export function codexclawHome(env                    = process.env)         {
  const override = env.CODEXCLAW_HOME?.trim();
  return override && isAbsolute(override) ? override : join(homeOf(env), ".codexclaw");
}

function asMode(value         )                            {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return v === "auto" || (STATE_MODES                     ).includes(v) ? (v                      ) : null;
}

function parseStateConfig(raw         )              {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const state = (raw                           ).state;
  if (!state || typeof state !== "object" || Array.isArray(state)) return {};
  const s = state                           ;
  const out              = {};
  const mode = asMode(s.mode);
  if (mode) out.mode = mode;
  if (typeof s.root === "string" && s.root.trim().length > 0) out.root = s.root.trim();
  if (Array.isArray(s.ownerAllowlist)) {
    out.ownerAllowlist = s.ownerAllowlist.filter((x)              => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim().toLowerCase());
  }
  if (s.projects && typeof s.projects === "object" && !Array.isArray(s.projects)) {
    const projects                            = {};
    for (const [k, v] of Object.entries(s.projects                           )) {
      const m = asMode(v);
      if (m && m !== "auto") projects[k.trim().toLowerCase()] = m;
    }
    out.projects = projects;
  }
  return out;
}

/**
 * Read the 'state' key of the user config. A config whose real path lies inside the checkout
 * is ignored (a repository must not pick its own state root), except the literal default file
 * when the checkout IS the home directory.
 */
export function readStateConfig(env                   , checkoutRoot        , warnings           = [])              {
  const override = env.CODEXCLAW_HOME?.trim();
  if (override && !isAbsolute(override)) {
    warnings.push("CODEXCLAW_HOME is not absolute; state config ignored");
    return {};
  }
  const path = join(codexclawHome(env), "config.json");
  let st;
  try {
    st = statSync(path);
  } catch {
    return {};
  }
  let real        ;
  try {
    real = realpathSync(path);
  } catch {
    return {};
  }
  const realCheckout = realpathLoose(checkoutRoot);
  if (isInside(real, realCheckout)) {
    const realHome = realpathLoose(homeOf(env));
    const defaultAtHome = !override && realCheckout === realHome && real === join(realHome, ".codexclaw", "config.json");
    if (!defaultAtHome) {
      warnings.push("state config " + path + " resolves inside the checkout and was ignored");
      return {};
    }
  }
  if (configCache && configCache.path === real && configCache.mtimeMs === st.mtimeMs && configCache.size === st.size) {
    return configCache.value;
  }
  let value              = {};
  try {
    value = parseStateConfig(JSON.parse(readFileSync(real, "utf8")));
  } catch {
    warnings.push("state config " + path + " is not valid JSON; ignored");
  }
  configCache = { path: real, mtimeMs: st.mtimeMs, size: st.size, value };
  return value;
}

export function ownerAllowed(remote           , allowlist                   )          {
  for (const raw of allowlist) {
    const entry = raw.trim().toLowerCase();
    if (entry.length === 0) continue;
    if (entry.includes("/")) {
      if (entry === remote.host + "/" + remote.owner) return true;
    } else if (remote.host === "github.com" && entry === remote.owner) {
      return true;
    }
  }
  return false;
}

function isSymlink(p        )          {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Resolve the state layout for a checkout. Cheap enough for hook paths (cached git parse). */
export function resolveStateRoot(cwd        , env                    = process.env)            {
  const cwdAbs = resolve(cwd);
  const git = readGitInfo(cwdAbs);
  const checkoutRoot = git?.worktreeRoot ?? cwdAbs;
  const warnings           = [];
  const cfg = readStateConfig(env, checkoutRoot, warnings);
  const remote = git?.originUrl ? normalizeRemoteUrl(git.originUrl) : null;
  const allowlist = cfg.ownerAllowlist ?? DEFAULT_OWNER_ALLOWLIST;

  let mode           ;
  let reason        ;
  const envRaw = env.CODEXCLAW_STATE_MODE;
  const envMode = asMode(envRaw);
  if (envRaw !== undefined && envRaw.trim() !== "" && envMode === null) {
    warnings.push("CODEXCLAW_STATE_MODE=" + envRaw + " is not one of auto|repo|local|external|none; ignored");
  }
  if (envMode && envMode !== "auto") {
    mode = envMode;
    reason = "env CODEXCLAW_STATE_MODE=" + envMode;
  } else if (remote && cfg.projects?.[remote.key]) {
    mode = cfg.projects[remote.key];
    reason = "config state.projects[\"" + remote.key + "\"]";
  } else if (cfg.mode && cfg.mode !== "auto") {
    mode = cfg.mode;
    reason = "config state.mode";
  } else if (!git) {
    mode = "repo";
    reason = "auto: not a git checkout";
  } else if (!remote) {
    mode = "local";
    reason = "auto: git checkout without a usable origin remote (local-only; set state.mode or CODEXCLAW_STATE_MODE=external to keep it outside)";
  } else if (ownerAllowed(remote, allowlist)) {
    mode = "repo";
    reason = "auto: origin owner " + remote.host + "/" + remote.owner + " is allowlisted";
  } else {
    mode = "external";
    reason = "auto: origin owner " + remote.host + "/" + remote.owner + " is not allowlisted";
  }

  const volatileDir = join(cwdAbs, VOLATILE_DIRNAME);
  const root            = {
    mode, reason, cwd: cwdAbs, checkoutRoot, volatileDir,
    durableDir: volatileDir,
    devlogDir: join(cwdAbs, DEVLOG_DIRNAME),
    projectId: null, projectDir: null, stateBase: null,
    originKey: remote?.key ?? null, owner: remote?.owner ?? null,
    disabledReason: null, warnings,
  };

  if (mode === "none") {
    root.durableDir = join(volatileDir, "durable-disabled");
    root.devlogDir = null;
    root.disabledReason = "codexclaw durable state is disabled (state mode none, " + reason + "); ledger, goalplan, evidence and devlog writes are skipped";
    return root;
  }
  if (mode !== "external") return root;

  let base                = null;
  const envRoot = env.CODEXCLAW_STATE_ROOT?.trim();
  if (envRoot) {
    if (isAbsolute(envRoot)) base = envRoot;
    else warnings.push("CODEXCLAW_STATE_ROOT is not absolute; ignored");
  }
  if (!base && cfg.root) {
    if (isAbsolute(cfg.root)) base = cfg.root;
    else warnings.push("config state.root is not absolute; ignored");
  }
  if (!base) base = join(codexclawHome(env), "projects");
  base = resolve(base);
  const projectId = deriveProjectId(cwdAbs, git, remote);
  const projectDir = join(base, projectId);
  const devlog = join(projectDir, DEVLOG_DIRNAME);
  root.stateBase = base;
  root.projectId = projectId;
  root.projectDir = projectDir;
  root.durableDir = join(projectDir, "state");
  root.devlogDir = devlog;

  const realCheckout = realpathLoose(checkoutRoot);
  for (const p of [base, root.durableDir, devlog]) {
    if (isInside(realpathLoose(p), realCheckout)) {
      root.disabledReason = "external state path " + p + " resolves inside the checkout " + checkoutRoot + "; refusing to write durable state there";
      break;
    }
  }
  if (!root.disabledReason) {
    for (const p of [projectDir, root.durableDir, devlog, join(devlog, "_plan"), join(devlog, "_fin")]) {
      if (isSymlink(p)) {
        root.disabledReason = "external state path " + p + " is a symlink; codexclaw state roots must be real directories";
        break;
      }
    }
  }
  if (!root.disabledReason && remote) {
    // A project dir claimed by a different origin (a hash collision or a hand-made dir) is
    // never shared: the recorded origin must match.
    const recorded = readTextSafe(join(projectDir, "project.json"));
    if (recorded !== null) {
      let origin          = null;
      try {
        origin = (JSON.parse(recorded)                        ).origin;
      } catch {
        origin = undefined;
      }
      if (origin !== remote.key) {
        root.disabledReason = "external project dir " + projectDir + " belongs to origin " + JSON.stringify(origin) + ", not " + remote.key + "; refusing to share it";
      }
    }
  }
  if (existsSync(join(volatileDir, "ledger.jsonl")) || existsSync(join(volatileDir, "goalplans"))) {
    warnings.push("legacy durable state found in " + volatileDir + " (not read in external mode); run: cxc state migrate --apply");
  }
  return root;
}

export function durableDir(cwd        , env                    = process.env)         {
  return resolveStateRoot(cwd, env).durableDir;
}

export function evidenceDir(cwd        , env                    = process.env)         {
  return join(resolveStateRoot(cwd, env).durableDir, "evidence");
}

export function devlogDir(cwd        , env                    = process.env)                {
  return resolveStateRoot(cwd, env).devlogDir;
}

export function isDurableDisabled(cwd        , env                    = process.env)          {
  return resolveStateRoot(cwd, env).disabledReason !== null;
}

function toLabel(cwdAbs        , p        )         {
  const rel = relative(cwdAbs, p);
  if (rel !== "" && !rel.startsWith("..") && !isAbsolute(rel)) return rel.split(sep).join("/");
  return p;
}

/** A durable path for messages: relative to cwd when inside it (repo/local), else absolute. */
export function durableLabel(cwd        , ...segments          )         {
  const root = resolveStateRoot(cwd);
  return toLabel(root.cwd, join(root.durableDir, ...segments));
}

/** A devlog path for messages; falls back to the historical relative form in mode none. */
export function devlogLabel(cwd        , ...segments          )         {
  const root = resolveStateRoot(cwd);
  if (!root.devlogDir) return [DEVLOG_DIRNAME, ...segments].join("/");
  return toLabel(root.cwd, join(root.devlogDir, ...segments));
}

/**
 * local/external/none: hide checkout-local codexclaw files from git through the shared
 * <common dir>/info/exclude, which never modifies tracked files. Best-effort and idempotent;
 * repo mode never touches it.
 */
export function ensurePrivacyExcludes(cwd        , env                    = process.env)       {
  try {
    const root = resolveStateRoot(cwd, env);
    if (root.mode === "repo") return;
    const git = readGitInfo(root.cwd);
    if (!git) return;
    const rel = relative(git.worktreeRoot, root.cwd).split(sep).join("/");
    const prefix = rel === "" ? "/" : "/" + rel + "/";
    const entries = [prefix + ".codexclaw/", prefix + "codexclaw.json"];
    if (root.mode === "local") entries.push(prefix + "devlog/");
    const excludePath = join(git.commonDir, "info", "exclude");
    const key = excludePath + "\0" + entries.join("\0");
    if (excludeDone.has(key)) return;
    // Never follow a link out of the git dir: info/ and info/exclude must be real entries
    // inside the real common dir, and the file is opened O_NOFOLLOW.
    const realCommon = realpathSync(git.commonDir);
    const infoDir = join(realCommon, "info");
    if (existsSync(infoDir) && lstatSync(infoDir).isSymbolicLink()) return;
    const realExclude = join(infoDir, "exclude");
    if (existsSync(realExclude) && !lstatSync(realExclude).isFile()) return;
    const existing = readTextSafe(realExclude) ?? "";
    const lines = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
    const missing = entries.filter((e) => !lines.has(e));
    if (missing.length > 0) {
      mkdirSync(infoDir, { recursive: true });
      const lead = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
      const noFollow = typeof fsConstants.O_NOFOLLOW === "number" ? fsConstants.O_NOFOLLOW : 0;
      const fd = openSync(realExclude, fsConstants.O_APPEND | fsConstants.O_CREAT | fsConstants.O_WRONLY | noFollow, 0o644);
      try {
        writeSync(fd, lead + "# codexclaw: state mode " + root.mode + " keeps these out of git\n" + missing.join("\n") + "\n");
      } finally {
        closeSync(fd);
      }
    }
    excludeDone.add(key);
  } catch {
    // best-effort: an unwritable .git must not break a hook
  }
}
