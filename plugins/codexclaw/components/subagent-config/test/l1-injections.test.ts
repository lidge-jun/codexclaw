import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ROLES, setRole } from "../src/store.ts";
import { sessionFallbackNotice } from "../src/fallback-dispatch-cli.ts";
import {
  LEAF_GUARD_BLOCK, LEAF_GUARD_BLOCK_COORDINATOR, LEAF_GUARD_MARKER,
  V1_SCOPE_BLOCK, V1_SCOPE_BLOCK_COORDINATOR, SCOPE_GUARD_MARKER,
  SKILL_AFFORDANCE_MARKER, SUBSPAWN_TOKEN, runSpawnAttachHook,
} from "../src/spawn-attach-hook.ts";

const surfaces = [
  { name: "V1", tool: "spawn_agent", fields: {}, leaf: V1_SCOPE_BLOCK, coordinator: V1_SCOPE_BLOCK_COORDINATOR, marker: SCOPE_GUARD_MARKER },
  { name: "V2", tool: "collaborationspawn_agent", fields: { task_name: "bounded-task", fork_turns: "none" }, leaf: LEAF_GUARD_BLOCK, coordinator: LEAF_GUARD_BLOCK_COORDINATOR, marker: LEAF_GUARD_MARKER },
];

test("L1 fallback notice keeps all configured roles and only the owner cue", t => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-l1-fallback-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  for (const role of ROLES) setRole(cwd, role, { fallback: { model: "fixture/fallback", effort: null } }, "project");
  const output = JSON.parse(sessionFallbackNotice(cwd, () => "")).hookSpecificOutput;
  assert.equal(output.hookEventName, "SessionStart");
  const notice: string = output.additionalContext;
  assert.match(notice, /^\[codexclaw\]/);
  for (const role of ROLES) assert.ok(notice.includes(role));
  assert.match(notice, /\$codexclaw:cxc-pabcd delegation\.md#configured-first-fallback/);
  assert.match(notice, /action=spawn/);
  assert.doesNotMatch(notice, /executionState|taskFailure|outcome/);
  assert.ok(Buffer.byteLength(notice) <= 300);
});

test("L1 scope guards preserve distinct authority prefixes and coordinator duties", () => {
  const prefixes = [
    [V1_SCOPE_BLOCK, "[CXC-SUBAGENT-SCOPE] This is one bounded delegated task. The parent\n"],
    [V1_SCOPE_BLOCK_COORDINATOR, "[CXC-SUBAGENT-SCOPE] This is one bounded delegated task with authorized\nrecursion."],
    [LEAF_GUARD_BLOCK, "[CXC-LEAF-GUARD] You are a LEAF agent with a single bounded task. HARD\n"],
    [LEAF_GUARD_BLOCK_COORDINATOR, "[CXC-LEAF-GUARD] You are a COORDINATOR agent with a single bounded task. HARD\n"],
  ];
  assert.equal(new Set(prefixes.map(([block]) => block)).size, 4);
  for (const [block, prefix] of prefixes) {
    assert.ok(block.startsWith(prefix));
    assert.match(block, /FSM\/loop\/goals/);
    assert.match(block, /Shared/);
    assert.match(block, /branch-level git/);
    assert.match(block, /\$codexclaw:cxc-pabcd.*delegation\.md/);
    assert.ok(!block.includes(SUBSPAWN_TOKEN));
    assert.ok(Buffer.byteLength(block) <= 350);
  }
  assert.ok(V1_SCOPE_BLOCK_COORDINATOR.includes("Keep every write scope non-overlapping and do not\nrun branch-level git commands (checkout, switch, branch, stash, reset, rebase,\nmerge, pull)."));
  assert.ok(LEAF_GUARD_BLOCK_COORDINATOR.includes("Give every child a non-overlapping write scope and do NOT run\nbranch-level git commands (checkout, switch, branch, stash, reset, rebase,\nmerge, pull) or let a child run them."));
});

