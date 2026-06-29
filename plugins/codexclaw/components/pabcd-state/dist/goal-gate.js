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
