/**
 * triage.ts — auto-mode severity triage + assumption transition (L10.2 / 102).
 *
 * Converts L9 contradictions into either a user question (high severity, manual
 * interview) or a recorded assumption (low/medium). Pure functions: callers own
 * the actual request_user_input call and state write.
 *
 * Policy (FROZEN 102):
 *  - low    -> recorded assumption (conservative)
 *  - medium -> recorded assumption by default
 *  - high   -> user question (manual interview); CANNOT be safe-defaulted
 *  - goal-mode backfill: a high gap becomes a high-severity assumption requiring
 *    user review (goal mode cannot ask).
 *  - rhythm guard: after 3 consecutive auto-resolves, the next contradiction is
 *    escalated to the user regardless of severity.
 *  - an auto-resolved contradiction moves contradictions[] -> assumptions[]
 *    (recorded:true) only AFTER it is written into `## OPEN ASSUMPTIONS`.
 */
                                                                                       

                                                    
                                                            

/** Consecutive auto-resolves allowed before forcing a user escalation (102). */
export const AUTO_RESOLVE_RHYTHM_LIMIT = 3;

                                 
                       
                                                                     
                                             
                 
 

/**
 * Decide how a single contradiction exits, given the interview mode and how many
 * auto-resolves happened back-to-back. Never silently defaults a high-severity
 * gap in manual interview.
 */
export function triageContradiction(
  severity                       ,
  mode            ,
  consecutiveAutoResolves        ,
)                 {
  // rhythm guard: force a user question after N consecutive auto-resolves (manual only).
  if (mode === "manual" && consecutiveAutoResolves >= AUTO_RESOLVE_RHYTHM_LIMIT) {
    return { action: "ask_user", reason: `rhythm guard: ${consecutiveAutoResolves} consecutive auto-resolves -> escalate` };
  }

  if (severity === "high") {
    if (mode === "manual") {
      return { action: "ask_user", reason: "high severity in manual interview must go to the user" };
    }
    // goal-backfill cannot ask: keep as a high-severity assumption needing review.
    return {
      action: "record_assumption",
      assumptionSeverity: "high",
      reason: "goal-mode backfill: high gap recorded as high-severity assumption requiring user review",
    };
  }

  // low / medium -> conservative recorded assumption
  return {
    action: "record_assumption",
    assumptionSeverity: severity,
    reason: `${severity} severity auto-resolved to a recorded assumption`,
  };
}

                                    
                                  
                            
                                  
 

/**
 * Move one contradiction out of contradictions[] and into assumptions[] as a
 * recorded assumption. The caller MUST have already written the assumption text
 * into `## OPEN ASSUMPTIONS` (recorded:true reflects that visibility, 102).
 * Returns new arrays + the updated rhythm counter (do not mutate inputs).
 */
export function autoResolveToAssumption(
  contradictions                 ,
  assumptions              ,
  target               ,
  assumptionText        ,
  consecutiveAutoResolves        ,
)                    {
  const remaining = contradictions.filter((c) => c.contradictionId !== target.contradictionId);
  const assumption             = {
    id: target.contradictionId || `assumption-${assumptions.length + 1}`,
    text: assumptionText,
    recorded: true,
  };
  return {
    contradictions: remaining,
    assumptions: [...assumptions, assumption],
    consecutiveAutoResolves: consecutiveAutoResolves + 1,
  };
}
