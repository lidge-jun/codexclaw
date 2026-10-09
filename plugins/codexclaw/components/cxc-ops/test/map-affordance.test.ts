/**
 * map-affordance.test.ts — SessionStart `cxc map` discoverability injector.
 *
 * Verifies: (1) the size gate (silent below threshold, affordance at/above);
 * (2) the affordance names `cxc map` and stays a POINTER (no map body / no
 * whole-repo preload); (3) cwd comes from the stdin payload, falling back safely;
 * (4) malformed/empty stdin never throws; (5) the SessionStart hook JSON is wired
 * to the cxc-ops dist entry.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// Pin the cxc-resolve seam (B1): these tests assert literal `cxc ...` command
// mentions, which would otherwise depend on whether the runner's PATH has cxc.
process.env.CODEXCLAW_CXC = "cxc";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { supportsSymlinks, symlinkDirSync } from "../test-support/symlink-support.ts";

import {
  countSourceFiles,
  renderMapAffordance,
  renderSessionBinding,
  runMapAffordanceSessionStart,
  runPostCompactAffordance,
  runUserPromptAffordance,
  MAP_AFFORDANCE_MIN_FILES,
  resolveCxcCommands,
} from "../src/map-affordance.ts";
import { cxcInvocation } from "../src/cxc-resolve.ts";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..", "..", "..");

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "cxc-map-affordance-"));
}

function afterCompact(cwd: string): string {
  const raw = { cwd, session_id: "root", hook_event_name: "PostCompact" };
  assert.equal(runPostCompactAffordance(JSON.stringify(raw)), "");
  return runUserPromptAffordance(JSON.stringify({ ...raw, hook_event_name: "UserPromptSubmit" }));
}

function seedSources(root: string, n: number): void {
  mkdirSync(join(root, "src"), { recursive: true });
  for (let i = 0; i < n; i += 1) {
    writeFileSync(join(root, "src", `f${i}.ts`), `export const x${i} = ${i};\n`);
  }
}

test("count skips vendored/build dirs and hidden dirs", () => {
  const root = tmp();
  seedSources(root, 5);
  for (const skip of ["node_modules", "dist", ".git", "target"]) {
    mkdirSync(join(root, skip), { recursive: true });
    writeFileSync(join(root, skip, "junk.ts"), "export const junk = 1;\n");
  }
  assert.equal(countSourceFiles(root), 5);
});

test("size gate: below threshold has no map; at threshold has map", () => {
  const small = tmp();
  seedSources(small, MAP_AFFORDANCE_MIN_FILES - 1);
  const smallOut = runMapAffordanceSessionStart("", small);
  assert.notEqual(smallOut, "", "owner pointers are always on");
  const smallCtx = JSON.parse(smallOut).hookSpecificOutput.additionalContext;
  assert.doesNotMatch(smallCtx, /cxc map/);
  assert.match(smallCtx, /User questions:/);
  assert.match(smallCtx, /\$codexclaw:cxc-dev async-questions\.md/);

  const big = tmp();
  seedSources(big, MAP_AFFORDANCE_MIN_FILES);
  const env = JSON.parse(runMapAffordanceSessionStart("", big));
  assert.equal(env.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(env.hookSpecificOutput.additionalContext, /40 source files/);
  assert.match(env.hookSpecificOutput.additionalContext, /cxc map <dir>/);
  assert.match(env.hookSpecificOutput.additionalContext, /\$codexclaw:cxc-repo-map/);
});

test("map pointer keeps count facts and has no map body", () => {
  for (const [count, fact] of [[40, "40"], [120, "60+"]] as const) {
    const text = renderMapAffordance(count);
    assert.ok(text.includes(`${fact} source files`));
    assert.match(text, /cxc map <dir>/);
    assert.match(text, /\$codexclaw:cxc-repo-map/);
    assert.doesNotMatch(text, /Rank value|:\d+:/);
    assert.ok(Buffer.byteLength(text) <= 150);
  }
});

test("SessionStart and compact recovery carry bounded owner pointers, without removed tutorials", () => {
  const cwd = tmp();
  try {
    seedSources(cwd, MAP_AFFORDANCE_MIN_FILES);
    const outputs = [
      ["SessionStart", runMapAffordanceSessionStart(JSON.stringify({ cwd, session_id: "12345678-1234-1234-1234-123456789abc" }), cwd)],
      ["UserPromptSubmit", afterCompact(cwd)],
    ] as const;
    for (const [event, out] of outputs) {
      const envelope = JSON.parse(out);
      assert.deepEqual(Object.keys(envelope), ["hookSpecificOutput"]);
      assert.deepEqual(Object.keys(envelope.hookSpecificOutput).sort(), ["additionalContext", "hookEventName"]);
      assert.equal(envelope.hookSpecificOutput.hookEventName, event);
      const ctx = envelope.hookSpecificOutput.additionalContext as string;
      const lines = ctx.split("\n\n");
      const loop = lines.filter(line => line.startsWith("[codexclaw] Loop contract:"));
      assert.equal(loop.length, 1);
      assert.match(loop[0], /\$codexclaw:cxc-loop/);
      assert.match(loop[0], /\$codexclaw:cxc-pabcd/);
      assert.match(loop[0], /User limits/);
      assert.match(loop[0], /no authority/);
      const questions = lines.filter(line => line.startsWith("[codexclaw] User questions:"));
      assert.equal(questions.length, 1);
      assert.match(questions[0], /request_user_input_async/);
      assert.match(questions[0], /when exposed/);
      assert.match(questions[0], /silence.*not approval/);
      assert.match(questions[0], /\$codexclaw:cxc-dev async-questions\.md/);
      const terminal = lines.filter(line => line.startsWith("[codexclaw] Long commands:"));
      assert.equal(terminal.length, 1);
      for (const fact of ["exec_command", "yield_time_ms", "session_id", "write_stdin"]) {
        assert.ok(terminal[0].includes(fact));
      }
      assert.match(terminal[0], /\$codexclaw:cxc-dev native-execution\.md/);
      assert.doesNotMatch(ctx, /External skill catalogs|cxc skill search|cxc-kwrite|Korean prose|DEV-STACK-06|stacked-prs\.md|native stacks/);
      for (const line of lines) assert.ok(line.length <= 400);
      assert.ok(Buffer.byteLength(ctx) <= (event === "SessionStart" ? 900 : 500));
      assert.equal(existsSync(join(cwd, ".codexclaw", "sessions")), false, "guidance must not start a phase");
      assert.equal(existsSync(join(cwd, ".codexclaw", "goalplans")), false, "guidance must not start a goal");
      if (event === "SessionStart") {
        assert.match(ctx, /Session `12345678-1234-1234-1234-123456789abc`/);
        assert.match(ctx, /--session 12345678-1234-1234-1234-123456789abc/);
      } else assert.doesNotMatch(ctx, /\[codexclaw\] Session /);
    }
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("binding carries each session's current identity and command facts", () => {
  for (const id of ["parent-session", "child-session"]) {
    const cwd = tmp();
    try {
      const out = runMapAffordanceSessionStart(JSON.stringify({ cwd, session_id: id }), cwd);
      const ctx = JSON.parse(out).hookSpecificOutput.additionalContext as string;
      const binding = ctx.split("\n\n")[0];
      assert.ok(binding.startsWith(`[codexclaw] Session \`${id}\`.`));
      assert.ok(binding.includes(`--session ${id}`));
      assert.match(binding, /cxc orchestrate/);
      assert.match(binding, /cxc loop/);
      assert.match(binding, /cxc session current/);
      assert.match(binding, /Never use parent\/history ids/);
      assert.match(binding, /\$codexclaw:cxc-pabcd phase-control\.md/);
      assert.ok(Buffer.byteLength(binding) <= 400);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
});

test("G3: session binding rides SessionStart only when an id is supplied", () => {
  const small = tmp();
  const out = runMapAffordanceSessionStart(
    JSON.stringify({ hook_event_name: "SessionStart", cwd: small, session_id: "abc-123" }), small,
  );
  const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
  assert.match(ctx, /Session `abc-123`/);
  assert.match(ctx, /--session abc-123/);
  const noId = runMapAffordanceSessionStart(JSON.stringify({ cwd: small }), small);
  assert.doesNotMatch(JSON.parse(noId).hookSpecificOutput.additionalContext, /\[codexclaw\] Session /);
  const binding = renderSessionBinding("x".repeat(40));
  assert.ok(Buffer.byteLength(binding) <= 400);
  assert.match(binding, /phase-control\.md/);
});

test("cwd is read from the stdin payload; malformed stdin falls back safely", () => {
  const big = tmp();
  seedSources(big, MAP_AFFORDANCE_MIN_FILES + 2);
  // stdin carries the real cwd; fallback is an unrelated empty dir
  const empty = tmp();
  const viaStdin = runMapAffordanceSessionStart(
    JSON.stringify({ hook_event_name: "SessionStart", cwd: big }),
    empty,
  );
  assert.match(
    JSON.parse(viaStdin).hookSpecificOutput.additionalContext,
    /cxc map/,
    "cwd from stdin should clear the map gate",
  );

  // malformed stdin -> uses fallback cwd (the big repo) -> still fires, no throw
  const viaFallback = runMapAffordanceSessionStart("{not json", big);
  assert.match(JSON.parse(viaFallback).hookSpecificOutput.additionalContext, /cxc map/);
  assert.match(JSON.parse(viaFallback).hookSpecificOutput.additionalContext, /\$codexclaw:cxc-loop/);
  // empty stdin + small fallback -> no map line, other pointers remain, no throw
  const smallOut = runMapAffordanceSessionStart("", empty);
  assert.doesNotMatch(JSON.parse(smallOut).hookSpecificOutput.additionalContext, /cxc map/);
});

test("hook JSON wires SessionStart to the cxc-ops dist entry", () => {
  const hookPath = join(pluginRoot, "hooks", "session-start-announcing-map-affordance.json");
  assert.ok(existsSync(hookPath), "hook JSON must exist");
  const hook = JSON.parse(readFileSync(hookPath, "utf8"));
  const cmd = hook.hooks.SessionStart[0].hooks[0].command;
  assert.match(cmd, /components\/cxc-ops\/dist\/cli\.js" hook session-start/);
});

test("non-default invocation is emitted as a current command fact", () => {
  const cwd = tmp();
  const previous = process.env.CODEXCLAW_CXC;
  try {
    process.env.CODEXCLAW_CXC = "chosen-cxc";
    const ctx = JSON.parse(runMapAffordanceSessionStart(JSON.stringify({ cwd, session_id: "current" }), cwd))
      .hookSpecificOutput.additionalContext as string;
    assert.ok(ctx.includes("[codexclaw] cxc invocation: chosen-cxc"));
    assert.match(ctx, /chosen-cxc session current/);
    assert.match(ctx, /chosen-cxc orchestrate/);
    assert.match(ctx, /chosen-cxc loop/);
    assert.ok(Buffer.byteLength(ctx) <= 900);
    process.env.CODEXCLAW_CXC = "cxc";
    assert.doesNotMatch(JSON.parse(runMapAffordanceSessionStart("", cwd)).hookSpecificOutput.additionalContext, /cxc invocation:/);
  } finally {
    if (previous === undefined) delete process.env.CODEXCLAW_CXC;
    else process.env.CODEXCLAW_CXC = previous;
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("degraded mode: no CODEXCLAW_CXC + cxc-free PATH falls back to the payload bin; rewrite is backtick-anchored only", () => {
  // Injected env: seam unset, PATH has no cxc — the ladder must land on the
  // payload dispatcher (fresh marketplace install simulation).
  const env = { PATH: "/usr/bin:/bin" };
  const invocation = cxcInvocation(import.meta.url, env);
  assert.match(invocation, /bin[\\/]cxc\.mjs/, "fallback must name the payload dispatcher");
  assert.match(invocation, /^node "/, "fallback must be runnable via node");

  // Command mentions resolve...
  const rewritten = resolveCxcCommands("run `cxc map src` now", env);
  assert.ok(rewritten.includes(`\`${invocation} map src\``), "backticked command must resolve");

  const staleBin = tmp();
  try {
    writeFileSync(join(staleBin, "cxc"), "stale repository CLI");
    const staleEnv = { PATH: staleBin };
    const owned = cxcInvocation(import.meta.url, staleEnv, "session");
    assert.match(owned, /bin[\\/]cxc\.mjs/);
    assert.equal(cxcInvocation(import.meta.url, staleEnv, "map"), "cxc");
    assert.equal(cxcInvocation(import.meta.url, staleEnv, "gui"), "cxc");
    assert.equal(cxcInvocation(import.meta.url, { ...staleEnv, CODEXCLAW_CXC: "chosen-cxc" }, "session"), "chosen-cxc");
    const mixed = resolveCxcCommands("`cxc session current` and `cxc map src`", staleEnv);
    assert.equal(mixed, `\`${owned} session current\` and \`cxc map src\``);
    const absent = pathToFileURL(join(staleBin, "absent", "components", "cxc-ops", "src", "cxc-resolve.ts")).href;
    assert.equal(cxcInvocation(absent, staleEnv, "session"), "cxc");
  } finally { rmSync(staleBin, { recursive: true, force: true }); }

  // ...but noun phrases, skill names, and chat commands are byte-identical (H1).
  for (const untouchable of [
    "load $codexclaw:cxc-loop for the discipline",
    "send !cxc start in the channel",
    "the parent owns cxc orchestration and goal state",
  ]) {
    assert.equal(resolveCxcCommands(untouchable, env), untouchable, `must not rewrite: ${untouchable}`);
  }
});

test("direct-exec guard fires through a symlinked install path (plugin-cache regression)", (t) => {
  // The real plugin cache reaches dist/cli.js through a symlinked components/ dir.
  // A resolve()-only guard compares the symlink path against import.meta.url's real
  // path and silently never runs main(). Prove the shipped dist works via a symlink.
  // Linking the containing DIRECTORY mirrors the real cache layout more closely than
  // a leaf file link, and a junction expresses it without elevation on Windows.
  if (!supportsSymlinks().dir) {
    t.skip("directory links unavailable on this host: symlinked install path not exercised");
    return;
  }
  const distCli = join(pluginRoot, "components", "cxc-ops", "dist", "cli.js");
  assert.ok(existsSync(distCli), "dist/cli.js must exist (run the build first)");
  const linkDir = tmp();
  symlinkDirSync(dirname(distCli), join(linkDir, "dist-symlink"));
  const link = join(linkDir, "dist-symlink", "cli.js");
  const big = tmp();
  seedSources(big, MAP_AFFORDANCE_MIN_FILES + 2);
  const res = spawnSync(process.execPath, [link, "hook", "session-start"], {
    input: JSON.stringify({ hook_event_name: "SessionStart", cwd: big }),
    encoding: "utf8",
  });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /additionalContext/, "symlink invocation must emit the envelope");
  assert.match(res.stdout, /cxc map/, "envelope must carry the map pointer");
  assert.doesNotMatch(JSON.parse(res.stdout).hookSpecificOutput.additionalContext, /DEV-STACK-06|stacked-prs\.md/);
  assert.match(JSON.parse(res.stdout).hookSpecificOutput.additionalContext, /\$codexclaw:cxc-dev native-execution\.md/);
  assert.match(JSON.parse(res.stdout).hookSpecificOutput.additionalContext, /User questions:.*request_user_input_async/);
  const compact = spawnSync(process.execPath, [link, "hook", "post-compact"], {
    input: JSON.stringify({ hook_event_name: "PostCompact", cwd: big, session_id: "linked" }), encoding: "utf8" });
  assert.equal(compact.status, 0, compact.stderr);
  assert.equal(compact.stdout, "");
  const prompt = spawnSync(process.execPath, [link, "hook", "user-prompt-submit"], {
    input: JSON.stringify({ hook_event_name: "UserPromptSubmit", cwd: big, session_id: "linked" }), encoding: "utf8" });
  assert.equal(prompt.status, 0, prompt.stderr);
  const compactEnvelope = JSON.parse(prompt.stdout).hookSpecificOutput;
  assert.equal(compactEnvelope.hookEventName, "UserPromptSubmit");
  assert.doesNotMatch(compactEnvelope.additionalContext, /DEV-STACK-06|stacked-prs\.md/);
  assert.match(compactEnvelope.additionalContext, /\$codexclaw:cxc-dev native-execution\.md/);
  assert.ok(Buffer.byteLength(compactEnvelope.additionalContext) <= 500);
  assert.match(compactEnvelope.additionalContext, /User questions:.*request_user_input_async/);
});
