/**
 * interview-policy.ts — should a plan request open with the Interview?
 *
 * The Interview used to be reachable only by naming it ("interview", "인터뷰",
 * "orchestrate i"). That was a deliberate choice, not a bug — but it means the phase
 * whose whole job is catching misunderstandings never fires on the request most likely
 * to contain one: the first "plan this" of a new unit. This module makes that a
 * project-level choice instead of a hardcoded one.
 *
 * What promotion does NOT do: write a phase. An earlier design wrote `phase:"I"`, which
 * traps the user — a session promoted that way has no interview tracker, so the I→P
 * soft gate blocks it, and `orchestrate reset` only makes the next prompt promote again.
 * There was no keyboard-reachable path back to P. So promotion is ADVISORY: the
 * interview directive is injected, the FSM is left exactly where it was, and entering
 * the I phase stays an explicit user action.
 *
 * Scope of promotion: the P trigger only. A/B/C are excluded because `mayEnter` in
 * hook.ts deliberately refuses to enter a cycle on "구현해"/"검증해"
 * (TRIGGER-AUTHORITY-01), and promoting those would smuggle entry past that rule.
 * Keeping to P also keeps ordinary Korean verbs — 구현해, 검증해 are the everyday words
 * for implement and verify — from dragging one-line asks into an interview.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";


/** Where the setting lives: committed, at the repo root. */
export const CONFIG_FILENAME = "codexclaw.json";

export const INTERVIEW_POLICIES = ["off", "new-unit", "always"]         ;


/**
 * Promote on the first plan request of a unit, and not once a cycle is running.
 * That is where an interview pays for itself; interrupting work in flight does not.
 */
export const DEFAULT_INTERVIEW_POLICY                  = "new-unit";

export function isInterviewPolicy(value         )                           {
  return typeof value === "string" && (INTERVIEW_POLICIES                     ).includes(value);
}

export function configPath(cwd        )         {
  return join(cwd, CONFIG_FILENAME);
}

/**
 * Read the policy for this repo. Missing file, unreadable file, malformed JSON and
 * unknown values all fall back to the default: a hook must never throw on a prompt.
 */
export function readInterviewPolicy(cwd        )                  {
  const path = configPath(cwd);
  try {
    if (!existsSync(path)) return DEFAULT_INTERVIEW_POLICY;
    const raw          = JSON.parse(readFileSync(path, "utf8"));
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return DEFAULT_INTERVIEW_POLICY;
    const value = (raw                           ).interview;
    return isInterviewPolicy(value) ? value : DEFAULT_INTERVIEW_POLICY;
  } catch {
    return DEFAULT_INTERVIEW_POLICY;
  }
}











/**
 * `phase` is what the FSM should see (unchanged from the raw trigger, always).
 * `adviseInterview` only chooses which directive text to inject.
 */





export function decideInterviewEntry(input                    )                {
  const { trigger, policy, orchestrationActive, goalSuppresses } = input;
  const asIs                = { phase: trigger, adviseInterview: false };

  if (trigger === null) return asIs; // no trigger, no opinion (C0/C1 stay untouched)
  if (trigger !== "P") return asIs; // A/B/C never promote (TRIGGER-AUTHORITY-01)
  if (goalSuppresses) return asIs; // goal mode suppresses the Interview, always
  if (policy === "off") return asIs;
  if (policy === "new-unit" && orchestrationActive) return asIs; // mid-cycle: do not interrupt
  return { phase: trigger, adviseInterview: true };
}

