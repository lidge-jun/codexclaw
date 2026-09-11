import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { runSessionCli } from "../src/session-cli.ts";
import { bindSessionSource, resolveSessionSource } from "../src/session-source.ts";
import { defaultState, writeState, readState } from "../src/state.ts";
import { runOrchestrateCli, parseOrchestrateCliArgs } from "../src/orchestrate-cli.ts";
import { runReceiptCli } from "../src/receipt-cli.ts";
import { validateCheckReceipt } from "../src/check-gate.ts";
import { buildGoalplan, writeGoalplan } from "../src/goalplan.ts";
import { runGoalplanCli } from "../src/goalplan-cli.ts";
import { captureSessionSourceIdentity } from "../src/session-source-identity.ts";
import { checkFinalGatePrereqs } from "../../subagent-config/src/final-gate-guard.ts";
import { handleUserPromptSubmit } from "../src/hook.ts";

const id = "019a0000-0000-7000-8000-000000000123";
function fixture(t: TestContext) {
  // realpathSync.native expands Windows 8.3 short names (RUNNER~1) the way Git reports them.
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-source-flow-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, "native"), source = join(root, "source"), home = join(root, "home");
  mkdirSync(cwd); mkdirSync(home);
  const git = (...args: string[]) => execFileSync("git", args, { cwd, stdio: "pipe" });
  git("init", "-q"); git("config", "user.name", "test"); git("config", "user.email", "test@example.invalid");
  writeFileSync(join(cwd, "seed"), "seed"); git("add", "."); git("commit", "-qm", "seed");
  git("worktree", "add", "-qb", "work", source);
  const db = new DatabaseSync(join(home, "state_5.sqlite"));
  db.exec("CREATE TABLE threads (id TEXT, cwd TEXT, archived INTEGER, source TEXT)");
  db.prepare("INSERT INTO threads VALUES (?, ?, 0, 'cli')").run(id, cwd); db.close();
  const env = { CODEX_THREAD_ID: id, CODEX_HOME: home };
  writeState(cwd, { ...defaultState(id), phase: "A" });
  return { cwd, source, env };
}
function edge(cwd: string, verb: string, from: string) {
  const att = { from, to: verb, did: "integration fixture work", ...(verb === "B" ? { auditOutput: "VERDICT: PASS", auditVerdict: "pass" } : {}) };
  const args = parseOrchestrateCliArgs([verb, "--session", id, "--attest", JSON.stringify(att)], cwd);
  assert.ok(!("error" in args));
  return runOrchestrateCli(args);
}
function bind(f: ReturnType<typeof fixture>) {
  const r = runSessionCli(["source", f.source, "--json"], f.cwd, f.env);
  assert.equal(r.code, 0, r.output);
}

