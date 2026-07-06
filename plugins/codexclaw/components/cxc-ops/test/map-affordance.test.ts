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
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  countSourceFiles,
  renderMapAffordance,
  renderSkillSearchAffordance,
  runMapAffordanceSessionStart,
  MAP_AFFORDANCE_MIN_FILES,
} from "../src/map-affordance.ts";

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
  // empty stdin + small fallback -> no map line, skill line still present, no throw
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

test("direct-exec guard fires through a symlinked install path (plugin-cache regression)", () => {
  // The real plugin cache reaches dist/cli.js through a symlinked components/ dir.
  // A resolve()-only guard compares the symlink path against import.meta.url's real
  // path and silently never runs main(). Prove the shipped dist works via a symlink.
  const distCli = join(pluginRoot, "components", "cxc-ops", "dist", "cli.js");
  assert.ok(existsSync(distCli), "dist/cli.js must exist (run the build first)");
  const linkDir = tmp();
  const link = join(linkDir, "cli-symlink.js");
  symlinkSync(distCli, link);
  const big = tmp();
  seedSources(big, MAP_AFFORDANCE_MIN_FILES + 2);
  const res = spawnSync(process.execPath, [link, "hook", "session-start"], {
    input: JSON.stringify({ hook_event_name: "SessionStart", cwd: big }),
    encoding: "utf8",
  });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /additionalContext/, "symlink invocation must emit the envelope");
  assert.match(res.stdout, /cxc map/, "envelope must carry the map pointer");
});
