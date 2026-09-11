/**
 * cli.test.ts — the CLI surface and one real end-to-end run.
 *
 * The unit tests above fabricate records; this file actually spawns a shell, so the
 * "no watcher process" claim is exercised rather than asserted.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { run } from "../src/cli.ts";
import { listRecords, readRecord, selectWake } from "../src/registry.ts";
import { buildShell, buildWindowsHelper } from "../src/spawn.ts";
import { disabledPath } from "../src/store.ts";

function workspace(): string {
  return mkdtempSync(join(tmpdir(), "bgcli-"));
}

async function settle(cwd: string, id: string, tries = 60): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    const rec = listRecords(cwd).find((r) => r.id === id);
    if (rec && rec.status !== "running") return;
    await delay(100);
  }
}

test("a real command runs detached and records its own exit code", async (t) => {
  if (process.platform === "win32") return t.skip("posix shell path");
  const cwd = workspace();
  process.env.CODEX_THREAD_ID = "S1";
  const started = run(["run", "--note", "smoke", "--", "sh", "-c", "echo hello; exit 3"], cwd);
  assert.equal(started.code, 0);
  const id = started.out.trim();
  await settle(cwd, id);
  const rec = readRecord(cwd, id);
  assert.equal(rec?.status, "failed");
  assert.equal(rec?.exitCode, 3);
  const got = run(["get", id, "--tail", "5"], cwd);
  assert.match(got.out, /hello/);
});

test("an argument with spaces and quotes survives the shell", async (t) => {
  if (process.platform === "win32") return t.skip("posix shell path");
  const cwd = workspace();
  process.env.CODEX_THREAD_ID = "S1";
  const id = run(["run", "--", "printf", "%s", "it's a test"], cwd).out.trim();
  await settle(cwd, id);
  assert.match(run(["get", id, "--tail", "5"], cwd).out, /it's a test/);
});

test("run without -- prints usage and fails", () => {
  const cwd = workspace();
  const res = run(["run", "echo", "hi"], cwd);
  assert.equal(res.code, 1);
  assert.match(res.out, /cxc bg run/);
});

test("cancel of a missing id is not an error", () => {
  const cwd = workspace();
  const res = run(["cancel", "nope"], cwd);
  assert.equal(res.code, 0);
});

test("cancel does not overwrite an already finished job", async (t) => {
  if (process.platform === "win32") return t.skip("posix shell path");
  const cwd = workspace();
  process.env.CODEX_THREAD_ID = "S1";
  const id = run(["run", "--", "sh", "-c", "exit 0"], cwd).out.trim();
  await settle(cwd, id);
  run(["cancel", id], cwd);
  assert.equal(readRecord(cwd, id)?.status, "complete", "a finished job keeps its real outcome");
});

test("on is idempotent and does not move the gate forward", async (t) => {
  if (process.platform === "win32") return t.skip("posix shell path");
  const cwd = workspace();
  process.env.CODEX_THREAD_ID = "S1";
  const id = run(["run", "--", "sh", "-c", "exit 0"], cwd).out.trim();
  await settle(cwd, id);
  assert.equal(selectWake(cwd, "S1").length, 1);
  const again = run(["on"], cwd);
  assert.match(again.out, /이미 ON/);
  assert.equal(selectWake(cwd, "S1").length, 1, "a redundant 'on' must not swallow a pending completion");
});

test("off then on gates only what finished while off", async (t) => {
  if (process.platform === "win32") return t.skip("posix shell path");
  const cwd = workspace();
  process.env.CODEX_THREAD_ID = "S1";
  run(["off"], cwd);
  assert.ok(existsSync(disabledPath(cwd)));
  const id = run(["run", "--", "sh", "-c", "exit 0"], cwd).out.trim();
  await settle(cwd, id);
  run(["on"], cwd);
  assert.equal(selectWake(cwd, "S1").length, 0, "finished during the off window");
});

test("drain works even while the wake is switched off", async (t) => {
  if (process.platform === "win32") return t.skip("posix shell path");
  const cwd = workspace();
  process.env.CODEX_THREAD_ID = "S1";
  const id = run(["run", "--", "sh", "-c", "exit 0"], cwd).out.trim();
  await settle(cwd, id);
  run(["off"], cwd);
  const drained = run(["drain", "--session", "S1"], cwd);
  assert.match(drained.out, new RegExp(id));
  assert.notEqual(readRecord(cwd, id)?.deliveredAt, null);
});

test("drain without --session refuses", () => {
  const cwd = workspace();
  const res = run(["drain"], cwd);
  assert.equal(res.code, 1);
});

test("status reports the switch and the count", () => {
  const cwd = workspace();
  assert.match(run(["status"], cwd).out, /wake: ON/);
  run(["off"], cwd);
  assert.match(run(["status"], cwd).out, /wake: OFF/);
});

test("removal prints all eight steps", () => {
  const out = run(["removal"], workspace()).out;
  for (let i = 1; i <= 8; i += 1) assert.match(out, new RegExp("^" + i + "\\.", "m"));
});

test("the windows path spawns node directly, with no cmd quoting in between", () => {
  const { file, args } = buildShell(["npm", "run", "build"], "C:\\o.txt", "C:\\e.txt", "C:\\h.cjs");
  if (process.platform !== "win32") {
    // buildShell only takes the windows branch on win32; assert the posix shape here.
    assert.equal(file, "/bin/sh");
    return;
  }
  assert.equal(file, process.execPath);
  assert.deepEqual(args, ["C:\\h.cjs", "C:\\o.txt", "C:\\e.txt", "npm", "run", "build"]);
});

test("the windows helper actually runs, captures output and records the exit code", async () => {
  // The helper is plain Node, so its behaviour can be exercised anywhere — this is the
  // part the previous string-matching tests did not lock.
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run2 = promisify(execFile);
  const cwd = workspace();
  const helperPath = join(cwd, "h.cjs");
  const outFile = join(cwd, "o.txt");
  const exitFile = join(cwd, "e.txt");
  writeFileSync(helperPath, buildWindowsHelper(), "utf8");
  await run2(process.execPath, [helperPath, outFile, exitFile, process.execPath, "-e",
    "console.log('on stdout'); console.error('on stderr'); process.exit(5)"]);
  assert.equal(readFileSync(exitFile, "utf8").trim(), "5");
  const captured = readFileSync(outFile, "utf8");
  assert.match(captured, /on stdout/);
  assert.match(captured, /on stderr/, "stderr must land in the same file");
});

test("the windows helper records 127 when the executable does not exist", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run2 = promisify(execFile);
  const cwd = workspace();
  const helperPath = join(cwd, "h.cjs");
  writeFileSync(helperPath, buildWindowsHelper(), "utf8");
  await run2(process.execPath, [helperPath, join(cwd, "o.txt"), join(cwd, "e.txt"), "definitely-not-a-real-binary-xyz"]);
  assert.equal(readFileSync(join(cwd, "e.txt"), "utf8").trim(), "127");
});

test("the windows helper preserves arguments byte-for-byte", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run2 = promisify(execFile);
  const cwd = workspace();
  const helperPath = join(cwd, "h.cjs");
  const outFile = join(cwd, "o.txt");
  writeFileSync(helperPath, buildWindowsHelper(), "utf8");
  const args = ["a b", "x&y", "50%", 'q"uote', "excl!am", "semi;colon"];
  await run2(process.execPath, [helperPath, outFile, join(cwd, "e.txt"), process.execPath, "-e",
    "console.log(JSON.stringify(process.argv.slice(1)))", ...args]);
  assert.deepEqual(JSON.parse(readFileSync(outFile, "utf8").trim()), args);
});

test("an unknown verb prints usage without failing", () => {
  const res = run(["nope"], workspace());
  assert.equal(res.code, 0);
  assert.match(res.out, /cxc bg run/);
});


test("a half-written exit file keeps the job running instead of failing it", async (t) => {
  if (process.platform === "win32") return t.skip("posix shell path");
  const { writeFileSync } = await import("node:fs");
  const { reconcile, writeRecord } = await import("../src/registry.ts");
  const { exitPath, ensureDir } = await import("../src/store.ts");
  const cwd = workspace();
  ensureDir(cwd);
  const rec = {
    id: "half", sessionId: "S1", adoptedBy: null, cwd, command: ["x"], note: null,
    pid: 2147483646, startToken: null, status: "running" as const, exitCode: null,
    startedAt: "2026-09-09T00:00:00.000Z", endedAt: null, deliveredAt: null,
  };
  writeRecord(rec);
  writeFileSync(exitPath(cwd, "half"), "", "utf8");
  // The shell created the file, so its code is on the way even though the PID is gone.
  assert.equal(reconcile(rec).status, "running");
});

test("a hook payload without session_id falls back to CODEX_THREAD_ID", async () => {
  const { handleStop } = await import("../src/hook.ts");
  const { writeRecord } = await import("../src/registry.ts");
  const { ensureDir } = await import("../src/store.ts");
  const cwd = workspace();
  ensureDir(cwd);
  writeRecord({
    id: "envwake", sessionId: "S7", adoptedBy: null, cwd, command: ["x"], note: null,
    pid: null, startToken: null, status: "complete", exitCode: 0,
    startedAt: "2026-09-09T00:00:00.000Z", endedAt: "2026-09-09T00:01:00.000Z", deliveredAt: null,
  });
  const out = handleStop({ cwd }, cwd, { CODEX_THREAD_ID: "S7" } as NodeJS.ProcessEnv);
  assert.match(out, /envwake/);
});

test("run -- exit N still records the code (subshell, not a brace group)", async (t) => {
  if (process.platform === "win32") return t.skip("posix shell path");
  const { readRecord } = await import("../src/registry.ts");
  const cwd = workspace();
  process.env.CODEX_THREAD_ID = "S1";
  const id = run(["run", "--", "exit", "7"], cwd).out.trim();
  await settle(cwd, id);
  assert.equal(readRecord(cwd, id)?.exitCode, 7, "a brace group would have taken the wrapper down with it");
});

test("spawning a missing binary does not throw into the parent", () => {
  const cwd = workspace();
  process.env.CODEX_THREAD_ID = "S1";
  const res = run(["run", "--", "definitely-not-a-real-binary-xyz"], cwd);
  assert.equal(res.code, 0);
});

test("a stale half-written exit file with no pid eventually fails instead of hanging", async () => {
  const { writeFileSync, utimesSync } = await import("node:fs");
  const { reconcile, writeRecord, PENDING_EXIT_GRACE_MS } = await import("../src/registry.ts");
  const { exitPath, ensureDir } = await import("../src/store.ts");
  const cwd = workspace();
  ensureDir(cwd);
  const rec = {
    id: "stuck", sessionId: "S1", adoptedBy: null, cwd, command: ["x"], note: null,
    pid: null, startToken: null, status: "running" as const, exitCode: null,
    startedAt: "2026-09-09T00:00:00.000Z", endedAt: null, deliveredAt: null,
  };
  writeRecord(rec);
  const p = exitPath(cwd, "stuck");
  writeFileSync(p, "", "utf8");
  const old = (Date.now() - PENDING_EXIT_GRACE_MS - 5000) / 1000;
  utimesSync(p, old, old);
  assert.equal(reconcile(rec).status, "failed", "no pid must not mean 'running forever'");
});
