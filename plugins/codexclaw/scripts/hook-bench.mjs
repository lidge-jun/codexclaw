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
import { tmpdir, release } from "node:os";

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

export function fixturePayload(event, benchCwd) {
  const base = {
    hook_event_name: event,
    session_id: "bench-session-" + Math.random().toString(36).slice(2, 8),
    cwd: benchCwd,
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

export function benchEnv(tmpHome) {
  return {
    ...process.env,
    HOME: tmpHome,
    // Windows resolves the home from USERPROFILE, so HOME alone left the hook
    // reading the REAL user home during a benchmark meant to be hermetic.
    USERPROFILE: tmpHome,
    CODEX_HOME: join(tmpHome, ".codex"),
    CODEX_SQLITE_HOME: join(tmpHome, ".codex"),
  };
}

function invokeHook(command, payload, tmpHome, benchCwd) {
  const parts = command.replace(/^node\s+/, "").match(/(".*?"|'.*?'|\S+)/g) || [];
  const cleanParts = parts.map(p => p.replace(/^["']|["']$/g, ""));
  const start = performance.now();
  const result = spawnSync("node", cleanParts, {
    input: payload,
    timeout: 15000,
    env: benchEnv(tmpHome),
    // /tmp does not exist on Windows, and spawnSync throws ENOENT on a missing
    // cwd, so the bench failed outright there (002 B8). Line 114 of this same
    // file already had the right idiom: mkdtempSync(join(tmpdir(), ...)).
    cwd: benchCwd,
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 1024 * 1024,
  });
  const elapsed = performance.now() - start;
  const stdout = (result.stdout || "").toString().trim();
  const isNoOp = stdout === "" || stdout === "{}";
  return { elapsed, exitCode: result.status, isNoOp };
}

export function percentile(sorted, p) {
  // null rather than 0 for an empty sample: a single-iteration run has no warm
  // observations at all, and reporting 0ms would read as "instant" instead of
  // "not measured".
  if (!sorted || sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function fmtMs(value) {
  return (value == null ? 0 : value).toFixed(1) + "ms";
}

/**
 * Cost of spawning node at all, with no codexclaw code loaded.
 *
 * Subtracting this separates "the hook is slow" from "this OS makes process
 * creation slow", which are different problems with different fixes. Windows
 * has no fork(), so CreateProcess + PE loading + Defender's filter driver all
 * land in this number.
 */
export function measureSpawnFloor(iterations) {
  const timings = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    spawnSync(process.execPath, ["-e", ""], { stdio: "ignore", timeout: 15000 });
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  return { p50: percentile(timings, 50), p95: percentile(timings, 95), samples: timings.length };
}

/**
 * Split one hook's raw timings into a cold first touch and warm percentiles.
 *
 * Cold vs warm matters more on Windows than anywhere else: Defender's
 * first-touch scan of a JS file is a one-time cost that would otherwise be
 * averaged into every number and blamed on the hook.
 */
export function summarizeTimings(timings, spawnFloorP50) {
  const cold = timings.length > 0 ? timings[0] : null;
  const warm = timings.slice(1).sort((a, b) => a - b);
  const warmP50 = percentile(warm, 50);
  const warmP95 = percentile(warm, 95);
  return {
    coldMs: cold,
    warmP50Ms: warmP50,
    warmP95Ms: warmP95,
    // Deliberately unclamped: a hook faster than the measured floor means the
    // floor sample was noisy, and Math.max(0, ...) would disguise an unreliable
    // measurement as a good result.
    aboveFloorMs: warmP50 == null || spawnFloorP50 == null ? null : warmP50 - spawnFloorP50,
  };
}

// Guarded so a test can import fixturePayload/benchEnv without running the bench.
function main() {
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
  const benchCwd = mkdtempSync(join(tmpdir(), "cxc-bench-cwd-"));

  const spawnFloor = measureSpawnFloor(iterations);
  if (!jsonMode) {
    console.log("spawn floor: p50 " + fmtMs(spawnFloor.p50) + " | p95 " + fmtMs(spawnFloor.p95));
    console.log("---");
  }

  const results = [];

  for (const hook of hooks) {
    const category = classifyEvent(hook.event);
    const timings = [];
    let noOps = 0;
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      const payload = fixturePayload(hook.event, benchCwd);
      try {
        const r = invokeHook(hook.command, payload, tmpHome, benchCwd);
        timings.push(r.elapsed);
        if (r.isNoOp) noOps++;
        if (r.exitCode !== 0) errors++;
      } catch { errors++; }
    }

    // Summarize BEFORE sorting: the cold/warm split needs invocation order.
    const warm = summarizeTimings(timings, spawnFloor.p50);
    timings.sort((a, b) => a - b);
    results.push({
      name: hook.name,
      event: hook.event,
      category,
      command: hook.command,
      invocations: iterations,
      noOpCount: noOps,
      noOpRate: (noOps / iterations * 100).toFixed(1) + "%",
      noOpRatio: iterations > 0 ? noOps / iterations : 0,
      errorCount: errors,
      p50: fmtMs(percentile(timings, 50)),
      p95: fmtMs(percentile(timings, 95)),
      p99: fmtMs(percentile(timings, 99)),
      max: (timings.length ? timings[timings.length - 1] : 0).toFixed(1) + "ms",
      coldMs: warm.coldMs,
      warmP50Ms: warm.warmP50Ms,
      warmP95Ms: warm.warmP95Ms,
      aboveFloorMs: warm.aboveFloorMs,
    });

    if (!jsonMode) {
      const r = results[results.length - 1];
      console.log(r.name + " [" + r.event + "] (" + category + ")");
      console.log("  no-op: " + r.noOpRate + " | p50: " + r.p50 + " | p95: " + r.p95 + " | max: " + r.max);
      console.log("  cold: " + fmtMs(r.coldMs) + " | warm p50: " + fmtMs(r.warmP50Ms) + " | above floor: " + fmtMs(r.aboveFloorMs));
    }
  }

  rmSync(tmpHome, { recursive: true, force: true });
  rmSync(benchCwd, { recursive: true, force: true });

  if (jsonMode) {
    console.log(JSON.stringify({
      schemaVersion: 1,
      timestamp: new Date().toISOString(),
      platform: process.platform,
      release: release(),
      nodeVersion: process.version,
      iterations,
      spawnFloorMs: spawnFloor,
      hooks: results,
    }, null, 2));
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
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
