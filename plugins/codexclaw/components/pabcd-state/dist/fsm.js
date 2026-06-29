import { WORK_PHASES,                        } from "./state.js";
import {                   validateAttest } from "./attest.js";

/** Canonical work-phase order (I..D). IDLE is the rest state outside this order. */
export const ORDER                   = WORK_PHASES;

export function canEnter(to       , state       )                                   {
  switch (to) {
    case "IDLE":
      // Closing/resetting to IDLE is always permitted (cycle close or reset).
      return { ok: true };
    case "I":
      return { ok: true };
    case "P":
      // P is enterable from IDLE (interview optional) or from I once interview ran.
      if (state.phase === "IDLE") return { ok: true };
      return state.flags.interview
        ? { ok: true }
        : { ok: false, reason: "interview not completed (I->P needs interview flag)" };
    case "A":
      return { ok: true };
    case "B":
      return state.flags.auditPassed
        ? { ok: true }
        : { ok: false, reason: "audit gate closed (need auditPassed via A->B attestation)" };
    case "C":
      return { ok: true };
    case "D":
      return state.flags.checkPassed
        ? { ok: true }
        : { ok: false, reason: "check gate closed (need checkPassed via C->D attestation)" };
    default:
      return { ok: false, reason: `unknown phase ${String(to)}` };
  }
}

/**
 * nextPhase follows I,P,A,B,C,D and then closes to IDLE after D. From IDLE the
 * caller chooses the entry (I or P) explicitly, so nextPhase(IDLE) is null.
 */
export function nextPhase(state       )               {
  if (state.phase === "D") return "IDLE";
  if (state.phase === "IDLE") return null;
  const i = ORDER.indexOf(state.phase);
  return i < 0 || i + 1 >= ORDER.length ? null : ORDER[i + 1];
}

export const isAuditGateOpen = (s       )          => s.phase === "A" || s.flags.auditPassed;
export const isBuildGateOpen = (s       )          => s.flags.auditPassed;
export const isDone = (s       )          => s.phase === "D" && s.flags.checkPassed;
export const isIdle = (s       )          => s.phase === "IDLE";

                                   
              
                
                  
 

/**
 * Structural transition with attest enforcement (007 R-2). This is the single
 * place gate flags (auditPassed/checkPassed) flip to true — and ONLY when a valid
 * attestation is supplied for a gated forward transition (A->B, C->D). Forward
 * motion without evidence is rejected fail-closed; no flag flips, no phase change.
 *
 * Pure: returns the next State for the caller to persist; performs no IO.
 */
export function transition(state       , to       , attest                     )                   {
  const from = state.phase;

  // 1) structural evidence gate (only A->B and C->D are gated).
  const gate = validateAttest(from, to, attest ?? null);
  if (!gate.ok) return { ok: false, reason: gate.reason };

  // 2) flip the gate flag the gated transition unlocks, BEFORE the canEnter check
  //    so the corresponding flag-based gate opens for this validated transition.
  const flags = { ...state.flags };
  if (from === "A" && to === "B") flags.auditPassed = true;
  if (from === "C" && to === "D") flags.checkPassed = true;
  if (from === "IDLE" && to === "I") flags.interview = false; // fresh cycle

  // 3) FSM legality.
  const legal = canEnter(to, { ...state, flags });
  if (!legal.ok) return { ok: false, reason: legal.reason };

  // 4) D->IDLE closes the cycle: reset gate flags + orchestration for the next pass.
  if (from === "D" && to === "IDLE") {
    return {
      ok: true,
      state: {
        ...state,
        phase: "IDLE",
        flags: { interview: false, auditPassed: false, checkPassed: false },
        orchestrationActive: false,
        lastInjectedPhase: null,
      },
    };
  }

  // 5) entering I marks interview-in-progress; the I->P gate needs interview=true,
  //    which the interview loop sets when it completes (out of scope here).
  return { ok: true, state: { ...state, phase: to, flags } };
}
