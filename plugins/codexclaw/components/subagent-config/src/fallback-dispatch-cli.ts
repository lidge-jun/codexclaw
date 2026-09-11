#!/usr/bin/env node
import { readSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runDispatch } from "./fallback-dispatch.ts";
import { readConfig, ROLES } from "./store.ts";

export const DISPATCH_GUIDANCE = `Roles with a first fallback use the main-owned dispatch protocol before native spawn. Run cxc subagents dispatch with one JSON object on stdin: {action:"start",sessionId:<your native session>,dispatchId:<unique task id>,role:<role>}. Then claim with {action:"claim",sessionId,dispatchId,attemptId}. Only action=spawn authorizes one native call; prepend its marker followed by a newline to the original task/skills, pass candidate model and effort when non-null, and use a fresh context. Report creation with {action:"report",outcome:"created",sessionId,dispatchId,attemptId,agentId:<returned id>}, then use native wait. Report success with {action:"report",outcome:"complete",sessionId,dispatchId,attemptId,agentId}; creation is not completion. Report failure with action:"report",outcome:"failed", the same IDs, the original error and executionState (not_created/stopped/unknown/running). Failed handoff requires concrete reconciliation evidence and the recorded agentId for a stopped child. Inspect changes and stop all prior work before retrying. A ready result requires a new claim. Status never authorizes a second spawn. main-direct returns remaining work to the main agent; independent review still requires independent evidence. stop/reconcile never authorizes another model or direct execution. OCX owns provider retries; CXC selects at most two native attempts. Do not invent error codes from arbitrary prose; preserve structured errors or canonical transport error text. Explicit caller model overrides and full-history forks are outside this managed path. Never use a dispatch marker to bypass native permissions.`;

export function sessionFallbackNotice(cwd: string): string {
  const roles = readConfig(cwd).roles;
  const active = ROLES.filter(role => roles[role].fallback);
  if (!active.length) return "";
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: `[codexclaw] First fallback configured for ${active.join(", ")}. ${DISPATCH_GUIDANCE}` } }) + "\n";
}
function main(): void {
  const sessionStart = process.argv[2] === "session-start" || (process.argv[2] === "hook" && process.argv[3] === "session-start");
  try {
    const buffer = Buffer.alloc(64 * 1024 + 1);
    let size = 0;
    for (;;) {
      const count = readSync(0, buffer, size, buffer.length - size, null);
      if (!count) break;
      size += count;
      if (size === buffer.length) throw new Error("dispatch input exceeds 64 KiB");
    }
    const raw = buffer.subarray(0, size).toString("utf8");
    if (sessionStart) {
      const payload = JSON.parse(raw) as { cwd?: unknown; agent_id?: unknown };
      if (typeof payload.agent_id === "string" && payload.agent_id) return;
      process.stdout.write(sessionFallbackNotice(typeof payload.cwd === "string" ? payload.cwd : process.cwd()));
      return;
    }
    process.stdout.write(JSON.stringify(runDispatch(process.cwd(), JSON.parse(raw))) + "\n");
  } catch (error) {
    if (sessionStart) return;
    process.stdout.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }) + "\n");
    process.exitCode = 1;
  }
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
