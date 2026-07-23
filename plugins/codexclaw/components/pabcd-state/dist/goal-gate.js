/**
 * goal-gate.ts — PreToolUse guard that enforces unlimited goals (omo parity).
 *
 * Denies a `create_goal` tool call whose `tool_input` carries ANY key other
 * than `objective` (today that means `token_budget`), steering the model to
 * create unlimited goals and to put lifecycle changes on `update_goal`. Any
 * other tool, or an objective-only create_goal, passes through ("" = no output).
 *
 * Ground truth:
 *  - PreToolUse input:  codex-rs hooks/src/schema.rs:273 (snake_case, deny_unknown_fields)
 *  - PreToolUse output: codex-rs hooks/src/schema.rs:239 PreToolUseHookSpecificOutputWire
 *    (camelCase: hookEventName / permissionDecision:"allow"|"deny" /
 *     permissionDecisionReason / additionalContext).
 *  - omo guard parity:  ulw-loop/src/codex-hook.ts:86-99 + hasInvalidCreateGoalInput:155.
 */














const CREATE_GOAL_TOOL_NAME = "create_goal";
const CREATE_GOAL_WARNING =
  "Use create_goal with objective only. Omit token_budget so the goal stays unlimited, and put lifecycle status changes on update_goal.";

import { getGoalActiveStatus, suppressesInterview,                                            } from "./goal-active.js";
import { readState } from "./state.js";
import { readGoalplan, validateGoalplan } from "./goalplan.js";
// Cross-component dist import (precedent: messenger-bridge/src/api-compat.ts:17).
// 260724 WP1: deny remedies name `cxc orchestrate ...`/`cxc loop validate` — on a
// payload-only install those must render the resolvable invocation. Emit-time only.
// Cross-component dist import, LAZY + FAIL-OPEN (260724 WP1): the entry must keep
// working when the cxc-ops sibling is absent (isolated dist snapshots in tests,
// partial checkouts). A missing resolver degrades to the literal `cxc`.

let cxcInvocationFn                         = null;
try {
  ({ cxcInvocation: cxcInvocationFn } = (await import("../../cxc-ops/dist/cxc-resolve.js"))

   );
} catch {
  cxcInvocationFn = null;
}
function cxcInvocation(moduleUrl        )         {
  return cxcInvocationFn ? cxcInvocationFn(moduleUrl) : "cxc";
}

const REQUEST_USER_INPUT_TOOL = "request_user_input";
const GOAL_MODE_DENY_REASON =
  "Goal mode is active: interview / request_user_input is denied. Autonomous execution must not block on the user. Use autonomous backfill (verified fact, contradiction, or high-severity assumption requiring later review) instead.";

const UPDATE_GOAL_TOOL_NAME = "update_goal";

function isRecord(value         )                                   {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value         )                     {
  return typeof value === "string" ? value : undefined;
}

export function parsePreToolUse(raw        )                           {
  const text = (raw ?? "").trim();
  if (!text) return null;
  let parsed         ;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.hook_event_name !== "PreToolUse") return null;
  const sessionId = str(parsed.session_id);
  const cwd = str(parsed.cwd);
  const toolName = str(parsed.tool_name);
  if (sessionId === undefined || cwd === undefined || toolName === undefined) return null;
  return {
    hook_event_name: "PreToolUse",
    session_id: sessionId,
    cwd,
    tool_name: toolName,
    tool_input: parsed.tool_input,
    tool_use_id: str(parsed.tool_use_id),
    turn_id: str(parsed.turn_id),
    transcript_path: str(parsed.transcript_path) ?? null,
    model: str(parsed.model),
    permission_mode: str(parsed.permission_mode),
  };
}

function hasInvalidCreateGoalInput(value         )          {
  return isRecord(value) && Object.keys(value).some((key) => key !== "objective");
}

/**
 * Returns a deny envelope (with trailing newline) when a budgeted/extra-keyed
 * create_goal is attempted, else "" (passthrough). Never throws.
 */
export function applyGoalBudgetGuard(payload                   )         {
  if (payload.hook_event_name !== "PreToolUse") return "";
  if (payload.tool_name !== CREATE_GOAL_TOOL_NAME) return "";
  if (!hasInvalidCreateGoalInput(payload.tool_input)) return "";
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: CREATE_GOAL_WARNING,
      additionalContext: CREATE_GOAL_WARNING,
    },
  })}\n`;
}

/**
 * Strict goal-mode deny for request_user_input (L11.2 / R-9 fail-closed). Returns
 * a deny envelope when the native goal is Active OR the goal DB row is unreadable
 * (fail-closed). Returns "" only when goal mode is genuinely inactive. Keyed on
 * the L11.1 read-only goals_1.sqlite lookup by thread_id (= session_id).
 *
 * This path must NOT be swallowed by the global fail-safe: callers invoke it
 * directly and treat a thrown/empty result conservatively.
 */
export function applyGoalModeInterviewGuard(payload                   , deps                 = {})         {
  if (payload.hook_event_name !== "PreToolUse") return "";
  if (payload.tool_name !== REQUEST_USER_INPUT_TOOL) return "";
  const status = getGoalActiveStatus(payload.session_id, deps);
  if (!suppressesInterview(status)) return ""; // goal inactive -> allow
  return goalModeInterviewDenyEnvelope(status);
}

/** The L11.2 deny envelope (trailing newline). Shared by the guard and the
 *  fail-closed dispatch path so both emit byte-identical output. */
export function goalModeInterviewDenyEnvelope(status                  )         {
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: GOAL_MODE_DENY_REASON,
      additionalContext: `${GOAL_MODE_DENY_REASON} (goal-active=${status})`,
    },
  })}\n`;
}

