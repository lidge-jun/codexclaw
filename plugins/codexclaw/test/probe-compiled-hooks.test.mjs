// Benchmark CLI and compiled Node hooks support macOS, Linux and Windows.
// No Darwin gate: these fixtures use process.execPath and platform-native paths.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { analyzeBench } from "../scripts/probe-evidence.mjs";
import { benchmark, sha, readJson, put, putJson, syncNode } from "./probe-fixtures/filesystem.mjs";
import { assertVerdict } from "./probe-fixtures/evidence.mjs";
import { benchmarkFixture, compiledHookFixture, compiledOutput, spawnPayload } from "./probe-fixtures/compiled-hooks.mjs";

test("alternate plugin roots select fixture commands, preserve harness hash and count raw bytes", t => {
  const roots = [benchmarkFixture(t), benchmarkFixture(t)];
  const reports = roots.map(root => {
    const result = syncNode([benchmark, "--plugin-root", root, "--iterations", "2", "--json"], root);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.pluginRoot, root);
    assert.equal(report.hooks.length, 1);
    assert.equal(report.hooks[0].command, `node "${root}/entry.mjs"`);
    assert.equal(report.hooks[0].invocations, 2);
    assert.equal(report.hooks[0].errorCount, 0);
    assert.equal(report.hooks[0].stdoutBytes, 6);
    assert.equal(report.hooks[0].stderrBytes, 0);
    return report;
  });
  assert.equal(reports[0].harnessSha256, sha(readFileSync(benchmark)));
  assert.equal(reports[0].harnessSha256, reports[1].harnessSha256);
});

test("benchmark nonzero hook exits cannot become analyzer success through a zero controller exit", t => {
  const root = benchmarkFixture(t, 'process.stderr.write("fixture-error\\n"); process.exitCode = 3;');
  const result = syncNode([benchmark, "--plugin-root", root, "--iterations", "2", "--json"], root);
  assert.equal(result.status, 0, "legacy controller returns zero; the report must expose failure");
  const after = JSON.parse(result.stdout);
  assert.equal(after.hooks[0].errorCount, 2);
  assert.equal(after.hooks[0].stderrBytes, 28);
  assert.equal(after.hooks[0].stdoutBytes, 0);
  // A synthetic compatible baseline avoids noisy real floor timings preempting
  // the after-report error guard. No timing here is presented as measured proof.
  const before = { schemaVersion: 1, platform: after.platform, release: after.release,
    nodeVersion: after.nodeVersion, harnessSha256: after.harnessSha256, iterations: 2,
    hooks: [{ name: "fixture", event: "PreToolUse", aboveFloorMs: 10,
      errorCount: 0, invocations: 2, stdoutBytes: 6, stderrBytes: 0 }] };
  assert.throws(() => analyzeBench(before, after, 10), /hook invocation failed/);
  assertVerdict(() => analyzeBench(before, after, 10), 1);
});

for (const missing of ["argument", "manifest hook file"]) {
  test(`benchmark rejects missing ${missing} without emitting a valid report`, t => {
    const root = benchmarkFixture(t);
    if (missing === "manifest hook file") rmSync(join(root, "hooks/fixture.json"));
    const args = missing === "argument" ? [benchmark, "--json", "--plugin-root"]
      : [benchmark, "--plugin-root", root, "--iterations", "2", "--json"];
    const result = syncNode(args, root);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout.trim(), "");
    assert.match(result.stderr, missing === "argument" ? /requires a directory/ : /missing manifest hook file/);
  });
}