for (const surface of surfaces) {
  test(`${surface.name}: guard reapplication preserves allow decision and dedupes`, t => {
    const cwd = mkdtempSync(join(tmpdir(), "cxc-l1-reapply-"));
    t.after(() => rmSync(cwd, { recursive: true, force: true }));
    // An unmanaged notice keeps both passes observable as allow envelopes.
    setRole(cwd, "executor", { fallback: { model: "fixture/fallback", effort: null } }, "project");
    const payload = { hook_event_name: "PreToolUse", tool_name: surface.tool, session_id: "l1-reapply", cwd,
      tool_input: { ...surface.fields, agent_type: "worker", message: "TASK: implement within scope" } };
    const first = JSON.parse(runSpawnAttachHook(JSON.stringify(payload))).hookSpecificOutput;
    assert.equal(first.permissionDecision, "allow");
    const repeated = JSON.parse(runSpawnAttachHook(JSON.stringify({ ...payload, tool_input: first.updatedInput }))).hookSpecificOutput;
    assert.equal(repeated.permissionDecision, "allow");
    assert.deepEqual(repeated.updatedInput, first.updatedInput);
    assert.equal(repeated.additionalContext, first.additionalContext);
    const message: string = repeated.updatedInput.message;
    assert.equal(message.split(surface.marker).length - 1, 1);
    assert.ok(message.startsWith(`${surface.leaf}\n\n`));
    assert.ok(!message.includes('<skill name="cxc-pabcd">'));
    assert.ok(Buffer.byteLength(first.additionalContext) <= 300);
    if (surface.name === "V2") {
      const affordance = message.slice(message.indexOf(SKILL_AFFORDANCE_MARKER));
      assert.ok(affordance.startsWith(SKILL_AFFORDANCE_MARKER));
      assert.ok(affordance.includes(`${resolve("plugins/codexclaw/skills")}/<name>/SKILL.md`));
      assert.match(affordance, /\$codexclaw:cxc-pabcd delegation\.md/);
      assert.doesNotMatch(affordance, /Available skills|^- cxc-/m);
      assert.ok(Buffer.byteLength(affordance) <= 250);
    }
  });

  test(`${surface.name}: public markers without a grant still deny child spawn`, t => {
    const cwd = mkdtempSync(join(tmpdir(), "cxc-l1-no-grant-"));
    t.after(() => rmSync(cwd, { recursive: true, force: true }));
    for (const message of ["TASK: helper", `${surface.leaf}\n\nTASK: helper`, `${SUBSPAWN_TOKEN} helper`]) {
      const result = JSON.parse(runSpawnAttachHook(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: surface.tool,
        cwd, session_id: "l1-no-grant", agent_id: "child", tool_input: { ...surface.fields, message } }))).hookSpecificOutput;
      assert.equal(result.permissionDecision, "deny");
      assert.match(result.permissionDecisionReason, /LEAF-TOPOLOGY-01/);
      assert.match(result.permissionDecisionReason, /\$codexclaw:cxc-pabcd delegation\.md/);
      assert.ok(Buffer.byteLength(result.permissionDecisionReason) <= 150);
      assert.ok(!("updatedInput" in result));
    }
  });

  test(`${surface.name}: coordinator suffix grants one child call and replay denies`, t => {
    const cwd = mkdtempSync(join(tmpdir(), "cxc-l1-grant-"));
    t.after(() => rmSync(cwd, { recursive: true, force: true }));
    const payload = { hook_event_name: "PreToolUse", tool_name: surface.tool, cwd, session_id: "l1-grant",
      tool_input: { ...surface.fields, message: `${SUBSPAWN_TOKEN} TASK: coordinate` } };
    const root = JSON.parse(runSpawnAttachHook(JSON.stringify(payload))).hookSpecificOutput;
    assert.equal(root.permissionDecision, "allow");
    const message: string = root.updatedInput.message;
    const capability = /\[CXC-SUBSPAWN-GRANT:[a-f0-9]{64}\]/.exec(message)?.[0];
    assert.ok(capability);
    assert.ok(message.startsWith(`${surface.coordinator}\nOne child spawn is authorized. Include this exact one-time capability in that spawn message: ${capability}\n\n`));
    const childPayload = { ...payload, agent_id: "child", tool_input: { ...surface.fields, message: `${capability}\nTASK: helper` } };
    const child = JSON.parse(runSpawnAttachHook(JSON.stringify(childPayload))).hookSpecificOutput;
    assert.equal(child.permissionDecision, "allow");
    assert.ok(child.updatedInput.message.startsWith(`${surface.leaf}\n\n`));
    assert.ok(!child.updatedInput.message.includes("CXC-SUBSPAWN-GRANT"));
    const replay = JSON.parse(runSpawnAttachHook(JSON.stringify(childPayload))).hookSpecificOutput;
    assert.equal(replay.permissionDecision, "deny");
    assert.match(replay.permissionDecisionReason, /LEAF-TOPOLOGY-01/);
  });
}

test("V1 full guard under V2 cannot suppress V2 guarding and reapplication dedupes", t => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-l1-cross-surface-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  setRole(cwd, "executor", { fallback: { model: "fixture/fallback", effort: null } }, "project");
  const payload = { hook_event_name: "PreToolUse", tool_name: "collaborationspawn_agent", cwd, session_id: "l1-cross-surface",
    tool_input: { task_name: "bounded-task", fork_turns: "none", agent_type: "worker", message: `${V1_SCOPE_BLOCK}\n\nTASK: implement` } };
  const first = JSON.parse(runSpawnAttachHook(JSON.stringify(payload))).hookSpecificOutput;
  assert.equal(first.permissionDecision, "allow");
  assert.ok(first.updatedInput.message.startsWith(`${LEAF_GUARD_BLOCK}\n\n${V1_SCOPE_BLOCK}\n\n`));
  const repeated = JSON.parse(runSpawnAttachHook(JSON.stringify({ ...payload, tool_input: first.updatedInput }))).hookSpecificOutput;
  assert.equal(repeated.permissionDecision, "allow");
  assert.deepEqual(repeated.updatedInput, first.updatedInput);
  assert.equal(repeated.updatedInput.message.split(LEAF_GUARD_MARKER).length - 1, 1);
  assert.equal(repeated.updatedInput.message.split(SCOPE_GUARD_MARKER).length - 1, 1);
});
