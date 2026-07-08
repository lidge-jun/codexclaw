#!/usr/bin/env node
/**
 * fake-codex.mjs — hermetic stand-in for the codex CLI in runner tests.
 *
 * Emits JSONL matching codex exec --json event shapes. Behavior is driven by
 * argv + env so tests exercise new-run stdin delivery, resume, missing-rollout
 * failure, timeout, and error paths — no network, no real codex.
 *
 * Modes (env FAKE_CODEX_MODE):
 *   ok        — emit thread.started, a command status, agent_message, turn.completed
 *   resume-ok — same but echoes the resumed SESSION_ID as thread id
 *   lost      — print the real missing-rollout error and exit 0 (codex's actual behavior)
 *   hang      — never exit (drives the timeout path); ignores signals? no, default term
 *   slow      — emit thread/status then hang until killed (drives cancellation)
 *   fail      — emit turn.failed
 */
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const mode = process.env.FAKE_CODEX_MODE ?? "ok";
const isResume = args[0] === "exec" && args[1] === "resume";

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

async function readStdin() {
  if (isResume) return ""; // resume passes prompt positionally, stdin closed
  let data = "";
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) data += line + "\n";
  return data.trim();
}

async function main() {
  if (mode === "hang") {
    // Consume stdin so the parent's end() resolves, then hang until killed.
    await readStdin();
    setInterval(() => {}, 1000);
    return;
  }

  if (mode === "lost") {
    process.stderr.write(
      "Error: thread/resume: thread/resume failed: no rollout found for thread id " +
        (args.find((a) => a.includes("-")) ?? "unknown") +
        " (code -32600)\n",
    );
    process.exit(0);
  }

  const stdinPrompt = await readStdin();

  // Resume argv shape: exec resume ...flags --json -- <SESSION_ID> <PROMPT>
  const sepIdx = args.indexOf("--");
  const threadId = isResume ? (args[sepIdx + 1] ?? "resumed-thread") : "thread-fresh-1";
  emit({ type: "thread.started", thread_id: threadId });
  emit({ type: "item.completed", item: { type: "reasoning", text: "thinking about the request" } });
  emit({ type: "item.started", item: { type: "tool_call", name: "shell", input: { cmd: "echo hello" } } });
  emit({ type: "item.completed", item: { type: "file_change", path: "notes.txt", action: "modify" } });
  emit({ type: "item.started", item: { type: "command_execution", command: "echo hello" } });

  if (mode === "slow") {
    setInterval(() => {}, 1000);
    return;
  }

  if (mode === "fail") {
    emit({ type: "turn.failed", error: { message: "model refused" } });
    process.exit(0);
  }

  const promptSeen = isResume ? (args[sepIdx + 2] ?? "") : stdinPrompt;
  // Optional argv/cwd echo so tests can assert flags and spawn cwd reached the child.
  let reply = `reply to: ${promptSeen}`;
  if (process.env.FAKE_CODEX_ECHO_ARGS === "1") reply = `args: ${args.join(" ")}`;
  if (process.env.FAKE_CODEX_ECHO_CWD === "1") reply = `cwd: ${process.cwd()}`;
  emit({
    type: "item.completed",
    item: { type: "agent_message", text: reply },
  });
  emit({ type: "turn.completed", usage: { input_tokens: 10, output_tokens: 5 } });
  process.exit(0);
}

main();
