/**
 * idle-edit.ts — IDLE-EDIT-ADVISORY-01 (260714 wp3).
 *
 * PreToolUse advisory on apply_patch/Write/Edit: editing files while the PABCD
 * FSM is un-armed becomes VISIBLE when this session either saw a loop-arm
 * request (state.loopArmSeen, set by detectLoopArmRequest) or runs under an
 * ACTIVE native goal. Advisory only — never denies; a legitimate C0/C1
 * fast-path edit stays allowed (UNIT-RESIDENCE-01 still asks for a record doc).
 *
 * Envelope contract (audit-pinned, codex-rs pre_tool_use.rs:226-230): only
 * `additionalContext` reaches the model on a non-deny decision —
 * allow + permissionDecisionReason (friction-gate shape) is model-invisible.
 *
 * Fail-open everywhere: unreadable state, unreadable goal DB ("unreadable" maps
 * to INACTIVE — a deliberate inversion of goal-active.ts's fail-closed caller
 * note), or any throw returns "" (allow, silent). Frequency guard: inject on
 * idleEditNudges % 5 === 0, increment per gated edit (last-writer-wins races
 * on parallel edits are accepted — cosmetic only).
 */

import { getGoalActiveStatus } from "./goal-active.ts";
import { readState, writeState } from "./state.ts";

const EDIT_TOOLS = new Set(["apply_patch", "Write", "Edit"]);

/** Every Nth gated edit (0-indexed: 1st, 6th, 11th ...) re-surfaces the advisory. */
const NUDGE_EVERY = 5;

export function idleEditAdvisory(sessionId: string): string {
  return [
    "[codexclaw IDLE-EDIT] You are editing files while the PABCD FSM is un-armed",
    "but this session expects loop/goal work. If this edit belongs to the loop,",
    `arm first: \`cxc orchestrate status --session ${sessionId}\` -> enter P ->`,
    "advance edges with --attest (one work-phase = one full PABCD cycle).",
    "C0/C1 fast-path edits may proceed, but leave the numbered record doc in the",
    "owning devlog/_plan unit (UNIT-RESIDENCE-01).",
  ].join(" ");
}

/**
 * FAIL-OPEN PreToolUse dispatch for the IDLE-edit advisory. Returns an allow
 * envelope with additionalContext when the advisory fires, "" otherwise.
 */
export function handleIdleEditAdvisory(raw: string): string {
  try {
    const payload = JSON.parse(raw) as {
      hook_event_name?: string;
      session_id?: string;
      cwd?: string;
      tool_name?: string;
    };
    const tool = payload.tool_name ?? "";
    const sessionId = payload.session_id ?? "";
    const cwd = payload.cwd ?? "";
    if (!EDIT_TOOLS.has(tool) || sessionId === "" || cwd === "") return "";

    // State-first short-circuit (audit Low #6): read the cheap session file before
    // ever opening the goal DB.
    const state = readState(cwd, sessionId);
    if (state.phase !== "IDLE" || state.orchestrationActive) return "";

    let armedExpectation = state.loopArmSeen;
    if (!armedExpectation) {
      // "unreadable" counts as INACTIVE (fail-open advisory, deliberate inversion
      // of the interview-suppression fail-closed mapping).
      armedExpectation = getGoalActiveStatus(sessionId) === "active";
    }
    if (!armedExpectation) return "";

    const count = state.idleEditNudges;
    try {
      writeState(cwd, { ...state, idleEditNudges: count + 1 });
    } catch {
      // counter write failure never blocks the advisory decision
    }
    if (count % NUDGE_EVERY !== 0) return "";

    const envelope = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        additionalContext: idleEditAdvisory(sessionId),
      },
    };
    return `${JSON.stringify(envelope)}\n`;
  } catch {
    return ""; // fail-open: never interfere with the edit
  }
}