test("Windows short paths bind and resolve the same immutable worktree", { skip: process.platform !== "win32" }, t => {
  const f = fixture(t);
  const root = dirname(f.cwd);
  const shortRoot = execFileSync("cmd.exe", ["/d", "/c", 'for %I in ("%CXC_TEST_LONG_PATH%") do @echo %~sI'], {
    env: { ...process.env, CXC_TEST_LONG_PATH: root }, encoding: "utf8", windowsVerbatimArguments: true,
  }).trim();
  if (shortRoot === root) { t.skip("8.3 names are unavailable on the temporary volume"); return; }
  assert.equal(realpathSync.native(shortRoot), root);
  const shortCwd = join(shortRoot, "native"), shortSource = join(shortRoot, "source");
  assert.equal(bindSessionSource(shortCwd, id, shortSource), f.source);
  const path = join(f.cwd, ".codexclaw", "sources", `${id}.json`);
  const bytes = readFileSync(path, "utf8");
  const binding = JSON.parse(bytes);
  assert.equal(binding.nativeCwd, f.cwd);
  assert.equal(binding.sourceRoot, f.source);
  assert.equal(resolveSessionSource(f.cwd, id), f.source);
  assert.equal(resolveSessionSource(shortCwd, id), f.source);
  assert.equal(bindSessionSource(f.cwd, id, f.source), f.source);
  const bound = runSessionCli(["source", shortSource, "--json"], f.cwd, f.env);
  assert.equal(bound.code, 0, bound.output);
  assert.equal(JSON.parse(bound.output).cwd, f.cwd);
  assert.equal(JSON.parse(bound.output).sourceCwd, f.source);
  assert.equal(readFileSync(path, "utf8"), bytes);
  assert.equal(edge(shortCwd, "B", "A").code, 0);
  assert.equal(readState(f.cwd, id).boundSourceRoot, f.source);
  writeFileSync(join(f.source, "implemented"), "yes");
  const check = edge(f.cwd, "C", "B");
  assert.equal(check.code, 0, check.output);
  const receipt = runReceiptCli({ verb: "test", cwd: f.cwd, session: id,
    command: [process.execPath, "-e", `require('node:assert/strict').equal(process.cwd(), ${JSON.stringify(f.source)})`] });
  assert.equal(receipt.code, 0, receipt.output);
  assert.equal(validateCheckReceipt(readState(f.cwd, id), id, receipt.output, f.cwd).ok, true);
});

test("worktree change advances B and Check runs there while receipts stay native", t => {
  const f = fixture(t); bind(f);
  assert.equal(edge(f.cwd, "B", "A").code, 0);
  writeFileSync(join(f.source, "implemented"), "yes");
  const c = edge(f.cwd, "C", "B"); assert.equal(c.code, 0, c.output);
  const r = runReceiptCli({ verb: "test", cwd: f.cwd, session: id, command: [process.execPath, "-e", `require('node:assert/strict').equal(process.cwd(), ${JSON.stringify(f.source)})`] });
  assert.equal(r.code, 0, r.output);
  assert.ok(r.output.startsWith(join(f.cwd, ".codexclaw", "evidence")));
  assert.equal(validateCheckReceipt(readState(f.cwd, id), id, r.output, f.cwd).ok, true);
  writeFileSync(join(f.source, "implemented"), "changed after check");
  assert.equal(validateCheckReceipt(readState(f.cwd, id), id, r.output, f.cwd).ok, false);
});

test("native-only changes cannot satisfy a bound B baseline", t => {
  const f = fixture(t); bind(f);
  assert.equal(edge(f.cwd, "B", "A").code, 0);
  writeFileSync(join(f.cwd, "unrelated"), "another task");
  const r = edge(f.cwd, "C", "B"); assert.equal(r.code, 1, r.output);
  assert.match(r.output, /SOURCE-DELTA-01/);
});

test("chat phase path observes the same bound source", t => {
  const f = fixture(t); bind(f);
  assert.equal(edge(f.cwd, "B", "A").code, 0);
  writeFileSync(join(f.source, "implemented"), "yes");
  const out = handleUserPromptSubmit({ hook_event_name: "UserPromptSubmit", cwd: f.cwd, session_id: id, prompt: "orchestrate c", transcript_path: null, turn_id: "worktree-flow" });
  assert.equal(readState(f.cwd, id).phase, "C", out);
});

test("a removed source refuses progression and preserves the baseline", t => {
  const f = fixture(t); bind(f);
  assert.equal(edge(f.cwd, "B", "A").code, 0);
  const before = readFileSync(join(f.cwd, ".codexclaw", "sessions", `${id}.json`), "utf8");
  rmSync(f.source, { recursive: true });
  const r = edge(f.cwd, "C", "B"); assert.equal(r.code, 1);
  assert.equal(readFileSync(join(f.cwd, ".codexclaw", "sessions", `${id}.json`), "utf8"), before);
});

