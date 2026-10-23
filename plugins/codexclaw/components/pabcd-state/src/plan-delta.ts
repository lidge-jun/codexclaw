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
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { devlogDir, isInside, realpathLoose, resolveStateRoot } from "./state-root.ts";

export interface PlanEntry {
  /** The unit as attested at P>A (relative to cwd or absolute); re-checked on C>B. */
  unit: string;
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

/** Windows paths compare case-insensitively; everywhere else they are exact. */
function samePath(a: string, b: string): boolean {
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function isSymlink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * #315: the canonical directory of a plan unit that may serve as B>C evidence, or null.
 *
 * P>A accepts any directory with a numbered doc, so without this an unrelated directory
 * edited during B would pass SOURCE-DELTA-01. A unit counts only when:
 *  - it is a DIRECT child of the resolved plan root <devlog>/_plan (compared through the
 *    parent's real path, case-insensitively on Windows), never the root itself or a
 *    directory nested below a unit;
 *  - neither <devlog> nor <devlog>/_plan is a symlink, so the root cannot be pointed at
 *    an arbitrary tree;
 *  - when the unit itself is a symlink (plans kept in an excluded scratch folder), its
 *    target is not a filesystem root and does not contain the checkout or the plan root.
 * Mode none has no devlog, so nothing counts there.
 */
export function planUnitBinding(cwd: string, unit: string): string | null {
  const devlog = devlogDir(cwd);
  if (!devlog) return null;
  const planRoot = join(devlog, "_plan");
  if (isSymlink(devlog) || isSymlink(planRoot)) return null;
  const lexical = resolve(cwd, unit);
  const name = basename(lexical);
  if (!name || name === "." || name === "..") return null;
  let realParent: string;
  let realRoot: string;
  let target: string;
  try {
    realParent = realpathSync.native(dirname(lexical));
    realRoot = realpathSync.native(planRoot);
    target = realpathSync.native(lexical);
  } catch {
    return null;
  }
  if (!samePath(realParent, realRoot)) return null;
  if (dirname(target) === target) return null;
  const checkout = realpathLoose(resolveStateRoot(cwd).checkoutRoot);
  if (isInside(checkout, target) || isInside(realRoot, target)) return null;
  return target;
}

/**
 * Record the plan unit on entry to B. Null when no unit is bound, it cannot be read, or it
 * is not a plan unit (planUnitBinding). A C>B rework passes the stored entry: its attested
 * unit is checked again and must still resolve to the same canonical directory.
 */
export function capturePlanEntry(cwd: string, planUnit: string | null | undefined, previous?: PlanEntry | null): PlanEntry | null {
  const unit = planUnit ?? previous?.unit;
  if (!unit) return null;
  const path = planUnitBinding(cwd, unit);
  if (path === null) return null;
  if (!planUnit && previous && !samePath(previous.path, path)) return null;
  const digest = planUnitDigest(path);
  return digest === null ? null : { unit, path, digest, capturedAt: new Date().toISOString() };
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
  // An entry without its attested unit (written before this check existed) cannot be
  // re-validated, so it reads as absent and B>C falls back to the source check.
  if (typeof r.unit !== "string" || r.unit.length === 0) return null;
  if (typeof r.digest !== "string" || !/^[0-9a-f]{64}$/.test(r.digest)) return null;
  if (typeof r.capturedAt !== "string") return null;
  return { unit: r.unit, path: r.path, digest: r.digest, capturedAt: r.capturedAt };
}

/** Refusal detail: name the plan unit that was checked too, so the fix is obvious. */
export function describePlanUnchanged(entry: PlanEntry | null): string {
  return entry ? " and the plan docs in " + entry.path + " are unchanged too" : "";
}
