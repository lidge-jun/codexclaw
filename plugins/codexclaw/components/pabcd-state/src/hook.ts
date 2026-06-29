/**
 * hook.ts — pure hook logic (no process IO; stdin/stdout handled by cli.ts).
 *
 * UserPromptSubmit: detect an explicit IPABCD/interview trigger in the prompt
 * and inject the matching phase directive as additionalContext. Idempotent per
 * (session, turn): a turn_id is recorded in state.injectedTurns so a re-fired
 * hook in the same turn does not double-inject.
 *
 * Stop: PASSIVE in Pass 2 — returns "" and writes nothing. Auto-advance / ledger
 * is deferred to a later pass to avoid per-turn ledger spam (gates like
 * canEnter("A") are unconditionally open, so a naive advance would log every turn).
 *
 * Ground truth:
 *  - payload field names: codex-rs hooks/src/events/{user_prompt_submit,stop}.rs (snake_case)
 *  - output shape:        omo rules/src/hook-output.ts:10-16 (camelCase hookSpecificOutput)
 */
import { readState, writeState, type Phase } from "./state.ts";

export interface UserPromptSubmitPayload {
  hook_event_name: "UserPromptSubmit";
  session_id: string;
  cwd: string;
  prompt: string;
  transcript_path?: string | null;
  turn_id?: string;
  model?: string;
  permission_mode?: string;
}

export interface StopPayload {
  hook_event_name: "Stop";
  session_id: string;
  cwd: string;
  transcript_path?: string | null;
  turn_id?: string;
  stop_hook_active?: boolean;
  last_assistant_message?: string | null;
}

const MAX_CTX = 32_000;

/**
 * Detect an explicit IPABCD/interview trigger. Explicit only — no goal-mode
 * branch (A3 decision, see 022.3). Both English and Korean phrasings.
 * Order matters: interview is checked first so "orchestrate i" wins over "p".
 */
export function detectTrigger(prompt: string): Phase | null {
  const p = (prompt ?? "").toLowerCase();
  if (/\binterview\b|인터뷰|\borchestrate i\b/.test(p)) return "I";
  if (/\borchestrate p\b|plan this|계획 세워/.test(p)) return "P";
  if (/\borchestrate a\b|audit this|감사/.test(p)) return "A";
  if (/\borchestrate b\b|build this|구현/.test(p)) return "B";
  if (/\borchestrate c\b|check this|검증/.test(p)) return "C";
  return null;
}

const PHASE_DIRECTIVES: Record<Phase, string> = {
  I: [
    "[codexclaw: INTERVIEW]",
    "Clarify requirements before planning. Cover four dimensions — Goal, Constraint,",
    "Success criteria, Ontology. Research the repo first, then ask focused questions.",
    "Do NOT start implementing yet.",
  ].join("\n"),
  P: [
    "[codexclaw: PLAN]",
    "Write a diff-level plan: file change map, scope boundary (IN/OUT), and testable",
    "accept criteria. Ground decisions in real code you have read. No implementation yet.",
  ].join("\n"),
  A: [
    "[codexclaw: AUDIT]",
    "Audit the plan adversarially before building. Dispatch an independent reviewer",
    "(sub-agent) to challenge assumptions, find blockers, and verify references. Fold",
    "fixes back into the plan and record the verdict.",
  ].join("\n"),
  B: [
    "[codexclaw: BUILD]",
    "Implement the audited plan in small atomic commits. Verify as you go (run tests).",
    "Stay inside the plan's scope boundary; surface deviations instead of silently expanding.",
  ].join("\n"),
  C: [
    "[codexclaw: CHECK]",
    "Run the real verification: tests, type checks, and adversarial review. Capture fresh",
    "command output as evidence. Do not claim pass without artifact-level proof.",
  ].join("\n"),
  D: [
    "[codexclaw: DONE]",
    "Summarize what was checked with evidence, update STATUS/devlog, and commit. Confirm",
    "no pending work remains for this work-phase before closing.",
  ].join("\n"),
};

export function phaseDirective(phase: Phase): string {
  return PHASE_DIRECTIVES[phase] ?? "";
}

export function interviewDirective(): string {
  return PHASE_DIRECTIVES.I;
}

/**
 * Build the codex hook stdout line. Normalizes CRLF, trims, caps at 32k, and
 * wraps in the omo-parity envelope. Empty context => "" (no injection).
 */
export function buildContextOutput(eventName: string, ctx: string): string {
  const norm = (ctx ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!norm) return "";
  const capped =
    norm.length <= MAX_CTX
      ? norm
      : `${norm.slice(0, MAX_CTX - 64).replace(/[ \t\r\n]+$/, "")}\n\n[truncated]`;
  return `${JSON.stringify({
    hookSpecificOutput: { hookEventName: eventName, additionalContext: capped },
  })}\n`;
}

/**
 * UserPromptSubmit handler. Idempotent per (session, turn): records turn_id in
 * state.injectedTurns so the same turn never double-injects.
 */
export function handleUserPromptSubmit(payload: UserPromptSubmitPayload): string {
  if (payload.hook_event_name !== "UserPromptSubmit") return "";
  const trigger = detectTrigger(payload.prompt);
  if (!trigger) return "";
  const turn = payload.turn_id ?? "";
  const state = readState(payload.cwd, payload.session_id);
  if (turn && state.injectedTurns.includes(turn)) return "";
  const directive = trigger === "I" ? interviewDirective() : phaseDirective(trigger);
  if (turn) {
    writeState(payload.cwd, { ...state, injectedTurns: [...state.injectedTurns, turn] });
  }
  return buildContextOutput("UserPromptSubmit", directive);
}

/**
 * Stop handler — PASSIVE in Pass 2. Intentionally a no-op: emits nothing and
 * writes no ledger/state. FSM auto-advance is deferred (see header + plan 018.2).
 */
export function handleStop(_payload: StopPayload): string {
  return "";
}
