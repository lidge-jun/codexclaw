import { WORK_PHASES, type Phase, type State } from "./state.ts";
import { type Attestation, validateAttest } from "./attest.ts";
import { isInterviewReady } from "./interview.ts";

/** Canonical work-phase order (I..D). IDLE is the rest state outside this order. */
export const ORDER: readonly Phase[] = WORK_PHASES;

/**
 * Legal phase-adjacency table (L2/020), ported byte-faithful from cli-jaw
 * `orchestrator/state-machine.ts` VALID_TRANSITIONS. An edge not listed here is
 * illegal regardless of gate flags — `canEnter` rejects it before the flag checks,
 * so `auditPassed`/`checkPassed` can never unlock an out-of-sequence jump.
 *   IDLE->I|P · I->P|IDLE · P->I|A · A->I|B · B->I|C · C->I|D|B|P · D->I|IDLE
 * Backward edges C->B (re-build) and C->P (re-plan) are intentional loop routes.
 */
export const VALID_TRANSITIONS: Readonly<Record<Phase, readonly Phase[]>> = {
  IDLE: ["I", "P"],
  I: ["P", "IDLE"],
  P: ["I", "A"],
  A: ["I", "B"],
  B: ["I", "C"],
  C: ["I", "D", "B", "P"],
  D: ["I", "IDLE"],
};

/** True when `to` is a legal adjacency from `from` per VALID_TRANSITIONS. */
export function isLegalEdge(from: Phase, to: Phase): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

export function canEnter(to: Phase, state: State): { ok: boolean; reason?: string } {
  // Adjacency precheck (L2): an illegal edge is rejected up front, before any
  // flag-based gate, so a stray auditPassed/checkPassed cannot authorize a jump
  // that the state machine forbids (e.g. I->B, IDLE->A, P->IDLE).
  if (!isLegalEdge(state.phase, to)) {
    return { ok: false, reason: `illegal transition ${state.phase}->${to}` };
  }
  switch (to) {
    case "IDLE":
      // Closing/resetting to IDLE is always permitted (cycle close or reset).
      return { ok: true };
    case "I":
      return { ok: true };
    case "P":
      // P is enterable from IDLE (interview optional) or from I once interview ran.
      // C->P (replan) is a legal adjacency and needs no interview flag.
      if (state.phase === "IDLE" || state.phase === "C") return { ok: true };
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
export function nextPhase(state: State): Phase | null {
  if (state.phase === "D") return "IDLE";
  if (state.phase === "IDLE") return null;
  const i = ORDER.indexOf(state.phase);
  return i < 0 || i + 1 >= ORDER.length ? null : ORDER[i + 1];
}

export const isAuditGateOpen = (s: State): boolean => s.phase === "A" || s.flags.auditPassed;
export const isBuildGateOpen = (s: State): boolean => s.flags.auditPassed;
export const isDone = (s: State): boolean => s.phase === "D" && s.flags.checkPassed;
export const isIdle = (s: State): boolean => s.phase === "IDLE";

/**
 * Derive flags.interview from the interview tracker (L8.2). The main session calls
 * this to set the gate; a loose user trigger cannot flip it true. canEnter("P")
 * continues to read flags.interview, so the FSM interface is unchanged — this only
 * binds the flag to the readiness predicate. Returns a new State (pure).
 */
export function deriveInterviewFlag(state: State): State {
  return { ...state, flags: { ...state.flags, interview: isInterviewReady(state.interview) } };
}

export interface TransitionResult {
  ok: boolean;
  state?: State;
  reason?: string;
}

/**
 * Structural transition with attest enforcement (007 R-2). This is the single
 * place gate flags (auditPassed/checkPassed) flip to true — and ONLY when a valid
 * attestation is supplied for a gated forward transition (A->B, C->D). Forward
 * motion without evidence is rejected fail-closed; no flag flips, no phase change.
 *
 * Pure: returns the next State for the caller to persist; performs no IO.
 */
export function transition(state: State, to: Phase, attest?: Attestation | null): TransitionResult {
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
