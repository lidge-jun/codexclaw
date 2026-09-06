import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs, { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { Worker } from "node:worker_threads";
import { resolveNativeSession } from "../src/session-binding.ts";
import { runSessionCli } from "../src/session-cli.ts";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
const CHILD = "019a0000-0000-7000-8000-000000000001";
const PARENT = "019a0000-0000-7000-8000-000000000002";

function fixture(t: TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cxc-session-binding-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, "work");
  const home = join(root, "native");
  mkdirSync(cwd);
  mkdirSync(home);
  const env = { CODEX_THREAD_ID: CHILD, CODEX_HOME: home };
  const dir = join(cwd, ".codexclaw", "sessions");
  const path = join(dir, `${CHILD}.json`);
  return { root, cwd, home, env, dir, path };
}

function nativeDb(home: string, cwd: string, version = "5", row: Record<string, string | number | null> = {}) {
  const path = join(home, `state_${version}.sqlite`);
  const db = new DatabaseSync(path);
  try {
    // Native columns used by recovery; extra private data must never reach output.
    db.exec("CREATE TABLE threads (id TEXT PRIMARY KEY, cwd TEXT, archived INTEGER, source TEXT, title TEXT)");
    const values = { id: CHILD, cwd, archived: 0, source: "vscode", ...row };
    db.prepare("INSERT INTO threads VALUES (?, ?, ?, ?, ?)").run(values.id, values.cwd, values.archived, values.source, "PRIVATE_TRANSCRIPT");
  } finally { db.close(); }
  return path;
}

function jsonResult(args: string[], f: ReturnType<typeof fixture>) {
  const result = runSessionCli([...args, "--json"], f.cwd, f.env);
  return { code: result.code, body: JSON.parse(result.output) };
}

function snapshot(path: string): unknown {
  const stat = lstatSync(path);
  return stat.isDirectory()
    ? { mtime: stat.mtimeMs, entries: Object.fromEntries(readdirSync(path).sort().map(name => [name, snapshot(join(path, name))])) }
    : { mtime: stat.mtimeMs, bytes: readFileSync(path).toString("base64") };
}

test("current resolves a root fork without creating state or changing parent bytes", t => {
  const f = fixture(t);
  const dbPath = nativeDb(f.home, f.cwd);
  mkdirSync(f.dir, { recursive: true });
  const parentBytes = '{ "sessionId": "' + PARENT + '", "phase": "B", "loopArmSeen": true }\n';
  writeFileSync(join(f.dir, `${PARENT}.json`), parentBytes);
  const before = snapshot(f.root);
  assert.deepEqual(resolveNativeSession(f.cwd, f.env), { ok: true, sessionId: CHILD, cwd: f.cwd, dbPath });
  const { code, body } = jsonResult(["current"], f);
  assert.equal(code, 0);
  assert.equal(body.sessionId, CHILD);
  assert.equal(body.cwd, f.cwd);
  assert.equal(body.statePath, f.path);
  assert.equal(body.source, "CODEX_THREAD_ID");
  assert.equal(body.stateExists, false);
  assert.equal(body.phase, null);
  assert.equal(body.created, false);
  assert.equal(body.hooksVerified, false);
  assert.deepEqual(snapshot(f.root), before);
});

