#!/usr/bin/env node
/**
 * pabcd-state — UserPromptSubmit + Stop hook entry.
 *
 * Reads the codex hook JSON payload from stdin, dispatches by event kind, and
 * writes any additionalContext envelope to stdout. Fail-safe: unknown events,
 * empty stdin, or unparseable payloads exit 0 with no output (never block codex).
 *
 *  - UserPromptSubmit: detect IPABCD/interview trigger → inject phase directive
 *    (idempotent per session+turn). See hook.ts/handleUserPromptSubmit.
 *  - Stop: PASSIVE in Pass 2 (no output, no ledger). See hook.ts/handleStop.
 *
 * State lives in files (no orchestrator server):
 *  - .codexclaw/sessions/<session>.json  (per-session phase + injectedTurns)
 *  - .codexclaw/ledger.jsonl             (audit trail; unused by passive Stop)
 *
 * argv: [node, cli.ts, kind, event] e.g. ["...", "...", "hook", "user-prompt-submit"].
 */
import { readFileSync } from "node:fs";
import { handleStop, handleUserPromptSubmit } from "./hook.ts";
import { parseStop, parseUserPromptSubmit } from "./parse.ts";

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function main(): void {
  const [, , kind, event] = process.argv;
  if (kind !== "hook") {
    process.exit(0);
  }

  const raw = readStdin();
  let output = "";

  if (event === "user-prompt-submit") {
    const payload = parseUserPromptSubmit(raw);
    if (payload) output = handleUserPromptSubmit(payload);
  } else if (event === "stop") {
    const payload = parseStop(raw);
    if (payload) output = handleStop(payload);
  }

  if (output) process.stdout.write(output);
  process.exit(0);
}

main();
