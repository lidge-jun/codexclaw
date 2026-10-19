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

export type StateMode = "repo" | "local" | "external" | "none";
export const STATE_MODES: readonly StateMode[] = ["repo", "local", "external", "none"];
/** Owners whose repositories keep the in-repo layout by default (github.com unless host-qualified). */
export const DEFAULT_OWNER_ALLOWLIST: readonly string[] = ["lidge-jun", "goat-si", "lidge-ai"];
export const VOLATILE_DIRNAME = ".codexclaw";
export const DEVLOG_DIRNAME = "devlog";
/** Durable items that may still sit in a checkout from before this resolver existed. */
export const LEGACY_DURABLE_ITEMS: readonly string[] = [
  "ledger.jsonl", "goalplans", "evidence", "evidence-attempts", "evidence-unrecordable", "interviews",
];

export class DurableStateDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DurableStateDisabledError";
  }
}

export interface StateConfig {
  mode?: StateMode | "auto";
  root?: string;
  ownerAllowlist?: string[];
  projects?: Record<string, StateMode>;
}

export interface RemoteKey {
  /** "host/owner/repo" (lower-case, no credentials, no .git). */
  key: string;
  host: string;
  owner: string;
}

export interface GitInfo {
  worktreeRoot: string;
  gitDir: string;
  commonDir: string;
  originUrl: string | null;
}

export interface StateRoot {
  mode: StateMode;
  reason: string;
  cwd: string;
  checkoutRoot: string;
  volatileDir: string;
  durableDir: string;
  devlogDir: string | null;
  projectId: string | null;
  projectDir: string | null;
  stateBase: string | null;
  originKey: string | null;
  owner: string | null;
  /** Non-null when durable writes must be refused (mode none, or an unsafe external root). */
  disabledReason: string | null;
  warnings: string[];
}

const gitCache = new Map<string, GitInfo | null>();
let configCache: { path: string; mtimeMs: number; size: number; value: StateConfig } | null = null;
const excludeDone = new Set<string>();

export function clearStateRootCache(): void {
  gitCache.clear();
  configCache = null;
  excludeDone.clear();
}

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  // "..x" is a real child named "..x"; only ".." or "../..." leaves the parent.
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel));
}

