/**
 * source-identity.ts — what source tree produced a receipt (WP9 / plan 020).
 *
 * "The receipt is non-empty" does not stop stale evidence: run the tests, then
 * edit the code, and the receipt still looks valid. This module produces the
 * primitive that lets a consumer tell whether the tree moved since a receipt
 * was captured. It enforces nothing on its own — 030/040/070 are the consumers.
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";













/**
 * discriminated result. A boolean|string union would let "unavailable" pass as
 * truthy and read as "same". Naming all three cases forces the consumer to
 * branch on `.kind`.
 *
 * Note: returning an object does NOT make `if (compareSource(a, b))` a type
 * error — it compiles fine and is always true. `assertNever` below is the
 * actual guard.
 */





/** Exhaustiveness guard for `switch (result.kind)`; consumers re-export this. */
export function assertNever(value       )        {
  throw new Error(`unhandled case: ${JSON.stringify(value)}`);
}









function git(cwd        , args          )         {
  return execFileSync("git", args, { cwd, maxBuffer: 64 * 1024 * 1024 });
}

/**
 * Parse `git status --porcelain=v1 -z --untracked-files=all`.
 *
 * Both flags matter. Without `-z` git C-quotes any path holding a space, quote,
 * tab or newline, so splitting on whitespace reconstructs the wrong path.
 * Without `--untracked-files=all` an untracked directory collapses to a single
 * `?? dir/` entry that does not change when a file inside it changes — a
 * straight hole in staleness detection.
 *
 * Records are `XY<space><path>\0`, and a rename or copy is followed by one more
 * NUL-terminated field holding the original path.
 */
function parseStatusZ(buf        )                 {
  const fields           = [];
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0) {
      fields.push(buf.subarray(start, i).toString("utf8"));
      start = i + 1;
    }
  }
  const out                 = [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (!field || field.length < 4) continue;
    const xy = field.slice(0, 2);
    const path = field.slice(3);
    if (xy[0] === "R" || xy[0] === "C") {
      const origPath = fields[++i] ?? "";
      out.push({ xy, path, origPath });
    } else {
      out.push({ xy, path });
    }
  }
  return out;
}

/**
 * Hash one entry's bytes when the path still exists.
 *
 * Existence decides this, not the status letter. A rename whose content was
 * then edited stays `RM` forever, so keying on the letter would let every later
 * edit slip past. Symlinks hash their target string rather than being followed.
 */
function contentHash(abs        )                {
  try {
    const st = lstatSync(abs);
    if (st.isSymbolicLink()) return createHash("sha256").update(readlinkSync(abs)).digest("hex");
    if (!st.isFile()) return null;
    return createHash("sha256").update(readFileSync(abs)).digest("hex");
  } catch {
    return null;
  }
}

/**
 * Hash the whole non-clean set.
 *
 * No metadata-only shortcut for large sets: path+size+mtime collides on a
 * same-size edit and on a restored timestamp, which is exactly the case this
 * module exists to catch. If the set is enormous the answer is a better
 * .gitignore, not a weaker identity.
 */
function hashRecords(cwd        , records                )         {
  const sorted = [...records].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const h = createHash("sha256");
  for (const rec of sorted) {
    h.update(rec.xy);
    h.update("\0");
    h.update(rec.path);
    h.update("\0");
    if (rec.origPath !== undefined) {
      h.update(rec.origPath);
      h.update("\0");
    }
    const content = contentHash(join(cwd, rec.path));
    if (content !== null) h.update(content);
    h.update("\0");
  }
  return h.digest("hex");
}

/**
 * Entries the B>C source-delta gate must not count as implementation work
 * (SOURCE-DELTA-01, 050). The FSM's own writes live under `.codexclaw/` — session
 * state, the ledger, goalplans — so without this the act of recording a transition
 * would register as a tree change and the gate would clear itself on every run.
 * The whole directory is excluded, not just sessions, because every file in it is
 * the harness writing about itself rather than the work being measured.
 *
 * Scoped to this option so the default identity — used for review-round and receipt
 * binding, where the state directory genuinely is part of the tree — is unchanged.
 */
const STATE_DIR_PREFIX = ".codexclaw/";






export function captureSourceIdentity(cwd        , options                 = {})                 {
  const capturedAt = new Date().toISOString();
  let commitSha = "";
  try {
    commitSha = git(cwd, ["rev-parse", "HEAD"]).toString("utf8").trim();
  } catch {
    // A repo with no commits yet still has a working tree worth hashing, so
    // only a failing status call makes the identity unavailable.
    commitSha = "";
  }
  let records                ;
  try {
    records = parseStatusZ(git(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]));
  } catch {
    return { kind: "unavailable", commitSha: "", dirty: false, capturedAt };
  }
  if (options.excludeCodexclawArtifacts) {
    records = records.filter((r) => !r.path.startsWith(STATE_DIR_PREFIX));
  }
  if (records.length === 0) return { kind: "resolved", commitSha, dirty: false, capturedAt };
  return { kind: "resolved", commitSha, dirty: true, treeHash: hashRecords(cwd, records), capturedAt };
}

export function compareSource(a                , b                )                   {
  if (a.kind === "unavailable" || b.kind === "unavailable") {
    return { kind: "unavailable", reason: "git could not resolve the source identity on at least one side" };
  }
  if (a.commitSha !== b.commitSha) {
    return { kind: "different", detail: `commit ${a.commitSha.slice(0, 7)} -> ${b.commitSha.slice(0, 7)}` };
  }
  if (a.dirty !== b.dirty) {
    return { kind: "different", detail: `working tree went ${a.dirty ? "clean" : "dirty"}` };
  }
  if ((a.treeHash ?? "") !== (b.treeHash ?? "")) {
    return { kind: "different", detail: "uncommitted changes differ" };
  }
  return { kind: "same" };
}

/** Short human-readable form for deny messages. */
export function describeSource(id                )         {
  if (id.kind === "unavailable") return "source unavailable (no git)";
  const sha = id.commitSha ? id.commitSha.slice(0, 7) : "no-commit";
  return id.dirty ? `${sha}+dirty` : sha;
}

function existsRepo(cwd        )          {
  return existsSync(join(cwd, ".git"));
}

/** True when `cwd` looks like a git working tree root. Advisory only. */
export function looksLikeRepo(cwd        )          {
  return existsRepo(cwd);
}
