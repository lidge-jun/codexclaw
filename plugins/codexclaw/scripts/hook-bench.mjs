#!/usr/bin/env node
/**
 * hook-bench.mjs -- lifecycle hook benchmark harness (issue #13).
 *
 * Replays representative payload fixtures through real compiled hook entrypoints
 * and records per-hook/per-event: invocation count, no-op rate, wall time p50/p95/p99.
 *
 * Usage:
 *   node plugins/codexclaw/scripts/hook-bench.mjs              # run benchmark
 *   node plugins/codexclaw/scripts/hook-bench.mjs --json        # machine-readable output
 *   node plugins/codexclaw/scripts/hook-bench.mjs --iterations N  # custom iteration count
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUG_ROOT = resolve(HERE, "..");
const MANIFEST_PATH = join(PLUG_ROOT, ".codex-plugin", "plugin.json");

function loadHooks() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const hookFiles = manifest.hooks || [];
  const hooks = [];
  for (const relPath of hookFiles) {
    const absPath = join(PLUG_ROOT, relPath.replace(/^\.\//, ""));
    if (!existsSync(absPath)) continue;
    const config = JSON.parse(readFileSync(absPath, "utf8"));
    const fileName = relPath.replace(/.*\//, "").replace(".json", "");
    for (const [event, groups] of Object.entries(config.hooks || {})) {
      for (const group of groups) {
        for (const hook of group.hooks || []) {
          if (hook.type === "command") {
            hooks.push({
              name: fileName,
              event,
              command: hook.command.replace(/\$\{PLUGIN_ROOT\}/g, PLUG_ROOT),
              timeout: hook.timeout || 10,
            });
          }
        }
      }
    }
  }
  return hooks;
}

function classifyEvent(event) {
  if (event === "SessionStart") return "session-once";
  if (event === "UserPromptSubmit") return "prompt-routing";
  if (event === "PreToolUse") return "hot-path-guard";
  if (event === "PostToolUse") return "capture";
  if (event === "Stop" || event === "SubagentStop") return "gate";
  if (event === "PostCompact") return "recovery";
  return "other";
}

function fixturePayload(event) {
  const base = {
    hook_event_name: event,
    session_id: "bench-session-" + Math.random().toString(36).slice(2, 8),
    cwd: "/tmp/bench-cwd",
  };
  switch (event) {
    case "SessionStart": return JSON.stringify(base);
    case "UserPromptSubmit": return JSON.stringify({ ...base, prompt: "fix the bug" });
    case "PreToolUse": return JSON.stringify({ ...base, tool_name: "exec_command", tool_input: { cmd: "git status" } });
    case "PostToolUse": return JSON.stringify({ ...base, tool_name: "exec_command", tool_output: "nothing" });
    case "Stop": case "SubagentStop": return JSON.stringify({ ...base, context: "test" });
    case "PostCompact": return JSON.stringify(base);
    default: return JSON.stringify(base);
  }
}

function invokeHook(command, payload, tmpHome) {
  const parts = command.replace(/^node\s+/, "").match(/(".*?"|'.*?'|\S+)/g) || [];
  const cleanParts = parts.map(p => p.replace(/^["']|["']$/g, ""));
  const start = performance.now();
  const result = spawnSync("node", cleanParts, {
    input: payload,
    timeout: 15000,
    env: { ...process.env, HOME: tmpHome, CODEX_HOME: join(tmpHome, ".codex"), CODEX_SQLITE_HOME: join(tmpHome, ".codex") },
    cwd: "/tmp",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 1024 * 1024,
  });
  const elapsed = performance.now() - start;
  const stdout = (result.stdout || "").toString().trim();
  const isNoOp = stdout === "" || stdout === "{}";
  return { elapsed, exitCode: result.status, isNoOp };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

const args = process.argv.slice(2);
const jsonMode = args.includes("--json");
const iterIdx = args.indexOf("--iterations");
const iterations = iterIdx >= 0 ? parseInt(args[iterIdx + 1], 10) || 5 : 5;

const hooks = loadHooks();

if (!jsonMode) {
  console.log("Hook Benchmark Harness (issue #13)");
  console.log("Hooks: " + hooks.length + ", Iterations: " + iterations);
  console.log("---");
}

const tmpHome = mkdtempSync(join(tmpdir(), "cxc-bench-"));
mkdirSync(join(tmpHome, ".codex"), { recursive: true });

const results = [];

for (const hook of hooks) {
  const category = classifyEvent(hook.event);
  const timings = [];
  let noOps = 0;
  let errors = 0;

  for (let i = 0; i < iterations; i++) {
    const payload = fixturePayload(hook.event);
    try {
      const r = invokeHook(hook.command, payload, tmpHome);
      timings.push(r.elapsed);
      if (r.isNoOp) noOps++;
      if (r.exitCode !== 0) errors++;
    } catch { errors++; }
  }

  timings.sort((a, b) => a - b);
  results.push({
    name: hook.name,
    event: hook.event,
    category,
    invocations: iterations,
    noOpCount: noOps,
    noOpRate: (noOps / iterations * 100).toFixed(1) + "%",
    errorCount: errors,
    p50: percentile(timings, 50).toFixed(1) + "ms",
    p95: percentile(timings, 95).toFixed(1) + "ms",
    p99: percentile(timings, 99).toFixed(1) + "ms",
    max: (timings.length ? timings[timings.length - 1] : 0).toFixed(1) + "ms",
  });

  if (!jsonMode) {
    const r = results[results.length - 1];
    console.log(r.name + " [" + r.event + "] (" + category + ")");
    console.log("  no-op: " + r.noOpRate + " | p50: " + r.p50 + " | p95: " + r.p95 + " | max: " + r.max);
  }
}

rmSync(tmpHome, { recursive: true, force: true });

if (jsonMode) {
  console.log(JSON.stringify({ schemaVersion: 1, timestamp: new Date().toISOString(), iterations, hooks: results }, null, 2));
}

if (!jsonMode) {
  console.log("---");
  console.log("Summary by category:");
  const categories = {};
  for (const r of results) {
    if (!categories[r.category]) categories[r.category] = [];
    categories[r.category].push(r);
  }
  for (const [cat, entries] of Object.entries(categories)) {
    console.log("  " + cat + ": " + entries.length + " hooks");
  }
}
