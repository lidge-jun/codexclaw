/**
 * plan-delta.ts — the plan unit as B>C evidence (#315).
 *
 * SOURCE-DELTA-01 asks whether anything was produced during B. A repository that
 * commits its plans answers that through git: a plan edit is a source change. A
 * repository that forbids committing plans keeps them outside the commit, where git
 * cannot see them, so a docs-only roadmap cycle could never pass B>C there.
 *
 * On entry to B the bound plan unit is recorded by absolute path and content digest.
 * At B>C a changed digest counts the same way a changed source does. This gives
 * the second kind of repository parity with the first and weakens nothing for it:
 * in a repository that commits plans the same edit already changed the source.
 */
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

export interface PlanEntry {
  /** Absolute path of the plan unit directory bound at P>A. */
  path: string;
  /** sha256 over the unit's regular files (relative path + content), sorted. */
  digest: string;
  capturedAt: string;
}

/** Walk bound: a plan unit is a handful of markdown files, never a tree to crawl. */
const MAX_FILES = 512;
const MAX_DEPTH = 4;

/** Digest of a plan unit directory, or null when it is missing or not a directory. */
export function planUnitDigest(dir: string): string | null {
  try {
    if (!statSync(dir).isDirectory()) return null;
  } catch {
    return null;
  }
  const files: string[] = [];
  const walk = (rel: string, depth: number): void => {
    if (depth > MAX_DEPTH || files.length >= MAX_FILES) return;
    let names: string[];
    try {
      names = readdirSync(join(dir, rel)).sort();
    } catch {
      return;
    }
    for (const name of names) {
      if (files.length >= MAX_FILES) return;
      const relPath = rel ? rel + "/" + name : name;
      let st;
      try {
        st = lstatSync(join(dir, relPath));
      } catch {
        continue;
      }
      // Symlinks inside the unit are skipped: they could point the digest at
      // anything, including files that change on their own.
      if (st.isDirectory()) walk(relPath, depth + 1);
      else if (st.isFile()) files.push(relPath);
    }
  };
  walk("", 0);
  const h = createHash("sha256");
  for (const relPath of files.sort()) {
    let content: Buffer;
    try {
      content = readFileSync(join(dir, relPath));
    } catch {
      continue;
    }
    h.update(relPath);
    h.update("\0");
    h.update(createHash("sha256").update(content).digest("hex"));
    h.update("\0");
  }
  return h.digest("hex");
}

/** Record the plan unit on entry to B. Null when no unit is bound or it cannot be read. */
export function capturePlanEntry(cwd: string, planUnit: string | null | undefined): PlanEntry | null {
  if (!planUnit) return null;
  const path = isAbsolute(planUnit) ? resolve(planUnit) : resolve(cwd, planUnit);
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
  return entry ? " and the plan unit " + entry.path + " is unchanged too" : "";
}
