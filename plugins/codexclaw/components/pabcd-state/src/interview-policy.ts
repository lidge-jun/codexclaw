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
 * the I phase requires an explicit user command or authorized agent CLI action.
 *
 * Scope of promotion: the P trigger only. A/B/C remain non-Interview hints
 * (TRIGGER-AUTHORITY-01). All natural hints leave phase entry to explicit commands.
 * Keeping to P also keeps ordinary Korean verbs — 구현해, 검증해 are the everyday words
 * for implement and verify — from dragging one-line asks into an interview.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Phase } from "./fsm.ts";

/** Where the setting lives: committed, at the repo root. */
export const CONFIG_FILENAME = "codexclaw.json";

export const INTERVIEW_POLICIES = ["off", "new-unit", "always"] as const;
export type InterviewPolicy = (typeof INTERVIEW_POLICIES)[number];

/**
 * Promote on the first plan request of a unit, and not once a cycle is running.
 * That is where an interview pays for itself; interrupting work in flight does not.
 */
export const DEFAULT_INTERVIEW_POLICY: InterviewPolicy = "new-unit";

export function isInterviewPolicy(value: unknown): value is InterviewPolicy {
  return typeof value === "string" && (INTERVIEW_POLICIES as readonly string[]).includes(value);
}

export function configPath(cwd: string): string {
  return join(cwd, CONFIG_FILENAME);
}

/**
 * Read the policy for this repo. Missing file, unreadable file, malformed JSON and
 * unknown values all fall back to the default: a hook must never throw on a prompt.
 */
export function readInterviewPolicy(cwd: string): InterviewPolicy {
  const path = configPath(cwd);
  try {
    if (!existsSync(path)) return DEFAULT_INTERVIEW_POLICY;
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return DEFAULT_INTERVIEW_POLICY;
    const value = (raw as Record<string, unknown>).interview;
    return isInterviewPolicy(value) ? value : DEFAULT_INTERVIEW_POLICY;
  } catch {
    return DEFAULT_INTERVIEW_POLICY;
  }
}

/**
 * Persist the policy, preserving every other key in the file.
 *
 * The writer lives beside the reader on purpose: this file's name and shape are owned
 * by one module, so the CLI cannot drift from what the hook reads on every prompt.
 * A malformed existing file is replaced rather than merged — there is nothing
 * trustworthy to merge into — and that is reported to the caller.
 */
export function writeInterviewPolicy(
  cwd: string,
  policy: InterviewPolicy,
): { ok: true; path: string; replacedMalformed: boolean } | { ok: false; reason: string } {
  const path = configPath(cwd);
  let existing: Record<string, unknown> = {};
  let replacedMalformed = false;
  if (existsSync(path)) {
    try {
      const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
        existing = raw as Record<string, unknown>;
      } else {
        replacedMalformed = true;
      }
    } catch {
      replacedMalformed = true;
    }
  }
  try {
    writeFileSync(path, `${JSON.stringify({ ...existing, interview: policy }, null, 2)}\n`, "utf8");
  } catch (err) {
    return { ok: false, reason: `could not write ${path}: ${(err as Error).message}` };
  }
  return { ok: true, path, replacedMalformed };
}

export interface EntryDecisionInput {
  /** Raw `detectTrigger` result. */
  trigger: Phase | null;
  policy: InterviewPolicy;
  /** `state.orchestrationActive` — a PABCD cycle is already running. */
  orchestrationActive: boolean;
  /** `suppressesInterview(getGoalActiveStatus(...))` — goal mode owns the turn. */
  goalSuppresses: boolean;
}

/**
 * `phase` is what the FSM should see (unchanged from the raw trigger, always).
 * `adviseInterview` only chooses which directive text to inject.
 */
export interface EntryDecision {
  phase: Phase | null;
  adviseInterview: boolean;
}

export function decideInterviewEntry(input: EntryDecisionInput): EntryDecision {
  const { trigger, policy, orchestrationActive, goalSuppresses } = input;
  const asIs: EntryDecision = { phase: trigger, adviseInterview: false };

  if (trigger === null) return asIs; // no trigger, no opinion (C0/C1 stay untouched)
  if (trigger !== "P") return asIs; // A/B/C never promote (TRIGGER-AUTHORITY-01)
  if (goalSuppresses) return asIs; // goal mode suppresses the Interview, always
  if (policy === "off") return asIs;
  if (policy === "new-unit" && orchestrationActive) return asIs; // mid-cycle: do not interrupt
  return { phase: trigger, adviseInterview: true };
}
