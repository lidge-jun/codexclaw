/**
 * gh-launch.test.ts - wp06 / 050 section 4: a gh LAUNCH failure and a gh AUTH
 * failure must be distinguishable.
 *
 * The old code collapsed both into "gh CLI missing or not authenticated", so a
 * user with no gh installed and a user with an expired token read the same line
 * and could not tell which fix applied.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { spawnSync } from "node:child_process";
import { ghSearch } from "../src/cli.ts";
import { commandInvocation } from "../src/win-exec.ts";

function captureStderr(t: { after: (fn: () => void) => void }): { err: () => string } {
  let buf = "";
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array) => {
    buf += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  t.after(() => {
    process.stderr.write = orig;
  });
  return { err: () => buf };
}

/** A spawnSync stand-in returning a fixed result, recording the argv it saw. */
function stubRunner(result: Record<string, unknown>, seen: unknown[][] = []) {
  const fn = ((file: string, args: string[]) => {
    seen.push([file, args]);
    return result;
  }) as unknown as typeof spawnSync;
  return { fn, seen };
}

test("a launch ENOENT reports an install hint, not an auth hint", (t) => {
  const cap = captureStderr(t);
  const { fn } = stubRunner({ error: { code: "ENOENT", message: "spawn gh ENOENT" }, status: null });
  const rows = ghSearch("telegram", 5, fn);
  assert.deepEqual(rows, []);
  assert.match(cap.err(), /not on PATH/);
  assert.doesNotMatch(cap.err(), /authenticated/);
  assert.doesNotMatch(cap.err(), /gh auth status/);
});

test("a non-ENOENT launch failure names the underlying spawn error", (t) => {
  const cap = captureStderr(t);
  const { fn } = stubRunner({ error: { code: "EACCES", message: "spawn gh EACCES" }, status: null });
  assert.deepEqual(ghSearch("telegram", 5, fn), []);
  assert.match(cap.err(), /could not be launched: spawn gh EACCES/);
  assert.doesNotMatch(cap.err(), /not on PATH/);
});

test("a non-zero exit reports the auth hint, not an install hint", (t) => {
  const cap = captureStderr(t);
  const { fn } = stubRunner({ status: 4, stdout: "", stderr: "auth required" });
  assert.deepEqual(ghSearch("telegram", 5, fn), []);
  assert.match(cap.err(), /auth required/);
  assert.doesNotMatch(cap.err(), /not on PATH/);
});

test("an empty stderr on a non-zero exit still points at gh auth status", (t) => {
  const cap = captureStderr(t);
  const { fn } = stubRunner({ status: 1, stdout: "", stderr: "" });
  assert.deepEqual(ghSearch("telegram", 5, fn), []);
  assert.match(cap.err(), /gh exited 1/);
  assert.match(cap.err(), /gh auth status/);
});

test("a successful gh run still parses rows and keeps forward-slash API paths", (t) => {
  captureStderr(t);
  const payload = JSON.stringify([
    { repository: { nameWithOwner: "owner/repo" }, path: "skills/telegram-send/SKILL.md" },
  ]);
  const { fn, seen } = stubRunner({ status: 0, stdout: payload, stderr: "" });
  const rows = ghSearch("telegram", 5, fn);
  assert.equal(rows.length, 1);
  // 002 B17: GitHub API paths are always forward-slash; path.sep would break them.
  assert.equal(rows[0].id, "telegram-send");
  assert.equal(rows[0].source, "gh");
  // The query reaches gh through the resolver, never as a bare shelled string.
  const [, args] = seen[0] as [string, string[]];
  assert.ok(args.join(" ").includes("filename:SKILL.md telegram"));
});

test("SHARED-HELPER-01: this package's win-exec copy is the same contract", () => {
  const inv = commandInvocation("gh", ["auth", "status"], "linux", {});
  assert.equal(inv.file, "gh");
  assert.deepEqual(inv.args, ["auth", "status"]);
  assert.deepEqual(inv.options, {});
});

