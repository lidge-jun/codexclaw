// hook-e2e.test.mjs - manifest-path end-to-end coverage for EVERY declared hook
// (G19 / L20-WP7). Each test drives the REAL dist entrypoint named in the hook's
// plugin.json command string, exactly as codex would invoke it (argv hook <event>
// + a JSON payload on stdin), and asserts exit 0 plus the expected stdout envelope
// or filesystem side effect.
//
// Determinism (per the WP7 A-gate): the interview-in-goal guard reads codex's goals
// DB, so we point CODEX_HOME/CODEX_SQLITE_HOME at an empty temp dir (no goals_1.sqlite
// => status "inactive" => allow). The provider session-start path shells out to find
// ocx; it ALWAYS exits 0 and emits a status line regardless, so we assert only the
// stable contract (exit 0 + a parseable provider status line), not a specific mode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, rmSync, mkdtempSync, cpSync } from "node:fs";
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
      // smoke-check: a fully-written cli.js ends with the main() invocation, not mid-write.
      if (body.length > 0 && /main\(\);?\s*$/.test(body.trimEnd())) {
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
  assert.ok(Array.isArray(manifest.hooks) && manifest.hooks.length === 6, "expected 6 declared hooks");
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

test("WP7/G19: session-start provider hook e2e - exit 0 + parseable provider status line", () => {
  const { event, hookEvent, distAbs } = readHookCommand("./hooks/session-start-ensuring-provider-bridge.json");
  assert.equal(event, "SessionStart");
  const ep = snapshotEntrypoint(distAbs);
  if (!ep) return;
  const emptyPath = mkdtempSync(join(tmpdir(), "ccx-path-"));
  try {
    const res = runHook(ep, hookEvent, null, { PATH: emptyPath });
    assert.equal(res.status, 0, res.stderr);
    const line = res.stdout.trim().split("\n").pop();
    const status = JSON.parse(line);
    assert.equal(status.provider, "ocx");
    assert.ok(["native", "provider", "error"].includes(status.mode), `unexpected mode: ${status.mode}`);
  } finally { rmSync(emptyPath, { recursive: true, force: true }); }
});
