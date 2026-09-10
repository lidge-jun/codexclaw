/**
 * repo-key.ts — project identity for recall scoping (260910 wp4).
 *
 * A managed worktree (~/.codex/worktrees/<slot>/<repo>) and the main checkout of
 * the same repository are different cwd prefixes, so a path-only scope treats
 * them as different projects. The git remote is the identity they share: both
 * report the same remote.origin.url, and Codex already records that URL in
 * session_meta (payload.git.repository_url) and in threads.git_origin_url.
 *
 * normalizeRepoKey folds the spellings of ONE remote onto one key. It never
 * folds two different remotes together: the path part keeps its case and its
 * full owner/name, so a fork (bitkyc08-arch/cli-jaw) stays distinct from the
 * original (lidge-jun/cli-jaw). Anything unparseable is null, and a null key
 * simply leaves the caller on the cwd-prefix behaviour it had before.
 */
import { spawnSync } from "node:child_process";

/** Injection point: tests supply a stub instead of spawning git. */
export type ReadOriginUrl = (cwd: string) => string | null;

/** git is a subprocess on the search hot path; a stuck one must not hang recall. */
const GIT_TIMEOUT_MS = 1_500;

/**
 * "host/owner/name" for one remote URL, or null when it is absent/unparseable.
 *
 * Host folds to lower case because DNS is case-insensitive and the same remote
 * is typed both ways; the path does NOT fold, because a forge path can be
 * case-sensitive and folding it would merge two distinct repositories.
 */
export function normalizeRepoKey(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // scp-like syntax (git@github.com:owner/name.git) is not a URL: it has no
  // scheme, and new URL() would read "git@github.com" as the scheme.
  if (!trimmed.includes("://")) {
    const scp = /^(?:[^@/\s]+@)?([^:/\s]+):(.+)$/.exec(trimmed);
    if (scp) return pack(scp[1], scp[2]);
    return null;
  }
  try {
    const url = new URL(trimmed);
    // hostname drops userinfo and port; both are transport detail, not identity.
    return pack(url.hostname, decodeURIComponent(url.pathname));
  } catch {
    return null;
  }
}

function pack(host: string, path: string): string | null {
  const h = host.trim().toLowerCase();
  const p = path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  if (h === "" || p === "") return null;
  return `${h}/${p}`;
}

/**
 * The origin URL configured for `cwd`, or null when git cannot answer.
 *
 * Every failure mode is one null: no git on PATH, not a repository, no origin
 * remote, a timeout. The caller then keeps the cwd-prefix scope, which is the
 * behaviour that existed before this module.
 */
export function readOriginUrl(cwd: string): string | null {
  if (typeof cwd !== "string" || cwd.trim() === "") return null;
  try {
    const r = spawnSync("git", ["-C", cwd, "config", "--get", "remote.origin.url"], {
      encoding: "utf8",
      timeout: GIT_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (r.status !== 0) return null;
    const out = (r.stdout ?? "").trim();
    return out === "" ? null : out;
  } catch {
    return null;
  }
}

/** Normalized project key for a working directory (null when it has no origin). */
export function repoKeyForCwd(cwd: string, readUrl: ReadOriginUrl = readOriginUrl): string | null {
  return normalizeRepoKey(readUrl(cwd));
}

/** Two keys identify the same project. null/empty never matches anything. */
export function repoKeysEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return typeof a === "string" && a !== "" && a === b;
}