test("reproduction control: unbound native cwd misses real linked-worktree implementation", t => {
  const f = fixture(t);
  const current = runSessionCli(["current", "--json"], f.cwd, f.env);
  assert.equal(current.code, 0, current.output);
  assert.equal(JSON.parse(current.output).cwd, f.cwd);
  assert.equal(edge(f.cwd, "B", "A").code, 0);
  writeFileSync(join(f.source, "implemented"), "yes");
  const r = edge(f.cwd, "C", "B");
  assert.equal(r.code, 1); assert.match(r.output, /SOURCE-DELTA-01/);
});

test("Check rejects receipt from a different root even with the same hash", t => {
  const f = fixture(t); bind(f);
  assert.equal(edge(f.cwd, "B", "A").code, 0);
  writeFileSync(join(f.source, "implemented"), "yes");
  assert.equal(edge(f.cwd, "C", "B").code, 0);
  const r = runReceiptCli({ verb: "test", cwd: f.cwd, session: id, command: [process.execPath, "-e", "process.exitCode=0"] });
  assert.equal(r.code, 0, r.output);
  const receipt = JSON.parse(readFileSync(r.output, "utf8"));
  assert.equal(receipt.sourceIdentity.sourceRoot, f.source);
  receipt.sourceIdentity.sourceRoot = f.cwd;
  writeFileSync(r.output, JSON.stringify(receipt));
  assert.equal(validateCheckReceipt(readState(f.cwd, id), id, r.output, f.cwd).ok, false);
});

test("bound command rewrites cannot produce a passing receipt", t => {
  const f = fixture(t); bind(f);
  assert.equal(edge(f.cwd, "B", "A").code, 0);
  writeFileSync(join(f.source, "implemented"), "yes");
  assert.equal(edge(f.cwd, "C", "B").code, 0);
  const r = runReceiptCli({ verb: "test", cwd: f.cwd, session: id,
    command: [process.execPath, "-e", "require('node:fs').writeFileSync('implemented','rewritten')"] });
  assert.equal(r.code, 1, r.output);
  assert.match(r.output, /changed the source/);
});

test("removing the binding is not implementation in CLI or chat", t => {
  const f = fixture(t); bind(f);
  assert.equal(edge(f.cwd, "B", "A").code, 0);
  rmSync(join(f.cwd, ".codexclaw", "sources", `${id}.json`));
  writeFileSync(join(f.cwd, "unrelated"), "not source work");
  const r = edge(f.cwd, "C", "B"); assert.equal(r.code, 1);
  assert.match(r.output, /SOURCE-ROOT/); assert.doesNotMatch(r.output, /SOURCE-DELTA-01/);
  const out = handleUserPromptSubmit({ hook_event_name: "UserPromptSubmit", cwd: f.cwd, session_id: id, prompt: "orchestrate c", transcript_path: null, turn_id: "deleted-binding" });
  assert.match(out, /SOURCE-ROOT/);
  assert.equal(readState(f.cwd, id).phase, "B");
});

test("source command preserves native identity and refuses late or foreign binding", t => {
  const f = fixture(t);
  const late = edge(f.cwd, "B", "A"); assert.equal(late.code, 0);
  assert.equal(runSessionCli(["source", f.source], f.cwd, f.env).code, 1);
  writeState(f.cwd, { ...defaultState(id), phase: "A" });
  const before = readFileSync(join(f.cwd, ".codexclaw", "sessions", `${id}.json`), "utf8");
  bind(f);
  assert.equal(readFileSync(join(f.cwd, ".codexclaw", "sessions", `${id}.json`), "utf8"), before);
  const current = JSON.parse(runSessionCli(["current", "--json"], f.cwd, f.env).output);
  assert.equal(current.cwd, f.cwd); assert.equal(current.sourceCwd, f.source);
  assert.equal(current.sourceIdentity.sourceRoot, f.source);
  assert.equal(runSessionCli(["source", f.source], f.cwd, { ...f.env, CODEX_THREAD_ID: "019a0000-0000-7000-8000-000000000999" }).code, 1);
  assert.equal(runSessionCli(["source", f.source], f.source, f.env).code, 1);
});