test("current with no state directory is read-only; bind creates only the child and preserves resumed state", t => {
  const f = fixture(t);
  nativeDb(f.home, f.cwd);
  const before = snapshot(f.root);
  assert.equal(jsonResult(["current"], f).code, 0);
  assert.deepEqual(snapshot(f.root), before);
  assert.equal(existsSync(join(f.cwd, ".codexclaw")), false);
  const first = jsonResult(["bind"], f);
  assert.equal(first.code, 0);
  assert.equal(first.body.created, true);
  assert.equal(first.body.phase, "IDLE");
  assert.equal(first.body.stateExists, true);
  assert.equal(first.body.hooksVerified, false);
  const state = JSON.parse(readFileSync(f.path, "utf8"));
  assert.equal(state.sessionId, CHILD);
  assert.equal(state.orchestrationActive, false);
  assert.equal(state.loopArmSeen, false);
  const resumed = JSON.stringify({ ...state, phase: "C", orchestrationActive: true, loopArmSeen: true, injectedTurns: ["turn-1"], customEvidence: "preserve" }, null, 4) + "\n";
  writeFileSync(f.path, resumed);
  const parentPath = join(f.dir, `${PARENT}.json`);
  writeFileSync(parentPath, '{ "phase": "B", "sessionId": "' + PARENT + '" }\n');
  const parent = readFileSync(parentPath);
  for (const command of ["bind", "current", "bind"]) {
    const result = jsonResult([command], f);
    assert.equal(result.code, 0);
    assert.equal(result.body.phase, "C");
    assert.equal(result.body.created, false);
    assert.equal(result.body.hooksVerified, false);
    assert.equal(readFileSync(f.path, "utf8"), resumed);
    assert.deepEqual(readFileSync(parentPath), parent);
  }
  assert.deepEqual(readdirSync(join(f.cwd, ".codexclaw")), ["sessions"]);
  assert.deepEqual(readdirSync(f.dir).sort(), [`${CHILD}.json`, `${PARENT}.json`]);
});

for (const source of ["cli", "vscode", "exec", "mcp"]) {
  test(`accept native root source ${source} and canonical cwd aliases`, t => {
    const f = fixture(t);
    const alias = join(f.root, "alias");
    symlinkSync(f.cwd, alias, "dir");
    nativeDb(f.home, alias, "5", { source });
    const result = resolveNativeSession(alias, f.env);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.cwd, f.cwd);
  });
}

for (const id of [undefined, "", "invalid-private-id", `${CHILD}\n`, ` ${CHILD}`, "../other"]) {
  test(`absent or invalid native ID is refused (${JSON.stringify(id)})`, t => {
    const f = fixture(t);
    nativeDb(f.home, f.cwd);
    const env = { ...f.env, CODEX_THREAD_ID: id };
    assert.equal(resolveNativeSession(f.cwd, env).ok, false);
    for (const command of ["current", "bind"]) {
      const result = runSessionCli([command, "--json"], f.cwd, env);
      assert.equal(result.code, 1);
      assert.equal(JSON.parse(result.output).hooksVerified, false);
      assert.doesNotMatch(result.output, /invalid-private-id/);
    }
    assert.equal(existsSync(join(f.cwd, ".codexclaw")), false);
  });
}

for (const [name, row] of Object.entries({
  "missing row": { id: PARENT },
  "archived row": { archived: 1 },
  "invalid archive flag": { archived: 2 },
  "null archive flag": { archived: null },
  "missing cwd": { cwd: "/does-not-exist-cxc" },
  "relative cwd": { cwd: "." },
  "unknown source": { source: "unknown" },
  "malformed source": { source: '{"private":"PRIVATE_TRANSCRIPT"' },
  "null source": { source: null },
  "JSON root string": { source: '"cli"' },
  "custom source": { source: '{"custom":"cli"}' },
  "internal source": { source: '{"internal":"guardian"}' },
  "subagent with null role": { source: '{"subagent":{"thread_spawn":{"parent_thread_id":"' + PARENT + '","agent_role":null}}}' },
  "subagent review": { source: '{"subagent":"review"}' },
})) {
  test(`fail closed for ${name}`, t => {
    const f = fixture(t);
    nativeDb(f.home, f.cwd, "5", row);
    assert.equal(resolveNativeSession(f.cwd, f.env).ok, false);
    const result = jsonResult(["bind"], f);
    assert.equal(result.code, 1);
    assert.doesNotMatch(JSON.stringify(result.body), /PRIVATE_TRANSCRIPT/);
    assert.equal(existsSync(join(f.cwd, ".codexclaw")), false);
  });
}

test("cwd must match exactly after realpath, not a parent or sibling", t => {
  const f = fixture(t);
  nativeDb(f.home, f.root);
  assert.equal(resolveNativeSession(f.cwd, f.env).ok, false);
});

