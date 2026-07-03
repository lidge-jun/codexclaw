// hook-e2e.test.mjs - manifest-path end-to-end coverage for EVERY declared hook
// (G19 / L20-WP7 + WP22). Each test drives the REAL dist entrypoint named in the
// hook's plugin.json command string, exactly as codex would invoke it (argv hook
// <event> + a JSON payload on stdin), and asserts exit 0 plus the expected stdout
// envelope or filesystem side effect. WP7 covered 5 of 6 hooks behaviorally + a
// resolve check across all 6; WP22 added the 6th (user-prompt-submit) behaviorally,
// so every manifest hook is now exercised, not just resolved.
//
// Determinism (per the WP7 A-gate): the interview-in-goal guard reads codex's goals
// DB, so we point CODEX_HOME/CODEX_SQLITE_HOME at an empty temp dir (no goals_1.sqlite
// => status "inactive" => allow). The provider session-start path shells out to find
// ocx; it ALWAYS exits 0 and emits a status line regardless, so we assert only the
// stable contract (exit 0 + a parseable provider status line), not a specific mode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, rmSync, mkdtempSync, cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");

// This suite drives the COMPILED dist entrypoints, so it needs a prior `npm run build`
// (the project verify protocol builds before testing). It deliberately does NOT invoke
// build.mjs itself. To stay immune to the C10 build/test contention (build.test.mjs and
// packaging.test.mjs rebuild dist in parallel workers and would clobber a cli.js mid-read),
// each entrypoint is SNAPSHOT-copied to an isolated temp dir before it is run. A concurrent
// rebuild of the source tree cannot then race the spawned process. If dist is absent, each
// test skips gracefully (matching mcp.test.ts).
const snapshots = new Map();
process.on("exit", () => {
  for (const dir of snapshots.values()) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
});
// Synchronous sleep (Atomics) so a settle-retry works inside node:test's sync flow.
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Snapshot the component's whole dist/ to temp, but only once a SETTLED tree is
// observed: build.test.mjs/packaging.test.mjs rebuild the shared committed dist/
// mid-run (C10), so a naive copy can capture a half-written cli.js. We retry the
// copy + a parse smoke-check until the entrypoint is intact (or skip if dist is
// genuinely absent). This isolates the spawned process from concurrent rebuilds.
function snapshotEntrypoint(distAbs) {
  const srcDir = dirname(distAbs); // cli.js imports siblings -> copy the dir
  const existing = snapshots.get(srcDir);
  if (existing) return join(existing, basename(distAbs));
  if (!existsSync(distAbs)) return null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const snapDir = mkdtempSync(join(tmpdir(), "ccx-dist-"));
    try {
      cpSync(srcDir, snapDir, { recursive: true });
      const ep = join(snapDir, basename(distAbs));
      const body = readFileSync(ep, "utf8");
      // smoke-check: a fully-written entrypoint ends with the main() invocation — either
      // bare (`main();`) or wrapped in an import-guard block (`main();\n}`), not mid-write.
      if (body.length > 0 && /main\(\);?\s*\}?\s*$/.test(body.trimEnd())) {
        snapshots.set(srcDir, snapDir);
        return ep;
      }
    } catch { /* mid-rebuild; fall through to retry */ }
    rmSync(snapDir, { recursive: true, force: true });
    sleepSync(50);
  }
  return null; // dist never settled within budget; skip rather than flake
}

// Resolve a hook JSON's first command string to its absolute dist entrypoint plus
// the `hook <event>` argv, by reading the real manifest-referenced hook file.
function readHookCommand(hookFileRel) {
  const hookPath = join(pluginRoot, hookFileRel.replace(/^\.\//, ""));
  const json = JSON.parse(readFileSync(hookPath, "utf8"));
  const [event] = Object.keys(json.hooks);
  const command = json.hooks[event][0].hooks[0].command;
  const m = /"\$\{PLUGIN_ROOT\}\/([^"]+)"\s+hook\s+(\S+)/.exec(command);
  assert.ok(m, `hook command not parseable: ${command}`);
  return { event, distRel: m[1], hookEvent: m[2], distAbs: join(pluginRoot, m[1]) };
}