test("final reviewer uses the bound worktree and rejects stale commits", t => {
  const f = fixture(t); bind(f);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: f.source, stdio: "pipe" });
  writeFileSync(join(f.source, "implemented"), "yes"); git("add", "."); git("commit", "-qm", "work");
  const identity = captureSessionSourceIdentity(f.cwd, id);
  writeState(f.cwd, { ...readState(f.cwd, id), slug: "review" });
  const receipt = join(f.cwd, ".codexclaw", "evidence", "test.json");
  mkdirSync(join(receipt, ".."), { recursive: true });
  writeFileSync(receipt, JSON.stringify({ kind: "test", sourceIdentity: identity }));
  const planPath = join(f.cwd, ".codexclaw", "goalplans", "review", "goalplan.json");
  mkdirSync(join(planPath, ".."), { recursive: true });
  writeFileSync(planPath, JSON.stringify({ criteria: [], finalGate: { testReceiptPath: receipt } }));
  assert.equal(checkFinalGatePrereqs("[CXC-FINAL-GATE] review", id, f.cwd).ok, true);
  writeFileSync(join(f.source, "implemented"), "dirty");
  writeFileSync(receipt, JSON.stringify({ kind: "test", sourceIdentity: captureSessionSourceIdentity(f.cwd, id) }));
  assert.equal(checkFinalGatePrereqs("[CXC-FINAL-GATE] review", id, f.cwd).ok, true);
  writeFileSync(join(f.source, "implemented"), "other");
  assert.equal(checkFinalGatePrereqs("[CXC-FINAL-GATE] review", id, f.cwd).ok, false);
  writeFileSync(join(f.source, "implemented"), "new"); git("add", "."); git("commit", "-qm", "new");
  assert.equal(checkFinalGatePrereqs("[CXC-FINAL-GATE] review", id, f.cwd).ok, false);
});

test("only same-repository worktree roots can be bound and binding is immutable", t => {
  const f = fixture(t);
  const foreign = join(f.cwd, "..", "foreign"); mkdirSync(foreign);
  execFileSync("git", ["init", "-q"], { cwd: foreign });
  for (const bad of [foreign, f.cwd, "relative", join(f.source, "missing")]) {
    assert.equal(runSessionCli(["source", bad], f.cwd, f.env).code, 1, bad);
  }
  const child = join(f.source, "child"); mkdirSync(child);
  assert.equal(runSessionCli(["source", child], f.cwd, f.env).code, 1);
  bind(f);
  const other = join(f.cwd, "..", "other");
  execFileSync("git", ["worktree", "add", "-qb", "other", other], { cwd: f.cwd, stdio: "pipe" });
  assert.equal(runSessionCli(["source", other], f.cwd, f.env).code, 1);
  assert.equal(edge(f.cwd, "B", "A").code, 0);
  assert.equal(runSessionCli(["source", f.source], f.cwd, f.env).code, 0);
});

for (const corruption of ["json", "owner", "symlink"]) {
  test(`damaged ${corruption} binding fails closed`, t => {
    const f = fixture(t); bind(f);
    assert.equal(edge(f.cwd, "B", "A").code, 0);
    const path = join(f.cwd, ".codexclaw", "sources", `${id}.json`);
    if (corruption === "json") writeFileSync(path, "broken{");
    if (corruption === "owner") {
      const b = JSON.parse(readFileSync(path, "utf8")); b.ownerSessionId = "foreign"; writeFileSync(path, JSON.stringify(b));
    }
    if (corruption === "symlink") {
      const external = join(f.cwd, "..", "binding.json"); writeFileSync(external, readFileSync(path));
      rmSync(path); symlinkSync(external, path);
    }
    const r = edge(f.cwd, "C", "B"); assert.equal(r.code, 1); assert.match(r.output, /SOURCE-ROOT/);
    assert.equal(readState(f.cwd, id).phase, "B");
  });
}

