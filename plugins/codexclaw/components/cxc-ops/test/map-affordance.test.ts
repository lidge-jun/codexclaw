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
import { fileURLToPath } from "node:url";
import { supportsSymlinks, symlinkDirSync } from "../test-support/symlink-support.ts";

import {
  countSourceFiles,
  renderMapAffordance,
  renderKwriteAffordance,
  renderLoopAffordance,
  renderSessionBinding,
  renderSkillSearchAffordance,
  runMapAffordanceSessionStart,
  runPostCompactAffordance,
  MAP_AFFORDANCE_MIN_FILES,
  resolveCxcCommands,
} from "../src/map-affordance.ts";
import { cxcInvocation } from "../src/cxc-resolve.ts";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..", "..", "..");

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "cxc-map-affordance-"));
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

test("size gate: below threshold -> no map line (skill line only), at threshold -> map line", () => {
  const small = tmp();
  seedSources(small, MAP_AFFORDANCE_MIN_FILES - 1);
  const smallOut = runMapAffordanceSessionStart("", small);
  assert.notEqual(smallOut, "", "skill-search affordance is always on");
  const smallEnv = JSON.parse(smallOut);
  assert.doesNotMatch(smallEnv.hookSpecificOutput.additionalContext, /cxc map/);
  assert.match(smallEnv.hookSpecificOutput.additionalContext, /cxc skill search/);
  assert.match(smallEnv.hookSpecificOutput.additionalContext, /User questions:/);

  const big = tmp();
  seedSources(big, MAP_AFFORDANCE_MIN_FILES);
  const out = runMapAffordanceSessionStart("", big);
  assert.notEqual(out, "");
  const env = JSON.parse(out);
  assert.equal(env.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(env.hookSpecificOutput.additionalContext, /cxc map/);
  assert.match(env.hookSpecificOutput.additionalContext, /cxc skill search/);
});

test("affordance is a POINTER, not the map body (no preload)", () => {
  const text = renderMapAffordance(120);
  assert.match(text, /on demand/);
  assert.match(text, /stateless one-shot/);
  // must not embed a map / rank listing — a pointer stays short and generic.
  assert.doesNotMatch(text, /Rank value|:\d+:/);
  assert.ok(text.length < 600, "affordance must stay a one-liner-ish pointer");
});

test("skill-search affordance is a POINTER: names both commands, stays short", () => {
  const text = renderSkillSearchAffordance();
  assert.match(text, /cxc skill search/);
  assert.match(text, /cxc skill show/);
  assert.match(text, /cxc-dev/, "must state that built-in discipline wins on conflict");
  assert.ok(text.length < 600, "affordance must stay a one-liner-ish pointer");
});

test("kwrite affordance: always on, genre-free pointer to $cxc-kwrite", () => {
  const text = renderKwriteAffordance();
  assert.match(text, /cxc-kwrite/);
  assert.match(text, /윤문/);
  // universal guidance only — no platform/genre routing in the hook line
  assert.doesNotMatch(text, /thread|쓰레드|SNS|블로그|DC/i);
  assert.ok(text.length < 600, "affordance must stay a one-liner-ish pointer");
  // rides every SessionStart envelope regardless of repo size
  const small = tmp();
  const out = runMapAffordanceSessionStart("", small);
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /cxc-kwrite/);
});

test("critical loop and stack guidance survives SessionStart and PostCompact without intent triggers", () => {
  const text = renderLoopAffordance();
  assert.match(text, /Loop contract:/);
  assert.match(text, /cxc orchestrate status/);
  assert.match(text, /one full PABCD cycle/i);
  assert.match(text, /cxc-loop/);
  assert.match(text, /Bare cxc-loop means scoped HOTL/);
  assert.match(text, /Exact user limits and separately allowed actions/);
  assert.match(text, /No extra external permissions/);
  assert.ok(text.length < 600, "affordance must stay a one-liner-ish pointer");
  // rides every SessionStart envelope regardless of repo size
  const small = tmp();
  const out = runMapAffordanceSessionStart("", small);
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /Loop contract:/);
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /Bare cxc-loop means scoped HOTL/);
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /Exact user limits and separately allowed actions/);
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /No extra external permissions/);
});

