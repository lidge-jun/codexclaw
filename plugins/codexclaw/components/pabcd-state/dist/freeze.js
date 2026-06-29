/**
 * freeze.ts — interview freeze manifest + stale detection (L10.3 / 103).
 *
 * When the interview is ready, the main session writes the canonical plan under
 * .codexclaw/plan/<slug>/ and freezes it: the manifest records each file's
 * sha256 + a structured evidence bundle (R-5: dimensions, OPEN ASSUMPTIONS,
 * contradictions, seed/AC, research report ref). At goal start the current files
 * are re-hashed and compared; a mismatch refuses stale execution and re-freezes.
 *
 * The plugin does NOT create the native goal (it is not a fork). It emits an
 * activation directive (R-7) telling the main session to call get_goal then
 * objective-only create_goal; goal lifecycle is owned by codex.
 *
 * Pure hashing + manifest shaping live here; IO (read plan dir, write manifest)
 * is injected so this stays testable without touching the real .codexclaw/.
 */
import { createHash } from "node:crypto";
                                                       

export const PLAN_SUBDIR = "plan";
export const FREEZE_MANIFEST = "freeze.json";

                               
                                                
                 
 

/** R-5 structured evidence bundle carried into goal handoff (not objective+hash only). */
                                 
                                                    
                                                                 
                                                     
                                   
                                   
 

                                 
             
               
                   
                   
                        
                           
 

export function sha256(content        )         {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Deterministic freezeId from the sorted file hashes (stable, replayable). */
export function computeFreezeId(files                )         {
  const joined = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => `${f.path}:${f.sha256}`)
    .join("\n");
  return sha256(joined).slice(0, 16);
}

                                     
               
                        
                           
                     
 

export function buildFreezeManifest(input                    )                 {
  const now = input.now ?? (() => new Date().toISOString());
  const files = [...input.files].sort((a, b) => a.path.localeCompare(b.path));
  return {
    version: 1,
    slug: input.slug,
    frozenAt: now(),
    freezeId: computeFreezeId(files),
    files,
    evidence: input.evidence,
  };
}

                                   
                 
                         
                 
 

/**
 * Compare a frozen manifest against the CURRENT plan file hashes. Stale when any
 * file's hash changed, a frozen file is missing, or a new file appeared. Goal
 * start must refuse stale execution and re-freeze (103).
 */
export function checkStale(manifest                , currentFiles                )                   {
  const frozen = new Map(manifest.files.map((f) => [f.path, f.sha256]));
  const current = new Map(currentFiles.map((f) => [f.path, f.sha256]));
  const changed           = [];
  for (const [path, hash] of frozen) {
    if (current.get(path) !== hash) changed.push(path);
  }
  for (const path of current.keys()) {
    if (!frozen.has(path)) changed.push(path);
  }
  const stale = changed.length > 0;
  return {
    stale,
    changedFiles: changed.sort(),
    reason: stale
      ? `plan changed since freeze (${changed.length} file(s)); re-freeze before goal start — stale execution refused`
      : "frozen manifest matches current plan",
  };
}

/** R-7 activation directive: plugin can't call create_goal, so it instructs the main session. */
export const GOAL_ACTIVATION_DIRECTIVE = [
  "[codexclaw: FREEZE -> goal handoff]",
  "Interview is ready and the plan is frozen. To start execution under a native goal:",
  "1. Call get_goal to confirm no goal is already active for this thread.",
  "2. Call create_goal with objective ONLY (no token_budget — the L3 gate denies budgeted goals).",
  "3. Verify a goal row was actually created (codex owns goal lifecycle in goals_1.sqlite).",
  "The frozen plan under .codexclaw/plan/ is the READ-ONLY spec the goal consumes; do not reopen",
  "Interview once the goal is active (L11 hard-deny). If create_goal fails, report that goal mode",
  "did not start — do not proceed as if it did.",
].join("\n");