test("deleting a binding during Check cannot certify the native tree", t => {
  const f = fixture(t); bind(f);
  assert.equal(edge(f.cwd, "B", "A").code, 0);
  writeFileSync(join(f.source, "implemented"), "yes");
  assert.equal(edge(f.cwd, "C", "B").code, 0);
  rmSync(join(f.cwd, ".codexclaw", "sources", `${id}.json`));
  const r = runReceiptCli({ verb: "test", cwd: f.cwd, session: id, command: [process.execPath, "-e", "process.exitCode=0"] });
  assert.equal(r.code, 1, r.output);
  assert.match(r.output, /SOURCE-ROOT/);
  const beforeRestore = readFileSync(join(f.cwd, ".codexclaw", "sessions", `${id}.json`), "utf8");
  bind(f);
  assert.equal(readFileSync(join(f.cwd, ".codexclaw", "sessions", `${id}.json`), "utf8"), beforeRestore);
  const restored = runReceiptCli({ verb: "test", cwd: f.cwd, session: id,
    command: [process.execPath, "-e", `require('node:assert/strict').equal(process.cwd(), ${JSON.stringify(f.source)})`] });
  assert.equal(restored.code, 0, restored.output);
});


test("shipped CLI binds and checks a worktree without relocating native state", t => {
  const f = fixture(t);
  const cli = fileURLToPath(new URL("../../../bin/cxc.mjs", import.meta.url));
  const run = (...args: string[]) => execFileSync(process.execPath, [cli, ...args], {
    cwd: f.cwd, env: { ...process.env, ...f.env, CODEX_SQLITE_HOME: f.env.CODEX_HOME }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const bound = JSON.parse(run("session", "source", f.source, "--json"));
  assert.equal(bound.cwd, f.cwd); assert.equal(bound.sourceCwd, f.source);
  run("orchestrate", "B", "--session", id, "--attest", JSON.stringify({ from: "A", to: "B", did: "CLI fixture audited", auditOutput: "VERDICT: PASS", auditVerdict: "pass" }));
  writeFileSync(join(f.source, "implementation"), "real work");
  run("orchestrate", "C", "--session", id, "--attest", JSON.stringify({ from: "B", to: "C", did: "CLI fixture implemented" }));
  const receipt = run("receipt", "test", "--session", id, "--", process.execPath, "-e", `require('node:assert/strict').equal(process.cwd(), ${JSON.stringify(f.source)})`);
  assert.ok(receipt.startsWith(join(f.cwd, ".codexclaw", "evidence")));
  assert.equal(JSON.parse(readFileSync(receipt, "utf8")).sourceIdentity.sourceRoot, f.source);
  assert.equal(readState(f.cwd, id).phase, "C");
});


test("explicit loop validation rejects a lost binding even for legacy goalplans", t => {
  const f = fixture(t); bind(f);
  assert.equal(edge(f.cwd, "B", "A").code, 0);
  const base = buildGoalplan({ objective: "completed legacy goal" });
  const plan = { ...base, schemaVersion: 1,
    workPhases: [{ id: "wp1", title: "done", status: "done" as const, tasks: [], criteriaIds: ["c-1"] }],
    criteria: [{ id: "c-1", scenario: "logic", expectedEvidence: "check", capturedEvidence: "checked", status: "met" as const, surface: "logic" as const }],
  };
  writeGoalplan(f.cwd, plan);
  const args = { verb: "validate" as const, cwd: f.cwd, session: id, slug: plan.slug, criteria: [] };
  assert.equal(runGoalplanCli(args).code, 0);
  rmSync(join(f.cwd, ".codexclaw", "sources", `${id}.json`));
  const result = runGoalplanCli(args);
  assert.equal(result.code, 1); assert.match(result.output, /SOURCE-ROOT/);
});

test("receipt command runs without inherited Git routing variables", t => {
  // Round-2 reviewer probe: with GIT_DIR/GIT_WORK_TREE pointing at the clean native
  // checkout, `git diff --exit-code` inside the bound (dirty) source must still see the
  // bound tree and exit 1, so no receipt is written.
  const f = fixture(t); bind(f);
  assert.equal(edge(f.cwd, "B", "A").code, 0);
  writeFileSync(join(f.source, "implemented"), "yes");
  assert.equal(edge(f.cwd, "C", "B").code, 0);
  writeFileSync(join(f.source, "seed"), "dirty in bound source");
  const saved = { GIT_DIR: process.env.GIT_DIR, GIT_WORK_TREE: process.env.GIT_WORK_TREE };
  process.env.GIT_DIR = join(f.cwd, ".git");
  process.env.GIT_WORK_TREE = f.cwd;
  try {
    const r = runReceiptCli({ verb: "test", cwd: f.cwd, session: id, command: ["git", "diff", "--exit-code", "--quiet", "--", "seed"] });
    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /exited 1; no receipt written/);
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

// ---------------------------------------------------------------------------
// #109 split cwd. The FSM directory need not be a repository; the source tree must be.
// Before this, gitIdentity(cwd) threw for a non-git native cwd and binding was
// unreachable, so a bound cycle could never obtain a real commit sha.
// ---------------------------------------------------------------------------
function splitFixture(t: TestContext) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-split-cwd-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // The native cwd is deliberately NOT a repository.
  const cwd = join(root, "fsm"), source = join(cwd, "src"), home = join(root, "home");
  mkdirSync(cwd); mkdirSync(source); mkdirSync(home);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: source, stdio: "pipe" });
  git("init", "-q"); git("config", "user.name", "test"); git("config", "user.email", "test@example.invalid");
  writeFileSync(join(source, "a.txt"), "x"); git("add", "."); git("commit", "-qm", "init");
  const db = new DatabaseSync(join(home, "state_5.sqlite"));
  db.exec("CREATE TABLE threads (id TEXT, cwd TEXT, archived INTEGER, source TEXT)");
  db.prepare("INSERT INTO threads VALUES (?, ?, 0, 'cli')").run(id, cwd); db.close();
  const env = { CODEX_THREAD_ID: id, CODEX_HOME: home };
  writeState(cwd, { ...defaultState(id), phase: "A" });
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: source, encoding: "utf8" }).trim();
  return { root, cwd, source, home, env, head };
}