test("wp3: SessionStart and PostCompact both emit the same scoped loop pointer", () => {
  const cwd = tmp();
  try {
    const outputs = [
      ["SessionStart", runMapAffordanceSessionStart(JSON.stringify({ cwd, session_id: "wp3-child" }), cwd)],
      ["PostCompact", runPostCompactAffordance()],
    ] as const;
    for (const [event, out] of outputs) {
      const envelope = JSON.parse(out).hookSpecificOutput;
      assert.equal(envelope.hookEventName, event);
      const ctx = envelope.additionalContext as string;
      const pointer = ctx.split("\n\n").find(line => line.startsWith("[codexclaw] Loop contract:"));
      assert.ok(pointer);
      assert.match(pointer, /Bare cxc-loop means scoped HOTL; a mention alone grants no authority/);
      assert.match(pointer, /Exact user limits and separately allowed actions scope this pointer and its owners/);
      assert.match(pointer, /No-delegation means no dispatch/);
      assert.match(pointer, /Read-only inspection remains allowed under no-goal\/no-FSM/);
      assert.match(pointer, /No-tests does not forbid an explicitly allowed build/);
      assert.match(pointer, /One work-phase = one full PABCD cycle/);
      assert.match(pointer, /No extra external permissions/);
      assert.ok(pointer.length < 600);
      const questions = ctx.split("\n\n").filter(line => line.startsWith("[codexclaw] User questions:"));
      assert.equal(questions.length, 1, `${event} must surface the question policy exactly once`);
      assert.match(questions[0], /including active goals/);
      assert.match(questions[0], /Outside Interview.*request_user_input_async/);
      assert.match(questions[0], /do not expect replies or wait/);
      assert.match(questions[0], /Continue authorized work/);
      assert.match(questions[0], /Interview uses `request_user_input` only/);
      assert.match(questions[0], /Subagents send question candidates to main/);
      assert.match(questions[0], /exposed.*host-allowed/);
      assert.match(questions[0], /silence grants no approval/);
      assert.ok(questions[0].length < 800, "question policy stays a compact pointer");
      assert.equal(existsSync(join(cwd, ".codexclaw")), false, "guidance must not start a phase or goal");
      if (event === "SessionStart") {
        assert.match(ctx, /This session's id is `wp3-child`/);
        assert.match(ctx, /--session wp3-child/);
        assert.match(ctx, /MOST RECENT SessionStart binding line/);
      } else assert.doesNotMatch(ctx, /This session's id/);
    }
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("wp3: SessionStart preserves the complete binding literal for each session", () => {
  for (const id of ["parent-session", "child-session"]) {
    const expected = [
      `[codexclaw] This session's id is \`${id}\`. Every mutating`,
      "`cxc orchestrate` command (I/P/A/B/C/D/reset) MUST pass",
      `\`--session ${id}\` — the implicit latest-session fallback is`,
      "disabled for writes, which prevents ACCIDENTAL implicit-fallback",
      "collisions between concurrent/forked sessions.",
      "IDENTITY RULE: use the MOST RECENT SessionStart binding line in your",
      "current context as the only source of your session id — older binding",
      "lines or other ids in transcript/history belong to prior/parent sessions;",
      "never pass those to a mutating command.",
    ].join(" ");
    const cwd = tmp();
    try {
      const out = runMapAffordanceSessionStart(JSON.stringify({ cwd, session_id: id }), cwd);
      const ctx = JSON.parse(out).hookSpecificOutput.additionalContext as string;
      assert.equal(renderSessionBinding(id), expected);
      assert.equal(ctx.split("\n\n")[0], expected);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
});

test("G3: session-id binding line rides the SessionStart envelope", () => {
  const small = tmp();
  const out = runMapAffordanceSessionStart(
    JSON.stringify({ hook_event_name: "SessionStart", cwd: small, session_id: "abc-123" }),
    small,
  );
  const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
  assert.match(ctx, /session's id is `abc-123`/);
  assert.match(ctx, /--session abc-123/);
  // no session_id on stdin -> no binding line, envelope still valid
  const noId = runMapAffordanceSessionStart(JSON.stringify({ cwd: small }), small);
  assert.doesNotMatch(JSON.parse(noId).hookSpecificOutput.additionalContext, /session's id/);
  // direct render stays bounded and carries the fork identity rule
  const binding = renderSessionBinding("x".repeat(40));
  assert.ok(binding.length < 800);
  assert.match(binding, /IDENTITY RULE/);
  assert.match(binding, /MOST RECENT SessionStart binding line/);
  assert.match(binding, /prevents ACCIDENTAL implicit-fallback/, "must not overclaim (explicit replay remains)");
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
  assert.match(JSON.parse(viaFallback).hookSpecificOutput.additionalContext, /DEV-STACK-06\/07/);
  // empty stdin + small fallback -> no map line, skill line still present, no throw
  const smallOut = runMapAffordanceSessionStart("", empty);
  assert.doesNotMatch(JSON.parse(smallOut).hookSpecificOutput.additionalContext, /cxc map/);
});

test("stack guidance survives SessionStart and PostCompact without a DevOps trigger", () => {
  const cwd = tmp();
  try {
    const out = runMapAffordanceSessionStart(JSON.stringify({ cwd }), cwd);
    for (const [event, raw] of [["SessionStart", out], ["PostCompact", runPostCompactAffordance()]]) {
      const envelope = JSON.parse(raw);
      assert.equal(envelope.hookSpecificOutput.hookEventName, event);
      const ctx = envelope.hookSpecificOutput.additionalContext;
      const stackLine = ctx.split("\n").find((line: string) => line.includes("DEV-STACK-06/07"));
      assert.ok(stackLine, `${event} must expose stack guidance even in an empty non-Git repo`);
      assert.match(stackLine, /cxc-dev.*references\/stacked-prs\.md/);
      assert.match(stackLine, /even without a DevOps trigger/);
      assert.match(stackLine, /not native stack registration/);
      assert.match(stackLine, /Per-PR CI is expected/);
      assert.match(stackLine, /Publish GitHub stacks natively; verify registration/);
      assert.match(stackLine, /not authorization/);
      assert.ok(stackLine.length < 600, "global guidance must remain a bounded pointer");
      assert.deepEqual(Object.keys(envelope), ["hookSpecificOutput"]);
      assert.deepEqual(Object.keys(envelope.hookSpecificOutput).sort(), ["additionalContext", "hookEventName"]);
    }
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("hook JSON wires SessionStart to the cxc-ops dist entry", () => {
  const hookPath = join(pluginRoot, "hooks", "session-start-announcing-map-affordance.json");
  assert.ok(existsSync(hookPath), "hook JSON must exist");
  const hook = JSON.parse(readFileSync(hookPath, "utf8"));
  const cmd = hook.hooks.SessionStart[0].hooks[0].command;
  assert.match(cmd, /components\/cxc-ops\/dist\/cli\.js" hook session-start/);
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
  assert.match(JSON.parse(res.stdout).hookSpecificOutput.additionalContext, /DEV-STACK-06\/07/);
  assert.match(JSON.parse(res.stdout).hookSpecificOutput.additionalContext, /User questions:.*request_user_input_async/);
  const compact = spawnSync(process.execPath, [link, "hook", "post-compact"], { encoding: "utf8" });
  assert.equal(compact.status, 0, compact.stderr);
  const compactEnvelope = JSON.parse(compact.stdout).hookSpecificOutput;
  assert.equal(compactEnvelope.hookEventName, "PostCompact");
  assert.match(compactEnvelope.additionalContext, /DEV-STACK-06\/07/);
  assert.match(compactEnvelope.additionalContext, /User questions:.*request_user_input_async/);
});
