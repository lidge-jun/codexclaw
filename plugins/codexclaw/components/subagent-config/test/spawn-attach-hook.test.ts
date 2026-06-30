/**
 * spawn-attach-hook.test.ts — lazygap_impl 020 Part B: the fail-safe E3 spawn-attach hook.
 *
 * Proves: no-op without the v1 opt-in, no-op on items-present / v2-only fields / non-spawn /
 * malformed input, and a FULL-REPLACEMENT updatedInput (entire original input + items) only
 * when CODEXCLAW_SPAWN_ATTACH=v1 is set. The hook must NEVER deny and NEVER throw.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { runSpawnAttachHook } from "../src/spawn-attach-hook.ts";

const OPT = "CODEXCLAW_SPAWN_ATTACH";

function withV1<T>(fn: () => T): T {
  const prev = process.env[OPT];
  process.env[OPT] = "v1";
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[OPT];
    else process.env[OPT] = prev;
  }
}

function withoutOpt<T>(fn: () => T): T {
  const prev = process.env[OPT];
  delete process.env[OPT];
  try {
    return fn();
  } finally {
    if (prev !== undefined) process.env[OPT] = prev;
  }
}

function spawnPayload(toolInput: Record<string, unknown>): string {
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "spawn_agent",
    cwd: process.cwd(),
    tool_input: toolInput,
  });
}

test("020 hook: no opt-in => allow untouched even for a spawn", () => {
  const out = withoutOpt(() => runSpawnAttachHook(spawnPayload({ message: "do frontend work", agent_type: "worker" })));
  assert.equal(out, "");
});

test("020 hook: opt-in + shared-shape spawn => full-replacement updatedInput with items", () => {
  const out = withV1(() =>
    runSpawnAttachHook(spawnPayload({ message: "review the frontend diff", agent_type: "explorer", model: "x" })),
  );
  assert.notEqual(out, "");
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "allow");
  const ui = parsed.hookSpecificOutput.updatedInput;
  // full replacement: original keys preserved
  assert.equal(ui.message, "review the frontend diff");
  assert.equal(ui.agent_type, "explorer");
  assert.equal(ui.model, "x");
  // items added
  assert.ok(Array.isArray(ui.items));
  const names = ui.items.filter((i) => i.type === "skill").map((i) => i.name);
  assert.ok(names.includes("cxc-dev"));
  assert.ok(names.includes("cxc-dev-frontend"), "frontend surface inferred from message");
});

test("020 hook: opt-in but items already present => no double-attach", () => {
  const out = withV1(() => runSpawnAttachHook(spawnPayload({ message: "x", items: [{ type: "text", text: "TASK: x" }] })));
  assert.equal(out, "");
});

test("020 hook: opt-in but v2-only field (task_name) => allow untouched", () => {
  const out = withV1(() => runSpawnAttachHook(spawnPayload({ task_name: "t", message: "frontend" })));
  assert.equal(out, "");
});

test("020 hook: opt-in but v2-only field (fork_turns) => allow untouched", () => {
  const out = withV1(() => runSpawnAttachHook(spawnPayload({ fork_turns: 3, message: "backend" })));
  assert.equal(out, "");
});

test("020 hook: non-spawn tool => allow untouched", () => {
  const out = withV1(() =>
    runSpawnAttachHook(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "shell", tool_input: {} })),
  );
  assert.equal(out, "");
});

test("020 hook: malformed / empty input => allow untouched, never throws", () => {
  assert.equal(withV1(() => runSpawnAttachHook("")), "");
  assert.equal(withV1(() => runSpawnAttachHook("{not json")), "");
  assert.equal(withV1(() => runSpawnAttachHook(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "spawn_agent" }))), "");
});

test("020 hook: worker agent_type maps to executor baseline skills", () => {
  const out = withV1(() => runSpawnAttachHook(spawnPayload({ message: "implement the data layer", agent_type: "worker" })));
  const ui = JSON.parse(out).hookSpecificOutput.updatedInput;
  const names = ui.items.filter((i) => i.type === "skill").map((i) => i.name);
  assert.ok(names.includes("cxc-dev"));
  assert.ok(names.includes("cxc-dev-data"), "data surface inferred");
});