test("#109: a non-git native cwd can bind a nested git source root", t => {
  const f = splitFixture(t);
  // Sanity: the premise is that the FSM cwd is NOT inside a repository. Without this the
  // test would silently exercise the ordinary linked-worktree path instead.
  assert.throws(() => execFileSync("git", ["rev-parse", "--git-dir"], { cwd: f.cwd, stdio: "pipe" }));
  assert.equal(runSessionCli(["source", f.source, "--json"], f.cwd, f.env).code, 0);
  assert.equal(resolveSessionSource(f.cwd, id), f.source);
});

test("#109: the widened guard still refuses a subdirectory, an ancestor and a second target", t => {
  const f = splitFixture(t);
  const child = join(f.source, "child"); mkdirSync(child);
  // Not a repository ROOT.
  const sub = runSessionCli(["source", child], f.cwd, f.env);
  assert.equal(sub.code, 1);
  assert.match(sub.output, /root of a Git repository/);
  // The ancestor case gets its own fixture below: initialising a repository at the
  // ancestor turns the FSM cwd into a git cwd, which would contaminate the immutability
  // assertions that follow here.
  // Relative paths stay refused.
  assert.equal(runSessionCli(["source", "relative"], f.cwd, f.env).code, 1);
  // Immutability survives the widening.
  assert.equal(runSessionCli(["source", f.source, "--json"], f.cwd, f.env).code, 0);
  const other = join(f.cwd, "other"); mkdirSync(other);
  execFileSync("git", ["init", "-q"], { cwd: other, stdio: "pipe" });
  assert.equal(runSessionCli(["source", other], f.cwd, f.env).code, 1);
});