for (const surface of ["V1", "V2"]) {
  test(`compiled ${surface} manifest spawn delivers installed skill and preserves input without duplicate replay`, t => {
    const f = compiledHookFixture(t, "pre-tool-use-attaching-skills.json");
    const payload = spawnPayload(f, surface);
    assert.equal(new RegExp(f.matcher).test(payload.tool_name), true, "actual host-facing name must match manifest");
    const output = JSON.parse(compiledOutput(f, payload)).hookSpecificOutput;
    assert.equal(output.hookEventName, "PreToolUse");
    const ui = output.updatedInput;
    assert.ok(ui && typeof ui.message === "string");
    const guard = surface === "V1" ? "[CXC-SUBAGENT-SCOPE]" : "[CXC-LEAF-GUARD]";
    assert.ok(ui.message.startsWith(guard));
    assert.ok(ui.message.includes(`[$cxc-dev](skill://${realpathSync(f.skill)}) inspect the fixture`));
    assert.ok(ui.message.includes('<skill name="cxc-dev">'));
    assert.ok(ui.message.includes(f.skillBody.trim()), "body must come from the installed fixture, not the checkout");
    for (const [key, value] of Object.entries(payload.tool_input)) {
      if (key !== "message") assert.deepEqual(ui[key], value, key);
    }
    assert.equal(Object.hasOwn(ui, "items"), false, "do not invent native items transport");
    const replay = compiledOutput(f, { ...payload, tool_input: { ...payload.tool_input, message: ui.message } });
    // An idempotent hook may emit no update; otherwise guard/body cardinality is
    // checked on its effective message (V2 may append its self-load affordance).
    const replayed = replay.trim() ? JSON.parse(replay).hookSpecificOutput.updatedInput.message : ui.message;
    assert.equal(replayed.split(guard).length - 1, 1);
    assert.equal(replayed.split('<skill name="cxc-dev">').length - 1, 1);
    assert.equal(replayed.split(f.skillBody.trim()).length - 1, 1);
    assert.equal(compiledOutput(f, { ...payload, tool_name: "exec_command" }), "");
  });
}

test("compiled worktree guard denies self-deletion without executing it; benign command is allowed", t => {
  const f = compiledHookFixture(t, "pre-tool-use-guarding-managed-worktree-deletion.json");
  const checkout = join(f.env.CODEX_HOME, "worktrees/7627/fixture");
  put(checkout, ".git", "gitdir: /fake/main/.git/worktrees/7627\n");
  put(checkout, "preserve.txt", "untouched\n");
  const payload = { hook_event_name: "PreToolUse", session_id: "probe-worktree", cwd: checkout,
    tool_name: "Bash", tool_input: { command: `git worktree remove '${checkout}'` } };
  assert.equal(new RegExp(f.matcher).test(payload.tool_name), true);
  const out = JSON.parse(compiledOutput(f, payload)).hookSpecificOutput;
  assert.equal(out.hookEventName, "PreToolUse");
  assert.equal(out.permissionDecision, "deny");
  assert.match(out.permissionDecisionReason, /WORKTREE-GUARD-03/);
  assert.equal(typeof out.additionalContext, "string");
  assert.equal(compiledOutput(f, { ...payload, tool_input: { command: "git status" } }), "");
  assert.equal(readFileSync(join(checkout, "preserve.txt"), "utf8"), "untouched\n");
});

test("compiled goal-completion gate denies mid-cycle complete but allows blocked", t => {
  const f = compiledHookFixture(t, "pre-tool-use-guarding-goal-complete.json");
  putJson(f.cwd, ".codexclaw/sessions/probe-complete.json", {
    phase: "B", sessionId: "probe-complete", slug: "", updatedAt: "2026-01-01T00:00:00Z",
    flags: { interview: false, auditPassed: false, checkPassed: false }, supersededBy: null,
    injectedTurns: [], lastInjectedPhase: "B", orchestrationActive: true, interview: null,
    stopBlockPhase: null, stopBlockCount: 0,
  });
  const payload = { hook_event_name: "PreToolUse", session_id: "probe-complete", cwd: f.cwd,
    tool_name: "update_goal", tool_input: { status: "complete" } };
  assert.equal(new RegExp(f.matcher).test(payload.tool_name), true);
  const out = JSON.parse(compiledOutput(f, payload)).hookSpecificOutput;
  assert.equal(out.permissionDecision, "deny");
  assert.match(out.permissionDecisionReason, /GOAL-COMPLETE-GATE-01/);
  assert.equal(compiledOutput(f, { ...payload, tool_input: { status: "blocked" } }), "");
  assert.equal(readJson(join(f.cwd, ".codexclaw/sessions/probe-complete.json")).phase, "B");
});
