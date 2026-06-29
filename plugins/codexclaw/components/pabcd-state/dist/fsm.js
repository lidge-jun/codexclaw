import { PHASES,                        } from "./state.js";

export const ORDER                   = PHASES;

export function canEnter(to       , state       )                                   {
  switch (to) {
    case "I":
      return { ok: true };
    case "P":
      return state.flags.interview
        ? { ok: true }
        : { ok: false, reason: "interview not completed (I->P needs interview flag)" };
    case "A":
      return { ok: true };
    case "B":
      return state.flags.auditPassed
        ? { ok: true }
        : { ok: false, reason: "audit gate closed (need auditPassed)" };
    case "C":
      return { ok: true };
    case "D":
      return state.flags.checkPassed
        ? { ok: true }
        : { ok: false, reason: "check gate closed (need checkPassed)" };
    default:
      return { ok: false, reason: `unknown phase ${String(to)}` };
  }
}

export function nextPhase(state       )               {
  const i = ORDER.indexOf(state.phase);
  return i < 0 || i + 1 >= ORDER.length ? null : ORDER[i + 1];
}

export const isAuditGateOpen = (s       )          => s.phase === "A" || s.flags.auditPassed;
export const isBuildGateOpen = (s       )          => s.flags.auditPassed;
export const isDone = (s       )          => s.phase === "D" && s.flags.checkPassed;