// The discriminator in nativeGitIdentity. A bare `catch` would treat ANY git failure as
// "not a repository" and then allow binding an unrelated repo, quietly relaxing the
// linked-worktree guard for a reason unrelated to #109.
//
// A BARE repository is the precise case: `rev-parse --git-dir` succeeds, so git does
// consider this a repository, but `--show-toplevel` fails because there is no work tree,
// so gitIdentity() throws. The probe must rethrow rather than report non-git.
//
// Note the contrast that makes this test meaningful: when `--git-dir` ALSO fails, git
// itself does not consider the directory a repository, and taking the #109 path is then
// correct. This case is the other side of that line.
test("#109: a bare repository is NOT treated as non-git", t => {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-bare-native-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, "bare"), home = join(root, "home");
  mkdirSync(cwd); mkdirSync(home);
  execFileSync("git", ["init", "--bare", "-q"], { cwd, stdio: "pipe" });
  // Premise: git owns this directory, but it has no work tree.
  assert.doesNotThrow(() => execFileSync("git", ["rev-parse", "--git-dir"], { cwd, stdio: "pipe" }));
  assert.throws(() => execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, stdio: "pipe" }));

  const foreign = join(root, "foreign-repo"); mkdirSync(foreign);
  execFileSync("git", ["init", "-q"], { cwd: foreign, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "test"], { cwd: foreign, stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "t@example.invalid"], { cwd: foreign, stdio: "pipe" });
  writeFileSync(join(foreign, "a.txt"), "x");
  execFileSync("git", ["add", "."], { cwd: foreign, stdio: "pipe" });
  execFileSync("git", ["commit", "-qm", "init"], { cwd: foreign, stdio: "pipe" });

  const db = new DatabaseSync(join(home, "state_5.sqlite"));
  db.exec("CREATE TABLE threads (id TEXT, cwd TEXT, archived INTEGER, source TEXT)");
  db.prepare("INSERT INTO threads VALUES (?, ?, 0, 'cli')").run(id, cwd); db.close();
  const env = { CODEX_THREAD_ID: id, CODEX_HOME: home };
  writeState(cwd, { ...defaultState(id), phase: "A" });

  // It must NOT fall through to the #109 path and accept an unrelated repository.
  assert.equal(runSessionCli(["source", foreign], cwd, env).code, 1);
});

// Why the containment check inside the non-git branch of bindSessionSource is a DEFENSIVE
// INVARIANT rather than a reachable path, pinned so a future probe change cannot quietly
// make it reachable. Entering that branch means the FSM cwd is not inside ANY repository.
// A source root that CONTAINS the FSM cwd necessarily puts that cwd inside the source
// repository, which makes nativeGitIdentity non-null and routes the call to the `native`
// linked-worktree branch instead. So the ancestor is refused -- just not by the message
// the non-git branch would emit. This test documents the real behaviour instead of
// asserting a string that never appears.
test("#109: a source root containing the FSM cwd is refused by the native branch", t => {
  const f = splitFixture(t);
  // Before: the FSM cwd is not inside any repository.
  assert.throws(() => execFileSync("git", ["rev-parse", "--git-dir"], { cwd: f.cwd, stdio: "pipe" }));
  // Making the ancestor a repository also makes the FSM cwd a git cwd.
  execFileSync("git", ["init", "-q"], { cwd: f.root, stdio: "pipe" });
  assert.doesNotThrow(() => execFileSync("git", ["rev-parse", "--git-dir"], { cwd: f.cwd, stdio: "pipe" }));
  const anc = runSessionCli(["source", f.root], f.cwd, f.env);
  assert.equal(anc.code, 1);
  assert.match(anc.output, /linked worktree root/);
});
