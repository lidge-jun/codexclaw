/**
 * registry.test.ts — daemon-free reconciliation and the enable-gate.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reconcile, selectWake, writeRecord, listRecords, type BgRecord } from "../src/registry.ts";
import { atomicWrite, enabledAtPath, ensureDir, exitPath } from "../src/store.ts";
import { buildShell, newId } from "../src/spawn.ts";

function workspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "bgreg-"));
  ensureDir(dir);
  return dir;
}

function running(cwd: string, id: string, pid: number | null): BgRecord {
  const rec: BgRecord = {
    id, sessionId: "S1", adoptedBy: null, cwd, command: ["sleep", "1"], note: null,
    pid, startToken: null, status: "running", exitCode: null,
    startedAt: "2026-09-09T00:00:00.000Z", endedAt: null, deliveredAt: null,
  };
  writeRecord(rec);
  return rec;
}

test("an exit file completes the record without any watcher", () => {
  const cwd = workspace();
  const rec = running(cwd, "a", 999999);
  writeFileSync(exitPath(cwd, "a"), "0", "utf8");
  const out = reconcile(rec);
  assert.equal(out.status, "complete");
  assert.equal(out.exitCode, 0);
  assert.notEqual(out.endedAt, null);
});

test("a non-zero exit code is a failure, not a completion", () => {
  const cwd = workspace();
  const rec = running(cwd, "b", 999999);
  writeFileSync(exitPath(cwd, "b"), "1", "utf8");
  assert.equal(reconcile(rec).status, "failed");
});

test("a vanished shell with no exit file is failed with an unknown code", () => {
  const cwd = workspace();
  // PID 0 is never a live child here; the point is the honest 'we do not know' path.
  const rec = running(cwd, "c", 2147483646);
  const out = reconcile(rec);
  assert.equal(out.status, "failed");
  assert.equal(out.exitCode, null);
});

test("a fresh record with no pid stays running, an old one does not", () => {
  const cwd = workspace();
  const fresh = { ...running(cwd, "d", null), startedAt: new Date().toISOString() };
  assert.equal(reconcile(fresh).status, "running");
  // A shell that never spawned leaves no pid and no exit file. The async 'error'
  // handler can be lost when the CLI exits, so age is the backstop.
  const old = running(cwd, "e", null);
  assert.equal(reconcile(old).status, "failed");
});

test("re-enabling does not stampede completions that finished while off", () => {
  const cwd = workspace();
  const rec: BgRecord = {
    id: "old", sessionId: "S1", adoptedBy: null, cwd, command: ["x"], note: null,
    pid: null, startToken: null, status: "complete", exitCode: 0,
    startedAt: "2026-09-09T00:00:00.000Z", endedAt: "2026-09-09T00:01:00.000Z", deliveredAt: null,
  };
  writeRecord(rec);
  atomicWrite(enabledAtPath(cwd), "2026-09-09T00:05:00.000Z");
  assert.equal(selectWake(cwd, "S1").length, 0, "finished before the switch came back on");
  writeRecord({ ...rec, id: "new", endedAt: "2026-09-09T00:06:00.000Z" });
  assert.equal(selectWake(cwd, "S1").length, 1);
});

test("listRecords tolerates junk in the directory", () => {
  const cwd = workspace();
  writeFileSync(join(cwd, ".codexclaw", "bg", "x.json"), "nope", "utf8");
  assert.deepEqual(listRecords(cwd), []);
});

test("the posix shell records its own exit code", () => {
  if (process.platform === "win32") return;
  const { file, args } = buildShell(["echo", "hi there"], "/tmp/o", "/tmp/e");
  assert.equal(file, "/bin/sh");
  assert.match(args[1] ?? "", /printf %s \$\? >/);
  assert.match(args[1] ?? "", /'hi there'/);
});

test("ids do not collide with existing records", () => {
  const cwd = workspace();
  running(cwd, "taken", null);
  assert.notEqual(newId(cwd, "taken"), "taken");
});

