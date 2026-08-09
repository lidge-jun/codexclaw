import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const cli = resolve(import.meta.dirname, "../src/cli.ts");

test("oversized PreToolUse stdin is denied instead of becoming an empty fail-open payload", () => {
  const payload = JSON.stringify({
    hook_event_name: "PreToolUse",
    session_id: "s",
    cwd: process.cwd(),
    tool_name: "request_user_input",
    tool_input: { padding: "x".repeat(4 * 1024 * 1024) },
  });
  const result = spawnSync(process.execPath, [cli, "hook", "pre-tool-use"], {
    input: payload,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /exceeded/);
});

test("oversized SubagentStop stdin remains blocked", () => {
  const result = spawnSync(process.execPath, [cli, "hook", "subagent-stop"], {
    input: "x".repeat(4 * 1024 * 1024 + 1),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout).decision, "block");
});
