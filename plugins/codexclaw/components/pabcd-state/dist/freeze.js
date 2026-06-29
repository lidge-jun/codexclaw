/**
 * freeze.ts — interview freeze manifest + stale detection (L10.3 / 103).
 *
 * Exact manifest pin (103 Hardening pins):
 *   path  = .codexclaw/interview/freeze.json (per-session; plan content under .codexclaw/plan/)
 *   shape = { frozenAt, planFiles:[{path,sha256}], planHash, objective, slug, evidenceBundle }
 *   planHash = sha256(concat of per-file sha256 in path order)
 *
 * The frozen plan files MUST contain `## OPEN ASSUMPTIONS`; because planHash is
 * derived from the plan file contents, that section is hash-covered (a changed
 * assumption changes the file sha256 -> changes planHash -> stale at goal start).
 *
 * Pure hashing + manifest shaping live here; file IO is the caller's job so this
 * stays testable without touching the real .codexclaw/.
 */
import { createHash } from "node:crypto";
                                                       

export const PLAN_SUBDIR = "plan";
export const FREEZE_MANIFEST_DIR = "interview";
export const FREEZE_MANIFEST_FILE = "freeze.json";

                               
                                                
                 
 

/** R-5 structured evidence bundle carried into goal handoff (not objective+hash only). */
                                 
                                                    
                                                                                                     
                                                     
                               
                                   
 

                                 
                              
                            
                                                                      
                    
               
                                 
 

export function sha256(content        )         {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** planHash = sha256 of per-file sha256 joined in path order (103 pin). */
export function computePlanHash(files                )         {
  const joined = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => f.sha256)
    .join("");
  return sha256(joined);
}

/** slug = lowercase objective, non-alphanumeric -> '-', collapse repeats, trim, cap 48 (103 pin). */
export function deriveSlug(objective        )         {
  const s = (objective ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return s.length > 0 ? s : "interview";
}

                                     
                    
                            
                                 
                     
 

export function buildFreezeManifest(input                    )                 {
  const now = input.now ?? (() => new Date().toISOString());
  const planFiles = [...input.planFiles].sort((a, b) => a.path.localeCompare(b.path));
  return {
    frozenAt: now(),
    planFiles,
    planHash: computePlanHash(planFiles),
    objective: input.objective,
    slug: deriveSlug(input.objective),
    evidenceBundle: input.evidenceBundle,
  };
}

                                   
                 
                         
                 
 

/**
 * Goal-start integration: recompute the current planHash and compare it to the
 * frozen manifest. Stale when planHash differs OR any file changed/missing/new.
 * Stale -> refuse execution + re-freeze (103). A changed `## OPEN ASSUMPTIONS`
 * changes the plan file sha256 and is therefore caught here.
 */
export function checkStale(manifest                , currentFiles                )                   {
  const frozen = new Map(manifest.planFiles.map((f) => [f.path, f.sha256]));
  const current = new Map(currentFiles.map((f) => [f.path, f.sha256]));
  const changed           = [];
  for (const [path, hash] of frozen) {
    if (current.get(path) !== hash) changed.push(path);
  }
  for (const path of current.keys()) {
    if (!frozen.has(path)) changed.push(path);
  }
  const planHashChanged = computePlanHash(currentFiles) !== manifest.planHash;
  const stale = changed.length > 0 || planHashChanged;
  return {
    stale,
    changedFiles: changed.sort(),
    reason: stale
      ? `plan changed since freeze (${changed.length} file(s), planHash ${planHashChanged ? "differs" : "matches"}); re-freeze before goal start — stale execution refused`
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
  "did not start — do not proceed as if it did. On goal start, recompute planHash and compare to",
  ".codexclaw/interview/freeze.json; on mismatch, re-freeze the current plan before proceeding.",
].join("\n");