test("highest numeric database wins and CODEX_SQLITE_HOME takes precedence", t => {
  const f = fixture(t);
  nativeDb(f.home, f.cwd, "9", { archived: 1 });
  const dbPath = nativeDb(f.home, f.cwd, "10");
  assert.deepEqual(resolveNativeSession(f.cwd, f.env), { ok: true, sessionId: CHILD, cwd: f.cwd, dbPath });
  const otherHome = join(f.root, "override");
  mkdirSync(otherHome);
  nativeDb(otherHome, f.cwd, "1", { archived: 1 });
  assert.equal(resolveNativeSession(f.cwd, { ...f.env, CODEX_SQLITE_HOME: otherHome }).ok, false);
});

for (const kind of ["missing", "missing-directory", "schema", "malformed", "directory", "missing-column"]) {
  test(`database ${kind} fails without older fallback or state creation`, t => {
    const f = fixture(t);
    if (kind !== "missing" && kind !== "missing-directory") {
      nativeDb(f.home, f.cwd, "5");
      const path = join(f.home, "state_10.sqlite");
      if (kind === "malformed") writeFileSync(path, "PRIVATE_TRANSCRIPT");
      else if (kind === "directory") mkdirSync(path);
      else {
        const db = new DatabaseSync(path);
        db.exec(kind === "schema" ? "CREATE TABLE other (id TEXT)" : "CREATE TABLE threads (id TEXT, cwd TEXT, archived INTEGER)");
        db.close();
      }
    }
    if (kind === "missing-directory") f.env.CODEX_HOME = join(f.root, "absent");
    const before = snapshot(f.root);
    const result = jsonResult(["bind"], f);
    assert.equal(result.code, 1);
    assert.equal(typeof result.body.error, "string");
    assert.deepEqual(snapshot(f.root), before);
  });
}

for (const bytes of ["PRIVATE_TRANSCRIPT {", "null", "[]", "{}", '{"sessionId":"' + PARENT + '","phase":"B"}', '{"sessionId":"' + CHILD + '","phase":"INVALID"}']) {
  test(`corrupt or wrong-ID state is preserved (${bytes.slice(0, 24)})`, t => {
    const f = fixture(t);
    nativeDb(f.home, f.cwd);
    mkdirSync(f.dir, { recursive: true });
    writeFileSync(f.path, bytes);
    const before = snapshot(f.root);
    for (const command of ["current", "bind"]) {
      const result = jsonResult([command], f);
      assert.equal(result.code, 1);
      assert.doesNotMatch(JSON.stringify(result.body), /PRIVATE_TRANSCRIPT/);
      assert.deepEqual(snapshot(f.root), before);
    }
  });
}

for (const target of ["root", "sessions", "file", "dangling-file", "root-file", "sessions-file", "file-directory"]) {
  test(`refuse redirected or nonregular state path: ${target}`, t => {
    const f = fixture(t);
    nativeDb(f.home, f.cwd);
    const external = join(f.root, "external");
    mkdirSync(external);
    const externalFile = join(external, "private.json");
    writeFileSync(externalFile, '{"sessionId":"' + CHILD + '","phase":"B"}');
    const before = snapshot(external);
    if (target === "root") symlinkSync(external, join(f.cwd, ".codexclaw"), "dir");
    else if (target === "root-file") writeFileSync(join(f.cwd, ".codexclaw"), "private");
    else if (target === "sessions" || target === "sessions-file") {
      mkdirSync(join(f.cwd, ".codexclaw"));
      if (target === "sessions") symlinkSync(external, f.dir, "dir");
      else writeFileSync(f.dir, "private");
    } else {
      mkdirSync(f.dir, { recursive: true });
      if (target === "file-directory") mkdirSync(f.path);
      else symlinkSync(target === "file" ? externalFile : join(external, "absent"), f.path);
    }
    for (const command of ["current", "bind"]) {
      assert.equal(jsonResult([command], f).code, 1);
      assert.deepEqual(snapshot(external), before);
    }
  });
}

for (const args of [[], ["other"], ["--json", "current"], ["current", "--session", PARENT], ["bind", "--force"], ["bind", CHILD], ["current", "--json", "--json"], ["bind", "--json=true"], ["bind", "--"]]) {
  test(`unsupported arguments refused: ${args.join(" ")}`, t => {
    const f = fixture(t);
    nativeDb(f.home, f.cwd);
    assert.equal(runSessionCli(args, f.cwd, f.env).code, 1);
    assert.equal(existsSync(join(f.cwd, ".codexclaw")), false);
  });
}

