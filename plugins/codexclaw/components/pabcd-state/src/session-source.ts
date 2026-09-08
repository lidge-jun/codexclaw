/** Immutable per-session source binding; native state/identity never moves. */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, constants, fstatSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { isCanonicalSessionId, readState } from "./state.ts";

interface SourceBinding {
  version: 1;
  ownerSessionId: string;
  nativeCwd: string;
  sourceRoot: string;
  commonDir: string;
  gitDir: string;
}

/**
 * Canonical absolute path. `realpathSync.native` expands Windows 8.3 short names
 * (`RUNNER~1`) that the JS implementation leaves intact; Git always reports the long
 * form, so comparing a short-name cwd against `rev-parse` output would refuse a
 * valid worktree (observed on windows-latest CI where TEMP is a short path).
 */
function canonical(path: string): string {
  return realpathSync.native(path);
}

function gitIdentity(cwd: string): { root: string; commonDir: string; gitDir: string } {
  const env = { ...process.env };
  for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"]) delete env[name];
  const git = (...args: string[]) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    return {
      root: canonical(git("rev-parse", "--show-toplevel")),
      commonDir: canonical(git("rev-parse", "--path-format=absolute", "--git-common-dir")),
      gitDir: canonical(git("rev-parse", "--absolute-git-dir")),
    };
  } catch { throw new Error("Cannot resolve source Git worktree identity."); }
}

function bindingPath(cwd: string, sessionId: string): string {
  if (!isCanonicalSessionId(sessionId)) throw new Error("Invalid source-binding session ID.");
  for (const path of [join(cwd, ".codexclaw"), join(cwd, ".codexclaw", "sources")]) {
    try {
      const stat = lstatSync(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Source-binding directories must be real directories.");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
  return join(cwd, ".codexclaw", "sources", `${sessionId}.json`);
}

function readBinding(cwd: string, sessionId: string): SourceBinding | null {
  const path = bindingPath(cwd, sessionId);
  let fd: number;
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Source binding must be a regular file.");
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  let raw: unknown;
  try {
    if (!fstatSync(fd).isFile()) throw new Error("Source binding must be a regular file.");
    raw = JSON.parse(readFileSync(fd, "utf8"));
  } catch { throw new Error("Source binding is unreadable or corrupt; existing bytes were preserved."); }
  finally { closeSync(fd); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid source binding.");
  const b = raw as Record<string, unknown>;
  if (b.version !== 1 || b.ownerSessionId !== sessionId || b.nativeCwd !== canonical(cwd)
      || ![b.sourceRoot, b.commonDir, b.gitDir].every(p => typeof p === "string" && isAbsolute(p))) {
    throw new Error("Source binding has invalid identity or paths.");
  }
  return b as unknown as SourceBinding;
}

/** No binding keeps legacy behavior; a broken binding never falls back to cwd. */
export function resolveSessionSource(cwd: string, sessionId: string): string {
  const binding = readBinding(cwd, sessionId);
  const pinned = readState(cwd, sessionId).boundSourceRoot;
  if (!binding) {
    if (pinned) throw new Error("Source binding is missing for the pinned worktree; restore the same binding before continuing.");
    return cwd;
  }
  if (pinned && binding.sourceRoot !== pinned) throw new Error("Source binding differs from the session's pinned worktree.");
  const native = gitIdentity(cwd);
  const source = gitIdentity(binding.sourceRoot);
  if (source.root !== binding.sourceRoot || source.commonDir !== binding.commonDir
      || source.gitDir !== binding.gitDir || native.commonDir !== binding.commonDir) {
    throw new Error("Bound source worktree moved or its repository identity changed.");
  }
  return binding.sourceRoot;
}

/** Caller must corroborate native identity and inspect the existing state first. */
export function bindSessionSource(cwd: string, sessionId: string, target: string): string {
  if (!isAbsolute(target)) throw new Error("Source worktree path must be absolute.");
  const nativeCwd = canonical(cwd);
  const sourceRoot = canonical(target);
  const native = gitIdentity(cwd), source = gitIdentity(sourceRoot);
  if (source.root !== sourceRoot || source.commonDir !== native.commonDir || source.gitDir === native.gitDir) {
    throw new Error("Source must be a linked worktree root in the native session's repository.");
  }
  const previous = readBinding(cwd, sessionId);
  if (previous) {
    if (resolveSessionSource(cwd, sessionId) !== sourceRoot) throw new Error("Source binding is immutable; use a new session for a different worktree.");
    return sourceRoot;
  }
  const state = readState(cwd, sessionId);
  if (state.boundSourceRoot && state.boundSourceRoot !== sourceRoot) throw new Error("Cannot replace the session's pinned source worktree.");
  if (!state.boundSourceRoot && !["IDLE", "I", "P", "A"].includes(state.phase)) {
    throw new Error("Bind the source before B. Preserve the old baseline and re-plan before binding.");
  }
  const binding: SourceBinding = { version: 1, ownerSessionId: sessionId, nativeCwd, sourceRoot, commonDir: source.commonDir, gitDir: source.gitDir };
  const path = bindingPath(cwd, sessionId);
  mkdirSync(join(cwd, ".codexclaw", "sources"), { recursive: true });
  bindingPath(cwd, sessionId);
  const tmp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(binding, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  try {
    try { linkSync(tmp, path); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err; }
  } finally { unlinkSync(tmp); }
  if (resolveSessionSource(cwd, sessionId) !== sourceRoot) throw new Error("Another source binding won publication; existing binding preserved.");
  return sourceRoot;
}
