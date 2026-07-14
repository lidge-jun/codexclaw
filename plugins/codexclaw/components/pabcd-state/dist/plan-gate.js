/**
 * plan-gate.ts — on-disk plan-artifact gate for the P>A edge (260714 wp2).
 *
 * attest.ts stays pure (no IO) per its header contract; THIS module owns the
 * filesystem side: P>A only advances when the attestation names a real
 * devlog/_plan unit that already contains numbered plan docs
 * (DIFFLEVEL-ROADMAP-01 / LEXICO-SPLIT-01). A chat-message plan or a one-line
 * `did` no longer satisfies P — the plan must exist as files.
 *
 * Caller gates the edge (state.phase === "P" && verb === "A"); `att` may be
 * null (bare `cxc orchestrate A`) — the gate still fires so the FIRST error
 * names planUnit. Fail-closed on the P>A edge; other edges never call this.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";




/** Numbered plan doc: 000_plan.md, 010_phase1_x.md, ... (3-digit repo convention). */
const NUMBERED_DOC_RE = /^\d{3}_.+\.md$/;

export function validatePlanArtifacts(att                    , cwd        )               {
  if (!att?.planUnit) {
    return {
      ok: false,
      reason:
        'P -> A requires "planUnit": the devlog/_plan/YYMMDD_slug/ unit this plan lives in ' +
        "(DIFFLEVEL-ROADMAP-01 — the plan must exist as numbered files, not chat). " +
        "Scaffold one with `cxc plan init <slug>` if missing, write the docs, then re-attest " +
        'with --attest \'{"from":"P","to":"A","did":"...","planUnit":"devlog/_plan/..."}\'.',
    };
  }
  const unit = isAbsolute(att.planUnit) ? att.planUnit : resolve(cwd, att.planUnit);
  let isDir = false;
  try {
    isDir = existsSync(unit) && statSync(unit).isDirectory();
  } catch {
    isDir = false;
  }
  if (!isDir) {
    return {
      ok: false,
      reason: `planUnit ${att.planUnit} does not exist (or is not a directory). Create it with \`cxc plan init <slug>\` and write the plan docs before P -> A.`,
    };
  }
  let docs           = [];
  try {
    docs = readdirSync(unit).filter((f) => NUMBERED_DOC_RE.test(f));
  } catch {
    docs = [];
  }
  if (docs.length === 0) {
    return {
      ok: false,
      reason: `planUnit ${att.planUnit} has no numbered plan docs (000_*.md ...). A chat-message plan does not satisfy P (LEXICO-SPLIT-01) — write the diff-level docs first.`,
    };
  }
  for (const p of att.planPaths ?? []) {
    const abs = isAbsolute(p) ? p : resolve(cwd, p);
    if (!existsSync(abs)) {
      return { ok: false, reason: `planPaths entry ${p} does not exist on disk.` };
    }
  }
  return { ok: true };
}