/** Best-effort detector: does this raw hook payload look like a
 *  request_user_input PreToolUse call? Never throws. Used so the fail-closed
 *  path can still deny when full parsing/status lookup throws. */
export function rawLooksLikeRequestUserInput(raw        )          {
  try {
    const parsed = JSON.parse((raw ?? "").trim())           ;
    return (
      isRecord(parsed) &&
      parsed.hook_event_name === "PreToolUse" &&
      parsed.tool_name === REQUEST_USER_INPUT_TOOL
    );
  } catch {
    return false;
  }
}

/** Shared PreToolUse deny envelope for the goal-complete gate (trailing newline). */
function goalCompleteDenyEnvelope(reason        )         {
  // Safe backtick-anchored rewrite: every cxc command in the deny reasons is
  // backticked (verified at both call sites); paths/prose carry no "`cxc " prefix.
  try {
    const inv = cxcInvocation(import.meta.url);
    if (inv !== "cxc") reason = reason.replace(/`cxc /g, `\`${inv} `);
  } catch {
    // FAIL-OPEN: resolution errors never change the deny decision or reason
  }
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
      additionalContext: reason,
    },
  })}\n`;
}

/**
 * GOAL-COMPLETE-GATE-01 (260709, lazygap lineage) — deterministic anti-lazy-completion.
 *
 * Denies `update_goal {status:"complete"}` when the session's own durable state says
 * the work is provably not closed:
 *  1. a PABCD cycle is in flight (`orchestrationActive` && phase not IDLE/I) — close
 *     the cycle through D (or reset) before certifying the goal;
 *  2. a session-bound goalplan (`state.slug`) fails the E8 gate (`validateGoalplan`)
 *     — unmet criteria / undone work phases / evidence-free `met` marks / an empty
 *     unregistered plan cannot certify completion.
 *
 * `status:"blocked"` (and every non-complete update) always passes: that is the honest
 * escape hatch for external blockers. A missing/malformed session-bound goalplan denies
 * completion; unexpected errors still fail open so this gate never traps a session.
 * Forensics: sessions 019f4407 (goal completed with a self-listed REMAINING queue) and
 * 019f4456 (empty goalplan would have rubber-stamped validate).
 */
export function applyGoalCompleteGuard(payload                   )         {
  try {
    if (payload.hook_event_name !== "PreToolUse") return "";
    if (payload.tool_name !== UPDATE_GOAL_TOOL_NAME) return "";
    if (!isRecord(payload.tool_input) || payload.tool_input.status !== "complete") return "";

    const state = readState(payload.cwd, payload.session_id);
    if (state.orchestrationActive && state.phase !== "IDLE" && state.phase !== "I") {
      return goalCompleteDenyEnvelope(
        `GOAL-COMPLETE-GATE-01: a PABCD cycle is in flight at phase ${state.phase}. Close the cycle first (advance to D via \`cxc orchestrate ... --session ${payload.session_id}\`, or \`cxc orchestrate reset --session ${payload.session_id}\`), then mark the goal complete. If an external blocker prevents closing, use update_goal status "blocked" instead.`,
      );
    }
    if (state.slug) {
      const plan = readGoalplan(payload.cwd, state.slug);
      if (plan) {
        const verdict = validateGoalplan(plan);
        if (!verdict.ok) {
          const reasons = verdict.reasons.slice(0, 4).join("; ");
          return goalCompleteDenyEnvelope(
            `GOAL-COMPLETE-GATE-01: the session-bound goalplan '${state.slug}' fails the E8 quality gate: ${reasons}. Finish the remaining work and record fresh capturedEvidence in .codexclaw/goalplans/${state.slug}/goalplan.json (check with \`cxc loop validate --slug "${state.slug}"\`), or use update_goal status "blocked" if an external blocker prevents completion. Do not shrink the objective to escape the gate (LOOP-CONTINUE-01).`,
          );
        }
      } else {
        return goalCompleteDenyEnvelope(
          `GOAL-COMPLETE-GATE-01: session has a bound goalplan slug '${state.slug}' but the plan could not be read (missing or malformed). Restore the goalplan or use update_goal status "blocked".`,
        );
      }
    }
    return "";
  } catch {
    return ""; // fail-open: never trap update_goal on gate IO errors
  }
}

/**
 * Fail-CLOSED PreToolUse dispatch (R-9). Runs the budget guard then the
 * interview deny. If ANYTHING throws while the payload looks like a
 * request_user_input call, returns the deny envelope instead of failing open
 * (status reported as "unreadable"). All other failures pass through ("").
 *
 * This must be the cli.ts entry point for pre-tool-use so the global fail-safe
 * cannot silently allow an interview in goal mode.
 */
export function handlePreToolUseFailClosed(raw        , deps                 = {})         {
  try {
    const payload = parsePreToolUse(raw);
    if (!payload) return "";
    // Each guard is tool-name-scoped, so at most one fires.
    return applyGoalBudgetGuard(payload) || applyGoalModeInterviewGuard(payload, deps) || applyGoalCompleteGuard(payload);
  } catch {
    return rawLooksLikeRequestUserInput(raw) ? goalModeInterviewDenyEnvelope("unreadable") : "";
  }
}
