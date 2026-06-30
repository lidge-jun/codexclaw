/**
 * orchestrate-apply.ts — HUMAN (chat) free-pass transition application (L3b / 031).
 *
 * The invocation-source split (codexclaw has no boss token): a command that arrives
 * via UserPromptSubmit is HUMAN-driven and gets a free-pass — forward transitions
 * advance WITHOUT requiring an attestation. The L2 adjacency invariant still holds
 * (illegal edges are refused); only the attest *evidence* requirement is waived for
 * the human. The agent path (L4 `cxc orchestrate` CLI) keeps the un-weakened
 * `transition()` with `validateAttest`, so this helper never touches `transition()`.
 *
 * Pure: returns the next State + an optional LedgerEntry for the caller to persist.
 */
import { canEnter } from "./fsm.ts";
import type { OrchestrateVerb } from "./orchestrate-grammar.ts";
import type { Attestation } from "./attest.ts";
import { type LedgerEntry, type Phase, type State } from "./state.ts";

export interface ApplyResult {
  ok: boolean;
  /** Next state to persist (absent on a no-op or refusal). */
  state?: State;
  /** Refusal reason (illegal adjacency, etc.). */
  reason?: string;
  /** Ledger entry to append on a successful, state-changing transition. */
  ledger?: LedgerEntry;
  /** Control outcomes that are not a plain forward move. */
  control?: "status" | "reset" | "done";
  /** True when the command was a recognized no-op (e.g. reset from IDLE). */
  noop?: boolean;
}

/** Gate flag a forward edge unlocks (human asserts the phase work is done). */
function unlockedFlag(from: Phase, to: Phase): "auditPassed" | "checkPassed" | null {
  if (from === "A" && to === "B") return "auditPassed";
  if (from === "C" && to === "D") return "checkPassed";
  return null;
}

/** The cleared resting state a reset/close produces (mirrors fsm D->IDLE close). */
function clearedIdle(state: State): State {
  return {
    ...state,
    phase: "IDLE",
    flags: { interview: false, auditPassed: false, checkPassed: false },
    orchestrationActive: false,
    lastInjectedPhase: null,
  };
}

/**
 * Apply a human (chat) orchestrate command to file state. Never throws.
 */
export function applyHumanTransition(
  state: State,
  verb: OrchestrateVerb,
  attest?: Attestation | null,
): ApplyResult {
  // status: read-only, no state change.
  if (verb === "status") {
    return { ok: true, control: "status" };
  }

  // reset: explicit control override. Bypasses the adjacency table (L2 rejects
  // mid-cycle ->IDLE) and writes the cleared IDLE state directly. Reset from IDLE
  // is a no-op (no ledger spam).
  if (verb === "reset") {
    if (state.phase === "IDLE") {
      return { ok: true, control: "reset", noop: true };
    }
    return {
      ok: true,
      control: "reset",
      state: clearedIdle(state),
      ledger: { ts: new Date().toISOString(), sessionId: state.sessionId, from: state.phase, to: "IDLE", reason: "reset" },
    };
  }

  const to = verb as Phase;
  const from = state.phase;

  // HUMAN D-close (L5): chat "orchestrate d" means "I'm done — close the cycle".
  // It advances C->D AND closes D->IDLE atomically, so the resting state is IDLE and
  // D is never a persistent badge. (The agent CLI path keeps the gated C->D advance.)
  if (to === "D") {
    if (from !== "C") {
      return { ok: false, reason: `illegal transition ${from}->D` };
    }
    return {
      ok: true,
      control: "done",
      state: clearedIdle(state),
      ledger: {
        ts: new Date().toISOString(),
        sessionId: state.sessionId,
        from: "C",
        to: "IDLE",
        reason: "done",
        ...(attest?.did ? { evidence: attest.did } : {}),
      },
    };
  }

  // HUMAN free-pass: pre-flip the gate flag this forward edge unlocks so the
  // flag-based gate in canEnter opens without an attestation. Adjacency is still
  // enforced below — an illegal edge is refused regardless.
  const flags = { ...state.flags };
  const unlocked = unlockedFlag(from, to);
  if (unlocked) flags[unlocked] = true;
  // Entering I starts a fresh cycle: clear gate flags so a stale human-flipped
  // checkPassed/auditPassed cannot leak across cycles (D->I new-cycle clearing).
  if (to === "I") {
    flags.auditPassed = false;
    flags.checkPassed = false;
    flags.interview = false;
  }

  const legal = canEnter(to, { ...state, flags });
  if (!legal.ok) {
    return { ok: false, reason: legal.reason };
  }

  // D->IDLE is the cycle close (reachable via the loose path, not a verb here since
  // verbs are work phases). A forward move to a work phase just persists phase+flags.
  const next: State = { ...state, phase: to, flags };
  return {
    ok: true,
    state: next,
    ledger: {
      ts: new Date().toISOString(),
      sessionId: state.sessionId,
      from,
      to,
      reason: "chat",
      ...(attest?.did ? { evidence: attest.did } : {}),
    },
  };
}
