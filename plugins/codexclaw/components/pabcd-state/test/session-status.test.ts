import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { defaultState, writeState } from "../src/state.ts";

const id = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const payload = fileURLToPath(new URL("../../../bin/cxc.mjs", import.meta.url));
const rootBin = fileURLToPath(new URL("../../../../../bin/codexclaw.mjs", import.meta.url));
function fixture(t: { after: (fn: () => void) => void }) {
  const base = mkdtempSync(join(tmpdir(), "cxc-native-status-"));
  const cwd = join(base, "work"), home = join(base, "home");
  mkdirSync(cwd); mkdirSync(home);
  const db = new DatabaseSync(join(home, "state_5.sqlite"));
  db.exec("CREATE TABLE threads (id TEXT PRIMARY KEY, cwd TEXT, archived INTEGER, source TEXT)");
  db.prepare("INSERT INTO threads VALUES (?, ?, 0, 'vscode')").run(id, cwd);
  db.close();
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const env = { ...process.env, CODEX_HOME: home, CODEX_SQLITE_HOME: home, CODEX_THREAD_ID: id };
  const run = (args: string[], binary = cli, overrides: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, [binary, ...args], {
    cwd, env: { ...env, ...overrides }, encoding: "utf8", timeout: 10000,
  });
  return { cwd, home, run };
}

test("status does not invent IDLE for explicit missing state", t => {
  const { cwd, run } = fixture(t);
  const r = run(["orchestrate", "status", "--session", id, "--json"]);
  assert.equal(r.status, 1, r.stderr);
  assert.equal(JSON.parse(r.stdout).phase, null);
  assert.equal(JSON.parse(r.stdout).stateExists, false);
  assert.equal(existsSync(join(cwd, ".codexclaw")), false);
});

test("implicit status selects the native root fork, not a newer parent file", t => {
  const { cwd, run } = fixture(t);
  writeState(cwd, { ...defaultState(id), phase: "P" });
  writeState(cwd, { ...defaultState(other), phase: "B" });
  const parent = join(cwd, ".codexclaw", "sessions", `${other}.json`);
  utimesSync(parent, new Date(2000000000000), new Date(2000000000000));
  const before = readFileSync(parent);
  const r = run(["orchestrate", "status", "--json"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).sessionId, id);
  assert.equal(JSON.parse(r.stdout).phase, "P");
  assert.equal(JSON.parse(r.stdout).selection, "native");
  assert.deepEqual(readFileSync(parent), before);
});

test("native missing state never falls back to a parent", t => {
  const { cwd, run } = fixture(t);
  writeState(cwd, { ...defaultState(other), phase: "B" });
  const r = run(["orchestrate", "status", "--json"]);
  assert.equal(r.status, 1, r.stderr);
  assert.equal(JSON.parse(r.stdout).sessionId, id);
  assert.equal(JSON.parse(r.stdout).phase, null);
});

test("invalid native environment or newer unsupported DB fails without fallback", t => {
  const { cwd, home, run } = fixture(t);
  writeState(cwd, defaultState(other));
  for (const invalid of ["", "../parent", "not-a-uuid"]) {
    assert.equal(run(["orchestrate", "status"], cli, { CODEX_THREAD_ID: invalid }).status, 1);
  }
  const db = new DatabaseSync(join(home, "state_6.sqlite"));
  db.exec("CREATE TABLE threads (id TEXT PRIMARY KEY)"); db.close();
  const r = run(["orchestrate", "status", "--json"]);
  assert.equal(r.status, 1, r.stderr);
  assert.equal(JSON.parse(r.stdout).phase, null);
  assert.equal(existsSync(join(cwd, ".codexclaw", "sessions", `${id}.json`)), false);
});

test("plain terminal retains read-only latest-state fallback", t => {
  const { cwd, run } = fixture(t);
  writeState(cwd, { ...defaultState(other), phase: "A" });
  const r = run(["orchestrate", "status", "--json"], cli, { CODEX_THREAD_ID: undefined });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).sessionId, other);
  assert.equal(JSON.parse(r.stdout).selection, "latest-file");
  const text = run(["orchestrate", "status"], cli, { CODEX_THREAD_ID: undefined });
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /selection=latest-file \(unverified terminal fallback\)/);
});

test("repository and installed-payload dispatch session recovery end to end", t => {
  const { cwd, run } = fixture(t);
  for (const binary of [rootBin, payload]) {
    const current = run(["session", "current", "--json"], binary);
    assert.equal(current.status, 0, current.stderr + current.stdout);
    assert.equal(JSON.parse(current.stdout).sessionId, id);
    const bound = run(["session", "bind", "--json"], binary);
    assert.equal(bound.status, 0, bound.stderr + bound.stdout);
    assert.equal(JSON.parse(bound.stdout).hooksVerified, false);
    const status = run(["orchestrate", "status", "--json"], binary);
    assert.equal(status.status, 0, status.stderr + status.stdout);
    assert.equal(JSON.parse(status.stdout).phase, "IDLE");
    assert.equal(JSON.parse(status.stdout).sessionId, id);
  }
  assert.ok(existsSync(resolve(cwd, ".codexclaw", "sessions", `${id}.json`)));
});
