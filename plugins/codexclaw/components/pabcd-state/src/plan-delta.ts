/**
 * plan-delta.ts — the plan unit as B>C evidence (#315).
 *
 * SOURCE-DELTA-01 asks whether anything was produced during B. A repository that
 * commits its plans answers that through git: a plan edit is a source change. A
 * repository that forbids committing plans keeps them outside the commit, where git
 * cannot see them, so a docs-only roadmap cycle could never pass B>C there.
 *
 * On entry to B the bound plan unit is recorded by canonical path and a digest of its
 * plan documents. At B>C a changed digest counts the same way a changed source does.
 *
 * Only what P>A itself calls the plan is hashed: numbered docs (000_*.md) that are
 * regular files directly inside the unit. Anything else in the directory (codexclaw's
 * own state and ledger, logs, editor files, a whole checkout bound as ".") must not
 * read as implementation work. The canonical path is pinned at B entry, so
 * retargeting a symlink to the unit between two unchanged directories is no change.
 */
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

export interface PlanEntry {
  /** Canonical (realpath) directory of the plan unit bound at P>A. */
  path: string;
  /** sha256 over the unit's numbered plan docs (name + content), sorted. */
  digest: string;
  capturedAt: string;
}

/** Same definition the P>A plan gate uses (plan-gate.ts). */
const NUMBERED_DOC_RE = /^\d{3}_.+\.md$/;
const MAX_DOCS = 256;

/** Digest of a plan unit's numbered docs, or null when it is not a real directory. */
export function planUnitDigest(dir: string): string | null {
  let names: string[];
  try {
    // lstat: a unit that became a symlink after B began is not the directory we pinned.
    if (!lstatSync(dir).isDirectory()) return null;
    names = readdirSync(dir).filter((name) => NUMBERED_DOC_RE.test(name)).sort().slice(0, MAX_DOCS);
  } catch {
    return null;
  }
  const h = createHash("sha256");
  for (const name of names) {
    let content: Buffer;
    try {
      if (!lstatSync(join(dir, name)).isFile()) continue;
      content = readFileSync(join(dir, name));
    } catch {
      continue;
    }
    h.update(name);
    h.update("\0");
    h.update(createHash("sha256").update(content).digest("hex"));
    h.update("\0");
  }
  return h.digest("hex");
}

/** Record the plan unit on entry to B. Null when no unit is bound or it cannot be read. */
export function capturePlanEntry(cwd: string, planUnit: string | null | undefined): PlanEntry | null {
  if (!planUnit) return null;
  let path: string;
  try {
    path = realpathSync.native(isAbsolute(planUnit) ? resolve(planUnit) : resolve(cwd, planUnit));
  } catch {
    return null;
  }
  const digest = planUnitDigest(path);
  return digest === null ? null : { path, digest, capturedAt: new Date().toISOString() };
}

/** The plan unit's change since B began, or null when there is none to report. */
export function planDeltaSince(entry: PlanEntry | null): { path: string; before: string; after: string } | null {
  if (!entry) return null;
  const after = planUnitDigest(entry.path);
  if (after === null || after === entry.digest) return null;
  return { path: entry.path, before: entry.digest, after };
}

/** Strict rebuild of a persisted entry; anything else reads as null. */
export function reconstructPlanEntry(raw: unknown): PlanEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.path !== "string" || !isAbsolute(r.path)) return null;
  if (typeof r.digest !== "string" || !/^[0-9a-f]{64}$/.test(r.digest)) return null;
  if (typeof r.capturedAt !== "string") return null;
  return { path: r.path, digest: r.digest, capturedAt: r.capturedAt };
}

/** Refusal detail: name the plan unit that was checked too, so the fix is obvious. */
export function describePlanUnchanged(entry: PlanEntry | null): string {
  return entry ? " and the plan docs in " + entry.path + " are unchanged too" : "";
}
