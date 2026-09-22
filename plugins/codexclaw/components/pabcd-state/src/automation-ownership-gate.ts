/** A narrow PreToolUse safeguard, not atomic host-wide authorization.
 * target_thread_id is a protected task association, not authenticated creator identity.
 * Disabled hooks, non-hooked nested tools, UI/file writes and TOCTOU remain outside it.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { isSafeAutomationId, readAutomationOwnership, type AutomationOwnershipSnapshot } from "./automation-store.ts";

// Exact agreement with the registered matcher:
// ^(mcp__codex_app__|mcp__codex_app[._]|codex_app[._])?automation_update$
// Never search arbitrary tool source or guess additional namespace aliases.
export const AUTOMATION_UPDATE_TOOL_NAMES: ReadonlySet<string> = new Set([
  "mcp__codex_app__automation_update", "codex_app.automation_update", "codex_app_automation_update",
  "mcp__codex_app.automation_update", "mcp__codex_app_automation_update",
  "automation_update",
]);
const MAX_PAYLOAD_BYTES = 1024 * 1024;
const INPUT_KEYS = new Set([
  "mode", "id", "kind", "name", "prompt", "rrule", "status", "targetThreadId",
  "destination", "notificationPolicy", "executionEnvironment", "model", "projectId", "reasoningEffort",
]);
type RecordValue = Record<string, unknown>;
type Decision = { decision: "allow" | "deny"; reason: string };
export interface AutomationGateDeps { env?: NodeJS.ProcessEnv }

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function deny(reason: string): Decision { return { decision: "deny", reason }; }
function envelope(reason: string): string {
  return JSON.stringify({ hookSpecificOutput: {
    hookEventName: "PreToolUse", permissionDecision: "deny",
    permissionDecisionReason: `AUTOMATION-OWNERSHIP-01: ${reason}`,
  } }) + "\n";
}

/** Caller fields must come from native hook metadata, never tool_input or env. */
export function evaluateAutomationMutation(
  request: unknown,
  caller: { session_id?: unknown; agent_id?: unknown; agent_type?: unknown },
  ownership?: AutomationOwnershipSnapshot,
): Decision {
  if (!isRecord(request)) return deny("Automation mutation input must be an object.");
  if (request.mode === "view") return { decision: "allow", reason: "read-only" };
  if (!isSafeAutomationId(caller.session_id)) return deny("Native caller session is missing or invalid.");
  for (const marker of [caller.agent_id, caller.agent_type]) {
    if (marker !== undefined && marker !== null && marker !== "") return deny("Child or ambiguous caller identity cannot mutate root automations.");
  }
  if (Object.keys(request).some((key) => !INPUT_KEYS.has(key))) return deny("Unsupported automation mutation fields.");
  if (request.targetThreadId !== undefined && request.targetThreadId !== caller.session_id) return deny("Retargeting another task is denied.");
  if (request.kind !== undefined && request.kind !== "heartbeat") return deny("Only task-associated heartbeats have supported ownership.");
  if (request.destination !== undefined && request.destination !== "thread" && request.destination !== "local") return deny("Unknown automation destination.");
  if (request.mode === "create" || request.mode === "suggested_create") {
    if ("id" in request || request.kind !== "heartbeat") return deny("Create requires a heartbeat without an existing id.");
    return { decision: "allow", reason: "heartbeat targets the native caller" };
  }
  if (request.mode !== "update" && request.mode !== "suggested_update" && request.mode !== "delete") return deny("Unknown automation mutation mode.");
  if (!isSafeAutomationId(request.id)) return deny("A safe existing automation id is required.");
  if (!ownership || ownership.id !== request.id || ownership.kind !== "heartbeat" || ownership.targetThreadId !== caller.session_id) {
    return deny("Automation ownership is missing, unsupported, conflicting, or belongs to another task.");
  }
  return { decision: "allow", reason: "stored heartbeat targets the native caller" };
}

/** Dedicated matcher handler. Malformed payloads fail closed; known unrelated calls pass.
 * Returns native deny JSON or empty output, and does not throw on store/parse failures.
 */
export function handleAutomationOwnershipGate(raw: string, deps: AutomationGateDeps = {}): string {
  try {
    if (Buffer.byteLength(raw, "utf8") > MAX_PAYLOAD_BYTES) return envelope("Hook payload exceeds the supported bound.");
    const payload: unknown = JSON.parse(raw);
    if (!isRecord(payload)) return envelope("Malformed native hook payload.");
    if (typeof payload.tool_name === "string" && !AUTOMATION_UPDATE_TOOL_NAMES.has(payload.tool_name)) return "";
    if (payload.hook_event_name !== "PreToolUse") {
      return payload.hook_event_name ? "" : envelope("Native PreToolUse event is missing.");
    }
    if (typeof payload.tool_name !== "string") return envelope("Native tool name is missing.");
    const request = payload.tool_input;
    if (isRecord(request) && request.mode === "view") return "";
    // Views, creates and calls without a safe id need no ownership store lookup.
    const initial = evaluateAutomationMutation(request, payload);
    if (!isRecord(request) || !isSafeAutomationId(request.id) || initial.decision === "allow") {
      return initial.decision === "deny" ? envelope(initial.reason) : "";
    }
    const env = deps.env ?? process.env;
    const home = env.CODEX_HOME ?? join(homedir(), ".codex");
    const ownership = readAutomationOwnership(home, request.id);
    const result = evaluateAutomationMutation(request, payload, ownership);
    return result.decision === "deny" ? envelope(result.reason) : "";
  } catch {
    // Do not include raw tool input, prompts or private filesystem paths.
    return envelope("Cannot verify automation ownership from the native payload and supported local store. No mutation is permitted.");
  }
}
