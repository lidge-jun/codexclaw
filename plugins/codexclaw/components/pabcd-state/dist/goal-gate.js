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
 *    (camelCase: hookEventName / permissionDecision:"deny" / permissionDecisionReason /
 *     additionalContext), permissionDecision enum allow|deny|ask (schema.rs:254).
 *  - omo guard parity:  ulw-loop/src/codex-hook.ts:86-99 + hasInvalidCreateGoalInput:155.
 */














const CREATE_GOAL_TOOL_NAME = "create_goal";
const CREATE_GOAL_WARNING =
  "Use create_goal with objective only. Omit token_budget so the goal stays unlimited, and put lifecycle status changes on update_goal.";

import { getGoalActiveStatus, suppressesInterview,                                            } from "./goal-active.js";

const REQUEST_USER_INPUT_TOOL = "request_user_input";
const GOAL_MODE_DENY_REASON =
  "Goal mode is active: interview / request_user_input is denied. Autonomous execution must not block on the user. Use autonomous backfill (verified fact, contradiction, or high-severity assumption requiring later review) instead.";

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
    return applyGoalBudgetGuard(payload) || applyGoalModeInterviewGuard(payload, deps);
  } catch {
    return rawLooksLikeRequestUserInput(raw) ? goalModeInterviewDenyEnvelope("unreadable") : "";
  }
}
