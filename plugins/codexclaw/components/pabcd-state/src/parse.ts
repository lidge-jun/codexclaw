/**
 * parse.ts — defensive parsers for codex hook stdin payloads.
 *
 * codex-rs emits snake_case JSON on stdin (one object). We parse + type-guard
 * the fields we rely on. Empty / corrupt / wrong-shape input returns null and
 * NEVER throws — the CLI treats null as "no-op, exit 0" (fail-safe).
 *
 * Ground truth:
 *  - UserPromptSubmit: codex-rs hooks/src/events/user_prompt_submit.rs:22-32
 *  - Stop:             codex-rs hooks/src/events/stop.rs:23-34
 *  - JS shape parity:  omo ulw-loop/comment-checker codex-hook.ts:3-13
 */
import type {
  PostToolUsePayload,
  PostCompactPayload,
  SessionStartPayload,
  StopPayload,
  SubagentStopPayload,
  UserPromptSubmitPayload,
} from "./hook.ts";
import { isCanonicalSessionId } from "./state.ts";

function asObject(raw: string): Record<string, unknown> | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * isSubagentHookPayload — true when the hook stdin payload identifies a
 * thread-spawned subagent turn. codex-rs stamps optional `agent_id`/`agent_type`
 * into turn-level hook inputs for child sessions (hooks/src/schema.rs:270,537,
 * commit 16d85e270) and reuses the PARENT session id for child hooks (commit
 * fbfbfe5fc), so `session_id` alone cannot discriminate root from child.
 * Fail-open: empty/unparseable stdin returns false (root behavior preserved).
 */
export function isSubagentHookPayload(raw: string): boolean {
  const obj = asObject(raw);
  if (!obj) return false;
  const agentId = str(obj.agent_id);
  const agentType = str(obj.agent_type);
  return (agentId !== undefined && agentId !== "") || (agentType !== undefined && agentType !== "");
}

export function parseSessionStart(raw: string): SessionStartPayload | null {
  const obj = asObject(raw);
  if (!obj || obj.hook_event_name !== "SessionStart") return null;
  const sessionId = str(obj.session_id);
  const cwd = str(obj.cwd);
  if (sessionId === undefined || cwd === undefined) return null;
  if (!isCanonicalSessionId(sessionId) || cwd.trim().length === 0) return null;
  return { hook_event_name: "SessionStart", session_id: sessionId, cwd };
}

export function parseUserPromptSubmit(raw: string): UserPromptSubmitPayload | null {
  const obj = asObject(raw);
  if (!obj) return null;
  if (obj.hook_event_name !== "UserPromptSubmit") return null;
  const sessionId = str(obj.session_id);
  const cwd = str(obj.cwd);
  const prompt = str(obj.prompt);
  if (sessionId === undefined || cwd === undefined || prompt === undefined) return null;
  return {
    hook_event_name: "UserPromptSubmit",
    session_id: sessionId,
    cwd,
    prompt,
    transcript_path: str(obj.transcript_path) ?? null,
    turn_id: str(obj.turn_id),
    model: str(obj.model),
    permission_mode: str(obj.permission_mode),
  };
}

export function parseStop(raw: string): StopPayload | null {
  const obj = asObject(raw);
  if (!obj) return null;
  if (obj.hook_event_name !== "Stop") return null;
  const sessionId = str(obj.session_id);
  const cwd = str(obj.cwd);
  if (sessionId === undefined || cwd === undefined) return null;
  return {
    hook_event_name: "Stop",
    session_id: sessionId,
    cwd,
    transcript_path: str(obj.transcript_path) ?? null,
    turn_id: str(obj.turn_id),
    stop_hook_active: typeof obj.stop_hook_active === "boolean" ? obj.stop_hook_active : undefined,
    last_assistant_message: str(obj.last_assistant_message) ?? null,
  };
}

export function parsePostCompact(raw: string): PostCompactPayload | null {
  const obj = asObject(raw);
  if (!obj) return null;
  if (obj.hook_event_name !== "PostCompact") return null;
  const sessionId = str(obj.session_id);
  const cwd = str(obj.cwd);
  if (sessionId === undefined || cwd === undefined) return null;
  return {
    hook_event_name: "PostCompact",
    session_id: sessionId,
    cwd,
    turn_id: str(obj.turn_id),
    transcript_path: str(obj.transcript_path) ?? null,
    trigger: str(obj.trigger),
  };
}

export function parseSubagentStop(raw: string): SubagentStopPayload | null {
  const obj = asObject(raw);
  if (!obj) return null;
  if (obj.hook_event_name !== "SubagentStop") return null;
  const sessionId = str(obj.session_id);
  const cwd = str(obj.cwd);
  const agentType = str(obj.agent_type);
  // agent_type is the matcher key + the gate's primary discriminator; require it.
  if (sessionId === undefined || cwd === undefined || agentType === undefined) return null;
  return {
    hook_event_name: "SubagentStop",
    session_id: sessionId,
    cwd,
    agent_type: agentType,
    agent_id: str(obj.agent_id),
    turn_id: str(obj.turn_id),
    transcript_path: str(obj.transcript_path) ?? null,
    agent_transcript_path: str(obj.agent_transcript_path) ?? null,
    model: str(obj.model),
    permission_mode: str(obj.permission_mode),
    stop_hook_active: typeof obj.stop_hook_active === "boolean" ? obj.stop_hook_active : undefined,
    last_assistant_message: str(obj.last_assistant_message) ?? null,
  };
}

export function parsePostToolUse(raw: string): PostToolUsePayload | null {
  const obj = asObject(raw);
  if (!obj) return null;
  if (obj.hook_event_name !== "PostToolUse") return null;
  const sessionId = str(obj.session_id);
  const cwd = str(obj.cwd);
  const toolName = str(obj.tool_name);
  if (sessionId === undefined || cwd === undefined || toolName === undefined) return null;
  return {
    hook_event_name: "PostToolUse",
    session_id: sessionId,
    cwd,
    tool_name: toolName,
    tool_input: obj.tool_input,
    tool_response: obj.tool_response,
    tool_use_id: str(obj.tool_use_id),
    turn_id: str(obj.turn_id),
  };
}