test("plain output names verified identity and explicitly leaves hook health unverified", t => {
  const f = fixture(t);
  nativeDb(f.home, f.cwd);
  const result = runSessionCli(["current"], f.cwd, f.env);
  assert.equal(result.code, 0);
  assert.match(result.output, new RegExp(CHILD));
  assert.match(result.output, /hooksVerified.*false/);
  assert.doesNotMatch(result.output, /PRIVATE_TRANSCRIPT/);
});

for (const competitor of ["corrupt", "wrong-id", "symlink"]) {
  test(`bind validates a concurrent ${competitor} winner after exclusive create`, t => {
    const f = fixture(t);
    nativeDb(f.home, f.cwd);
    const external = join(f.root, "external.json");
    writeFileSync(external, '{"sessionId":"' + CHILD + '","phase":"B"}');
    const originalLink = fs.linkSync;
    // Force the competing publication at the actual exclusive-create boundary;
    // everything else (native SQLite, ensureState, and state IO) remains real.
    const link = t.mock.method(fs, "linkSync", (existing: fs.PathLike, created: fs.PathLike) => {
      if (competitor === "symlink") symlinkSync(external, f.path);
      else writeFileSync(f.path, competitor === "corrupt" ? "PRIVATE_TRANSCRIPT {" : '{"sessionId":"' + PARENT + '","phase":"B"}');
      originalLink(existing, created);
    });
    syncBuiltinESMExports();
    try {
      const result = jsonResult(["bind"], f);
      assert.equal(result.code, 1);
      assert.equal(result.body.hooksVerified, false);
      assert.doesNotMatch(JSON.stringify(result.body), /PRIVATE_TRANSCRIPT/);
      assert.deepEqual(readdirSync(f.dir), [`${CHILD}.json`]);
      if (competitor === "symlink") assert.equal(lstatSync(f.path).isSymbolicLink(), true);
      else assert.equal(readFileSync(f.path, "utf8"), competitor === "corrupt" ? "PRIVATE_TRANSCRIPT {" : '{"sessionId":"' + PARENT + '","phase":"B"}');
      assert.equal(readFileSync(external, "utf8"), '{"sessionId":"' + CHILD + '","phase":"B"}');
    } finally {
      link.mock.restore();
      syncBuiltinESMExports();
    }
  });
}

test("concurrent bind publishes exactly once and all callers validate the same state", { timeout: 10_000 }, async t => {
  const f = fixture(t);
  nativeDb(f.home, f.cwd);
  const gate = new SharedArrayBuffer(4);
  const moduleUrl = new URL("../src/session-cli.ts", import.meta.url).href;
  let ready = 0;
  const results = await Promise.all(Array.from({ length: 4 }, () => new Promise<{ code: number; output: string }>((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require("node:worker_threads");
      import(workerData.moduleUrl).then(({ runSessionCli }) => {
        parentPort.postMessage("ready");
        Atomics.wait(new Int32Array(workerData.gate), 0, 0);
        parentPort.postMessage(runSessionCli(["bind", "--json"], workerData.cwd, workerData.env));
      });
    `, { eval: true, workerData: { moduleUrl, gate, cwd: f.cwd, env: f.env } });
    t.after(() => worker.terminate());
    worker.on("error", reject);
    worker.on("message", message => {
      if (message === "ready") {
        ready++;
        if (ready === 4) {
          Atomics.store(new Int32Array(gate), 0, 1);
          Atomics.notify(new Int32Array(gate), 0);
        }
      } else resolve(message);
    });
    worker.on("exit", code => { if (code !== 0) reject(new Error(`worker exit ${code}`)); });
  })));
  assert.ok(results.every(result => result.code === 0));
  const bodies = results.map(result => JSON.parse(result.output));
  assert.equal(bodies.filter(body => body.created).length, 1);
  assert.ok(bodies.every(body => body.sessionId === CHILD && body.phase === "IDLE" && body.hooksVerified === false));
  assert.deepEqual(readdirSync(f.dir), [`${CHILD}.json`]);
  assert.equal(JSON.parse(readFileSync(f.path, "utf8")).sessionId, CHILD);
});
