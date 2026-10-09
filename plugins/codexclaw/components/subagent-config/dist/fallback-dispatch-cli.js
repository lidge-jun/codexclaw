#!/usr/bin/env node
import { recordHookInvocation } from "../../../scripts/hook-observation.mjs";
import { readSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runDispatch } from "./fallback-dispatch.js";
import { renderDispatchCard } from "./dispatch-card.js";
import { readConfig, ROLES } from "./store.js";

export const DISPATCH_GUIDANCE = `Before a native spawn, follow $codexclaw:cxc-pabcd delegation.md#configured-first-fallback; only action=spawn grants one call.`;

export function sessionFallbackNotice(cwd        , renderCard               = renderDispatchCard)         {
  const roles = readConfig(cwd).roles;
  const active = ROLES.filter(role => roles[role].fallback);
  const fallback = active.length
    ? `[codexclaw] First fallback configured for ${active.join(", ")}. ${DISPATCH_GUIDANCE}`
    : "";
  const card = renderCard();
  const context = [fallback, card].filter(Boolean).join("\n");
  if (context.length > 4096) throw new Error("SessionStart dispatch context exceeds 4096 characters");
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } }) + "\n";
}
function main()       {
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
      recordHookInvocation(raw, "subagent-config", "session-start", import.meta.url);
      const payload = JSON.parse(raw)                                         ;
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