function runHook(distAbs, hookEvent, payload, extraEnv = {}) {
  return spawnSync(process.execPath, [distAbs, "hook", hookEvent], {
    input: payload === null ? "" : JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
}

function emptyCodexHome() {
  const dir = mkdtempSync(join(tmpdir(), "ccx-home-"));
  return { dir, env: { CODEX_HOME: dir, CODEX_SQLITE_HOME: dir } };
}

test("WP7/G19: every manifest hook command resolves to an existing dist entrypoint", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.ok(Array.isArray(manifest.hooks) && manifest.hooks.length === 17, "expected 17 declared hooks");
  for (const rel of manifest.hooks) {
    const { distAbs } = readHookCommand(rel);
    // Settle-retry: a concurrent rebuild (C10) may briefly unlink dist mid-run.
    let present = false;
    for (let i = 0; i < 40 && !present; i++) {
      if (existsSync(distAbs)) { present = true; break; }
      sleepSync(50);
    }
    assert.ok(present, `manifest hook dist entrypoint missing: ${distAbs}`);
  }
});

test("WP7/G19: stop hook e2e - no in-flight cycle releases (exit 0, empty stdout)", () => {
  const { event, hookEvent, distAbs } = readHookCommand("./hooks/stop-checking-pabcd-continuation.json");
  assert.equal(event, "Stop");
  const ep = snapshotEntrypoint(distAbs);
  if (!ep) return; // build not run yet; skip gracefully
  const tmp = mkdtempSync(join(tmpdir(), "ccx-stop-"));
  try {
    const res = runHook(ep, hookEvent, { hook_event_name: "Stop", session_id: "s1", cwd: tmp });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), "", "fresh cwd => IDLE => no block");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// lazygap_impl 080.1: shell friction capture (PostToolUse ^Bash$) + advisory gate
// (PreToolUse ^Bash$). Capture records a signature on a failure-looking tool_response;
// the gate asks to change approach once a stop-level signature exists. Both fail-open.
test("L080: post-tool-use-friction records on a failing Bash response; pre gate advises at stop", () => {
  const cap = readHookCommand("./hooks/post-tool-use-capturing-shell-friction.json");
  assert.equal(cap.event, "PostToolUse");
  const capEp = snapshotEntrypoint(cap.distAbs);
  if (!capEp) return;
  const gate = readHookCommand("./hooks/pre-tool-use-advising-on-friction.json");
  assert.equal(gate.event, "PreToolUse");
  const gateEp = snapshotEntrypoint(gate.distAbs);
  if (!gateEp) return;
  const tmp = mkdtempSync(join(tmpdir(), "ccx-friction-"));
  try {
    const failPayload = {
      hook_event_name: "PostToolUse", session_id: "s1", cwd: tmp,
      tool_name: "Bash", tool_input: { command: "build" },
      tool_response: "fatal: boom at x.ts:1:1\nnpm ERR! code E1",
    };
    // 3 recurrences of the SAME normalized signature -> stop
    for (let i = 0; i < 3; i++) {
      const r = runHook(capEp, cap.hookEvent, { ...failPayload, tool_response: `fatal: boom at x.ts:${i}:1` });
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stdout.trim(), "", "capture is side-effect only");
    }
    assert.ok(existsSync(join(tmp, ".codexclaw", "friction.jsonl")), "friction ledger written");

    // the PreToolUse gate now advises (ask) on a Bash call
    const adv = runHook(gateEp, gate.hookEvent, {
      hook_event_name: "PreToolUse", session_id: "s1", cwd: tmp, tool_name: "Bash", tool_input: { command: "rerun" },
    });
    assert.equal(adv.status, 0, adv.stderr);
    const out = JSON.parse(adv.stdout);
    assert.equal(out.hookSpecificOutput.permissionDecision, "ask");
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /friction/i);

    // a clean response does NOT record; fresh cwd gate stays silent (fail-open allow)
    const clean = mkdtempSync(join(tmpdir(), "ccx-friction2-"));
    try {
      const ok = runHook(capEp, cap.hookEvent, {
        hook_event_name: "PostToolUse", session_id: "s1", cwd: clean,
        tool_name: "Bash", tool_input: { command: "ls" }, tool_response: "ok, listing complete",
      });
      assert.equal(ok.stdout.trim(), "", "clean response side-effect only");
      const silent = runHook(gateEp, gate.hookEvent, {
        hook_event_name: "PreToolUse", session_id: "s1", cwd: clean, tool_name: "Bash", tool_input: {},
      });
      assert.equal(silent.stdout.trim(), "", "no stop signature => gate allows (empty stdout)");
    } finally { rmSync(clean, { recursive: true, force: true }); }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("WP7/G19: pre-tool-use goal-budget hook e2e - bare create_goal allows, token_budget denies", () => {
  const { event, hookEvent, distAbs } = readHookCommand("./hooks/pre-tool-use-guarding-goal-budget.json");
  assert.equal(event, "PreToolUse");
  const ep = snapshotEntrypoint(distAbs);
  if (!ep) return;
  const tmp = mkdtempSync(join(tmpdir(), "ccx-budget-"));
  try {
    const allow = runHook(ep, hookEvent, {
      hook_event_name: "PreToolUse", session_id: "s1", cwd: tmp,
      tool_name: "create_goal", tool_input: { objective: "x" },
    });
    assert.equal(allow.status, 0, allow.stderr);
    assert.equal(allow.stdout.trim(), "", "bare objective must allow (empty stdout)");

    const deny = runHook(ep, hookEvent, {
      hook_event_name: "PreToolUse", session_id: "s1", cwd: tmp,
      tool_name: "create_goal", tool_input: { objective: "x", token_budget: 1000 },
    });
    assert.equal(deny.status, 0, deny.stderr);
    const out = JSON.parse(deny.stdout);
    assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /token_budget/i);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("WP7/G19: pre-tool-use interview-in-goal hook e2e - inactive goal allows request_user_input", () => {
  const { event, hookEvent, distAbs } = readHookCommand("./hooks/pre-tool-use-guarding-interview-in-goal.json");
  assert.equal(event, "PreToolUse");
  const ep = snapshotEntrypoint(distAbs);
  if (!ep) return;
  const tmp = mkdtempSync(join(tmpdir(), "ccx-ig-"));
  const home = emptyCodexHome();
  try {
    const res = runHook(ep, hookEvent, {
      hook_event_name: "PreToolUse", session_id: "s1", cwd: tmp,
      tool_name: "request_user_input", tool_input: { questions: [] },
    }, home.env);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), "", "no goals DB => inactive => allow (empty stdout)");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(home.dir, { recursive: true, force: true });
  }
});

test("WP7/G19: post-tool-use hook e2e - captures a request_user_input round into the ledger", () => {
  const { event, hookEvent, distAbs } = readHookCommand("./hooks/post-tool-use-capturing-interview-answers.json");
  assert.equal(event, "PostToolUse");
  const ep = snapshotEntrypoint(distAbs);
  if (!ep) return;
  const tmp = mkdtempSync(join(tmpdir(), "ccx-post-"));
  try {
    const res = runHook(ep, hookEvent, {
      hook_event_name: "PostToolUse", session_id: "s1", cwd: tmp, turn_id: "t1",
      tool_name: "request_user_input",
      tool_input: { questions: [{ id: "q1", question: "Pick one" }] },
      tool_response: { answers: { q1: { answers: ["A"] } } },
    });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), "", "PostToolUse recorder emits nothing");
    const ledger = join(tmp, ".codexclaw", "interviews", "s1.jsonl");
    assert.ok(existsSync(ledger), "interview ledger not written");
    const events = readFileSync(ledger, "utf8").trim().split("\n").map((l) => JSON.parse(l).event);
    assert.ok(events.includes("question_asked"), "missing question_asked row");
    assert.ok(events.includes("answer_recorded"), "missing answer_recorded row");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("WP7/G19: session-start provider hook e2e - exit 0 + parseable SessionStart envelope", () => {
  const { event, hookEvent, distAbs } = readHookCommand("./hooks/session-start-ensuring-provider-bridge.json");
  assert.equal(event, "SessionStart");
  const ep = snapshotEntrypoint(distAbs);
  if (!ep) return;
  const emptyPath = mkdtempSync(join(tmpdir(), "ccx-path-"));
  try {
    const res = runHook(ep, hookEvent, null, { PATH: emptyPath });
    assert.equal(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout.trim());
    assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
    const status = JSON.parse(out.hookSpecificOutput.additionalContext);
    assert.equal(status.provider, "ocx");
    assert.ok(["native", "provider", "error"].includes(status.mode), `unexpected mode: ${status.mode}`);
  } finally { rmSync(emptyPath, { recursive: true, force: true }); }
});

// WP22 (Volta completion-audit finding): the manifest's sixth hook,
// user-prompt-submit, was only path-resolution-checked above, never invoked.
// These two cases drive its REAL dist entrypoint to close the e2e gap: an
// orchestration-activating trigger must inject the phase directive envelope, and a
// non-orchestrated no-trigger prompt must stay silent (fail-closed). Determinism:
// the loose "P" trigger path never reads the goals DB (only the I paths do), and all
// state writes land under the temp cwd (.codexclaw/sessions/<key>.json), so no
// CODEX_HOME seeding is needed.
test("WP22/G19: user-prompt-submit hook e2e - 'plan this' trigger injects the P directive envelope + footer", () => {
  const { event, hookEvent, distAbs } = readHookCommand("./hooks/user-prompt-submit-checking-pabcd-trigger.json");
  assert.equal(event, "UserPromptSubmit");
  const ep = snapshotEntrypoint(distAbs);
  if (!ep) return;
  const tmp = mkdtempSync(join(tmpdir(), "ccx-ups-"));
  try {
    const res = runHook(ep, hookEvent, {
      hook_event_name: "UserPromptSubmit", session_id: "s1", cwd: tmp, turn_id: "t1",
      prompt: "plan this",
    });
    assert.equal(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    const ctx = out.hookSpecificOutput.additionalContext;
    assert.match(ctx, /PLAN/, "missing PLAN phase directive");
    assert.match(ctx, /IPABCD: P \(PLAN\)/, "missing IPABCD P footer");
    // mode-1 persists orchestration under the temp cwd (turn_id present).
    const stateFile = join(tmp, ".codexclaw", "sessions", "s1.json");
    assert.ok(existsSync(stateFile), "session state not persisted");
    const persisted = JSON.parse(readFileSync(stateFile, "utf8"));
    assert.equal(persisted.orchestrationActive, true, "trigger must activate orchestration");
    assert.equal(persisted.lastInjectedPhase, "P", "lastInjectedPhase should be P");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("WP22/G19: user-prompt-submit hook e2e - no trigger + un-orchestrated stays silent (fail-closed)", () => {
  const { hookEvent, distAbs } = readHookCommand("./hooks/user-prompt-submit-checking-pabcd-trigger.json");
  const ep = snapshotEntrypoint(distAbs);
  if (!ep) return;
  const tmp = mkdtempSync(join(tmpdir(), "ccx-ups0-"));
  try {
    const res = runHook(ep, hookEvent, {
      hook_event_name: "UserPromptSubmit", session_id: "s2", cwd: tmp, turn_id: "t1",
      prompt: "hello there",
    });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), "", "no trigger + never orchestrated => empty stdout");
    // fail-closed: nothing should have been persisted either.
    assert.ok(!existsSync(join(tmp, ".codexclaw", "sessions", "s2.json")), "no state should be written");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test("agbrowse: user-prompt-submit hook e2e - natural language agbrowse request injects cxc-search guidance", () => {
  const { hookEvent, distAbs } = readHookCommand("./hooks/user-prompt-submit-checking-pabcd-trigger.json");
  const ep = snapshotEntrypoint(distAbs);
  if (!ep) return;
  const tmp = mkdtempSync(join(tmpdir(), "ccx-agbrowse-"));
  try {
    const res = runHook(ep, hookEvent, {
      hook_event_name: "UserPromptSubmit", session_id: "s-ag", cwd: tmp, turn_id: "t1",
      prompt: "agbrowe를 통해서 질문해줘",
    });
    assert.equal(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout);
    const ctx = out.hookSpecificOutput.additionalContext;
    assert.match(ctx, /\[codexclaw: SEARCH/);
    assert.match(ctx, /cxc-search/);
    assert.match(ctx, /agbrowse fetch/);
    assert.match(ctx, /Never use plain `agbrowse search/);
    const stateFile = join(tmp, ".codexclaw", "sessions", "s-ag.json");
    assert.ok(existsSync(stateFile), "turn dedup state should be persisted");
    const persisted = JSON.parse(readFileSync(stateFile, "utf8"));
    assert.equal(persisted.orchestrationActive, false, "search injection must not activate PABCD");
    assert.equal(persisted.lastInjectedPhase, null, "search injection must not pretend to be a PABCD phase");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// lazygap_impl 010: SubagentStop evidence-receipt gate. A gated worker child with no
// receipt must be blocked (decision:block); a valid receipt under .codexclaw/evidence/
// releases. Drives the real dist entrypoint via the manifest command.
test("L010: subagent-stop hook e2e - worker w/o receipt blocks, valid receipt releases", () => {
  const { event, hookEvent, distAbs } = readHookCommand("./hooks/subagent-stop-verifying-evidence.json");
  assert.equal(event, "SubagentStop");
  const ep = snapshotEntrypoint(distAbs);
  if (!ep) return;
  const tmp = mkdtempSync(join(tmpdir(), "ccx-sas-"));
  try {
    // 1) worker, no receipt -> block with the EVIDENCE_RECORDED contract.
    const blocked = runHook(ep, hookEvent, {
      hook_event_name: "SubagentStop", session_id: "s1", cwd: tmp,
      agent_type: "worker", agent_id: "a1", last_assistant_message: "all done!",
    });
    assert.equal(blocked.status, 0, blocked.stderr);
    const out = JSON.parse(blocked.stdout);
    assert.equal(out.decision, "block");
    assert.match(out.reason, /EVIDENCE_RECORDED/);

    // 2) explorer (non-gated) -> released (empty stdout).
    const released = runHook(ep, hookEvent, {
      hook_event_name: "SubagentStop", session_id: "s1", cwd: tmp,
      agent_type: "explorer", agent_id: "a2", last_assistant_message: "findings...",
    });
    assert.equal(released.status, 0, released.stderr);
    assert.equal(released.stdout.trim(), "", "non-gated agent_type must release");

    // 3) worker WITH a valid receipt -> released.
    mkdirSync(join(tmp, ".codexclaw", "evidence"), { recursive: true });
    writeFileSync(join(tmp, ".codexclaw", "evidence", "p.md"), "tests green");
    const ok = runHook(ep, hookEvent, {
      hook_event_name: "SubagentStop", session_id: "s3", cwd: tmp,
      agent_type: "worker", agent_id: "a3",
      last_assistant_message: "done.\nEVIDENCE_RECORDED: .codexclaw/evidence/p.md",
    });
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.stdout.trim(), "", "valid receipt must release");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// WP1 (was lazygap_impl 020): the E3 spawn-attach hook, mention-channel upgrade.
// ALWAYS-ON (no env opt-in): rewrites the spawn `message` to prepend link-form
// `[$cxc-*](skill://...)` mentions (full-replacement updatedInput, no `items` added),
// and no-ops when the structured `items` channel is already present. The snapshot
// entrypoint runs outside the plugin tree, so CODEXCLAW_SKILLS_DIR pins the real
// skills dir. Drives the real dist entrypoint via the manifest command.
test("WP1: pre-tool-use spawn-attach hook e2e - always-on mention rewrite; items-present no-op", () => {
  const { event, hookEvent, distAbs } = readHookCommand("./hooks/pre-tool-use-attaching-skills.json");
  assert.equal(event, "PreToolUse");
  const ep = snapshotEntrypoint(distAbs);
  assert.ok(ep, "subagent-config dist entrypoint must settle (vacuous skip is a test bug)");
  const skillsEnv = { CODEXCLAW_SKILLS_DIR: join(pluginRoot, "skills") };
  const payload = {
    hook_event_name: "PreToolUse", session_id: "s1", cwd: process.cwd(),
    tool_name: "spawn_agent",
    tool_input: { message: "review the frontend diff", agent_type: "explorer" },
  };
  // no env opt-in needed -> full-replacement updatedInput with a mention block
  const attached = runHook(ep, hookEvent, payload, skillsEnv);
  assert.equal(attached.status, 0, attached.stderr);
  const out = JSON.parse(attached.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, "allow");
  const ui = out.hookSpecificOutput.updatedInput;
  assert.equal(ui.agent_type, "explorer", "original input preserved (full replacement)");
  assert.ok(!("items" in ui), "mention channel must not add items");
  assert.match(ui.message, /\[\$cxc-dev\]\(skill:\/\/.*\/dev\/SKILL\.md\)/);
  assert.match(ui.message, /\[\$cxc-dev-frontend\]\(skill:\/\/.*\/dev-frontend\/SKILL\.md\)/);
  assert.ok(ui.message.endsWith("review the frontend diff"), "original message preserved at the end");

  // structured items already present -> no-op (never double-attach)
  const noop = runHook(ep, hookEvent, {
    ...payload,
    tool_input: { ...payload.tool_input, items: [{ type: "text", text: "TASK: x" }] },
  }, skillsEnv);
  assert.equal(noop.status, 0, noop.stderr);
  assert.equal(noop.stdout.trim(), "", "items-present must be a no-op");
});

// lazygap_impl 050: PostCompact recovery hook. Side-effect-only — resets the re-inject
// cursor (lastInjectedPhase=null) on an active cycle so the next non-suppressed same-phase
// prompt gets the FULL directive; no-op when idle. Output is always empty (PostCompact
// cannot inject context). Drives the real dist entrypoint via the manifest command.
test("L050: post-compact hook e2e - active cycle resets cursor, idle is a no-op", () => {
  const { event, hookEvent, distAbs } = readHookCommand("./hooks/post-compact-resetting-reinject-cursor.json");
  assert.equal(event, "PostCompact");
  const ep = snapshotEntrypoint(distAbs);
  if (!ep) return;
  const tmp = mkdtempSync(join(tmpdir(), "ccx-postcompact-"));
  try {
    const sessionsDir = join(tmp, ".codexclaw", "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    const statePath = join(sessionsDir, "s1.json");
    // active cycle at B with the cursor pinned to B (mode-3 short-header condition)
    writeFileSync(statePath, JSON.stringify({
      phase: "B", sessionId: "s1", slug: "", updatedAt: "2026-07-01T00:00:00Z",
      flags: { interview: false, auditPassed: false, checkPassed: false },
      supersededBy: null, injectedTurns: [], lastInjectedPhase: "B",
      orchestrationActive: true, interview: null, stopBlockPhase: null, stopBlockCount: 0,
    }));
    const res = runHook(ep, hookEvent, { hook_event_name: "PostCompact", session_id: "s1", cwd: tmp, trigger: "auto" });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), "", "PostCompact output is side-effect only (empty stdout)");
    const after = JSON.parse(readFileSync(statePath, "utf8"));
    assert.equal(after.lastInjectedPhase, null, "cursor must be reset to null on an active cycle");
    assert.equal(after.phase, "B", "phase untouched");
    assert.equal(after.orchestrationActive, true, "orchestrationActive untouched");

    // idle session => no-op (no state file written / unchanged)
    const idlePath = join(sessionsDir, "idle.json");
    writeFileSync(idlePath, JSON.stringify({
      phase: "IDLE", sessionId: "idle", slug: "", updatedAt: "2026-07-01T00:00:00Z",
      flags: { interview: false, auditPassed: false, checkPassed: false },
      supersededBy: null, injectedTurns: [], lastInjectedPhase: null,
      orchestrationActive: false, interview: null, stopBlockPhase: null, stopBlockCount: 0,
    }));
    const idleRes = runHook(ep, hookEvent, { hook_event_name: "PostCompact", session_id: "idle", cwd: tmp, trigger: "auto" });
    assert.equal(idleRes.status, 0, idleRes.stderr);
    assert.equal(idleRes.stdout.trim(), "", "idle session => empty stdout");
    assert.equal(JSON.parse(readFileSync(idlePath, "utf8")).updatedAt, "2026-07-01T00:00:00Z", "idle state must be untouched");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// lazygap_impl 060.2: comment-lint PreToolUse on apply_patch. FAIL-OPEN: denies a
// forbidden pattern on an added line; allows clean patches and any error. Drives the real
// dist entrypoint via the manifest command (event arg pre-tool-use-lint).
test("L060: pre-tool-use-lint hook e2e - forbidden pattern denies, clean patch allows", () => {
  const { event, hookEvent, distAbs } = readHookCommand("./hooks/pre-tool-use-linting-apply-patch.json");
  assert.equal(event, "PreToolUse");
  const ep = snapshotEntrypoint(distAbs);
  if (!ep) return;
  const deny = runHook(ep, hookEvent, {
    hook_event_name: "PreToolUse", session_id: "s1", cwd: process.cwd(),
    tool_name: "apply_patch", tool_input: { command: "+++ b/x.ts\n+const v = foo as any;\n" },
  });
  assert.equal(deny.status, 0, deny.stderr);
  const out = JSON.parse(deny.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /comment-lint/);

  const allow = runHook(ep, hookEvent, {
    hook_event_name: "PreToolUse", session_id: "s1", cwd: process.cwd(),
    tool_name: "apply_patch", tool_input: { command: "+++ b/x.ts\n+const v: Foo = foo;\n" },
  });
  assert.equal(allow.status, 0, allow.stderr);
  assert.equal(allow.stdout.trim(), "", "clean patch must allow (empty stdout)");

  // FAIL-OPEN: malformed payload => allow
  const bad = runHook(ep, hookEvent, null);
  assert.equal(bad.status, 0, bad.stderr);
  assert.equal(bad.stdout.trim(), "", "malformed stdin must fail open (empty stdout)");
});

// lazygap_impl 060.1: SessionStart project-rule injector. Emits an additionalContext
// envelope when rules exist, "" when none. Drives the real dist entrypoint (event arg
// session-start-rules).
test("L060: session-start-rules hook e2e - seeded rules inject, empty dir is silent", () => {
  const { event, hookEvent, distAbs } = readHookCommand("./hooks/session-start-injecting-project-rules.json");
  assert.equal(event, "SessionStart");
  const ep = snapshotEntrypoint(distAbs);
  if (!ep) return;
  const tmp = mkdtempSync(join(tmpdir(), "ccx-rules-"));
  try {
    // no rules => empty
    const empty = runHook(ep, hookEvent, { hook_event_name: "SessionStart", session_id: "s1", cwd: tmp });
    assert.equal(empty.status, 0, empty.stderr);
    assert.equal(empty.stdout.trim(), "", "no rules => empty stdout");

    // seed a rule
    const rulesDir = join(tmp, ".codexclaw", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, "a.md"), "Project rule: always run the gate.");
    const res = runHook(ep, hookEvent, { hook_event_name: "SessionStart", session_id: "s1", cwd: tmp });
    assert.equal(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
    assert.match(out.hookSpecificOutput.additionalContext, /always run the gate/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
