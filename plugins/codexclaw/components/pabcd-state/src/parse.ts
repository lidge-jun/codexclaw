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
import type { StopPayload, UserPromptSubmitPayload } from "./hook.ts";

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