/** realpath of the nearest existing ancestor, with the missing tail re-appended. */
export function realpathLoose(p: string): string {
  let cur = resolve(p);
  const tail: string[] = [];
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
export function normalizeRemoteUrl(raw: string | null | undefined): RemoteKey | null {
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

function sanitizePart(value: string): string {
  const s = value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return s.length === 0 || s === "." || s === ".." ? "x" : s.slice(0, 40);
}

function readTextSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** A git config value: double quotes group, backslash escapes, unquoted # or ; starts a comment. */
export function parseGitConfigValue(raw: string): string {
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

/** First url of [remote "origin"] in a git config file (no include/includeIf/insteadOf). */
export function parseOriginUrl(configText: string): string | null {
  let inOrigin = false;
  for (const line of configText.split(/\r?\n/)) {
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
export function readGitInfo(cwd: string): GitInfo | null {
  const start = resolve(cwd);
  if (gitCache.has(start)) return gitCache.get(start) ?? null;
  let info: GitInfo | null = null;
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
      let gitDir: string | null = null;
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
export function deriveProjectId(cwd: string, git: GitInfo | null, remote: RemoteKey | null): string {
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

function homeOf(env: NodeJS.ProcessEnv): string {
  const h = env.HOME?.trim();
  return h && isAbsolute(h) ? h : homedir();
}

/** $CODEXCLAW_HOME (absolute only) or ~/.codexclaw. */
export function codexclawHome(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.CODEXCLAW_HOME?.trim();
  return override && isAbsolute(override) ? override : join(homeOf(env), ".codexclaw");
}

function asMode(value: unknown): StateMode | "auto" | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return v === "auto" || (STATE_MODES as readonly string[]).includes(v) ? (v as StateMode | "auto") : null;
}

function parseStateConfig(raw: unknown): StateConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const state = (raw as Record<string, unknown>).state;
  if (!state || typeof state !== "object" || Array.isArray(state)) return {};
  const s = state as Record<string, unknown>;
  const out: StateConfig = {};
  const mode = asMode(s.mode);
  if (mode) out.mode = mode;
  if (typeof s.root === "string" && s.root.trim().length > 0) out.root = s.root.trim();
  if (Array.isArray(s.ownerAllowlist)) {
    out.ownerAllowlist = s.ownerAllowlist.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim().toLowerCase());
  }
  if (s.projects && typeof s.projects === "object" && !Array.isArray(s.projects)) {
    const projects: Record<string, StateMode> = {};
    for (const [k, v] of Object.entries(s.projects as Record<string, unknown>)) {
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
export function readStateConfig(env: NodeJS.ProcessEnv, checkoutRoot: string, warnings: string[] = []): StateConfig {
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
  let real: string;
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
  let value: StateConfig = {};
  try {
    value = parseStateConfig(JSON.parse(readFileSync(real, "utf8")));
  } catch {
    warnings.push("state config " + path + " is not valid JSON; ignored");
  }
  configCache = { path: real, mtimeMs: st.mtimeMs, size: st.size, value };
  return value;
}

export function ownerAllowed(remote: RemoteKey, allowlist: readonly string[]): boolean {
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

function isSymlink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Resolve the state layout for a checkout. Cheap enough for hook paths (cached git parse). */
export function resolveStateRoot(cwd: string, env: NodeJS.ProcessEnv = process.env): StateRoot {
  const cwdAbs = resolve(cwd);
  const git = readGitInfo(cwdAbs);
  const checkoutRoot = git?.worktreeRoot ?? cwdAbs;
  const warnings: string[] = [];
  const cfg = readStateConfig(env, checkoutRoot, warnings);
  const remote = git?.originUrl ? normalizeRemoteUrl(git.originUrl) : null;
  const allowlist = cfg.ownerAllowlist ?? DEFAULT_OWNER_ALLOWLIST;

  let mode: StateMode;
  let reason: string;
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
  const root: StateRoot = {
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

  let base: string | null = null;
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
      let origin: unknown = null;
      try {
        origin = (JSON.parse(recorded) as { origin?: unknown }).origin;
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

export function durableDir(cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  return resolveStateRoot(cwd, env).durableDir;
}

export function evidenceDir(cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  return join(resolveStateRoot(cwd, env).durableDir, "evidence");
}

export function devlogDir(cwd: string, env: NodeJS.ProcessEnv = process.env): string | null {
  return resolveStateRoot(cwd, env).devlogDir;
}

export function isDurableDisabled(cwd: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveStateRoot(cwd, env).disabledReason !== null;
}

function toLabel(cwdAbs: string, p: string): string {
  const rel = relative(cwdAbs, p);
  if (rel !== "" && !rel.startsWith("..") && !isAbsolute(rel)) return rel.split(sep).join("/");
  return p;
}

/** A durable path for messages: relative to cwd when inside it (repo/local), else absolute. */
export function durableLabel(cwd: string, ...segments: string[]): string {
  const root = resolveStateRoot(cwd);
  return toLabel(root.cwd, join(root.durableDir, ...segments));
}

/** A devlog path for messages; falls back to the historical relative form in mode none. */
export function devlogLabel(cwd: string, ...segments: string[]): string {
  const root = resolveStateRoot(cwd);
  if (!root.devlogDir) return [DEVLOG_DIRNAME, ...segments].join("/");
  return toLabel(root.cwd, join(root.devlogDir, ...segments));
}

/**
 * local/external/none: hide checkout-local codexclaw files from git through the shared
 * <common dir>/info/exclude, which never modifies tracked files. Best-effort and idempotent;
 * repo mode never touches it.
 */
export function ensurePrivacyExcludes(cwd: string, env: NodeJS.ProcessEnv = process.env): void {
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
