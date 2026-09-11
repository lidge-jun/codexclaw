import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { runSessionCli } from "../src/session-cli.ts";
import { runGoalplanCli, parseGoalplanCliArgs } from "../src/goalplan-cli.ts";
import { runOrchestrateCli, parseOrchestrateCliArgs } from "../src/orchestrate-cli.ts";
import { runReceiptCli, receiptPathFor } from "../src/receipt-cli.ts";
import { defaultState, writeState, readState } from "../src/state.ts";

/**
 * #109 positive path. The criterion (c-8) is not that a bound cycle CLOSES in a split cwd;
 * it is that the receipt it closes on carries a REAL commit sha rather than an unavailable
 * identity. A receipt that merely exists would satisfy a weaker reading and prove nothing
 * about the evidence chain.
 *
 * Layer composition is asserted in step 2: under L4 the same bound `loop init` call in this
 * directory is REFUSED, because the source identity is unavailable. It succeeds here only
 * because the binding in step 1 made that identity resolvable. The two layers compose
 * rather than one undoing the other.
 */
const id = "019a0000-0000-7000-8000-000000000109";

function splitCwd(t: TestContext) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "cxc-split-cycle-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // The FSM directory is deliberately NOT a repository; the source tree under it is.
  const cwd = join(root, "fsm"), source = join(cwd, "src"), home = join(root, "home");
  mkdirSync(cwd); mkdirSync(source); mkdirSync(home);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: source, stdio: "pipe" });
  git("init", "-q");
  git("config", "user.name", "test");
  git("config", "user.email", "test@example.invalid");
  writeFileSync(join(source, "tracked.txt"), "x\n");
  git("add", ".");
  git("commit", "-qm", "init");
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: source, encoding: "utf8" }).trim();
  const db = new DatabaseSync(join(home, "state_5.sqlite"));
  db.exec("CREATE TABLE threads (id TEXT, cwd TEXT, archived INTEGER, source TEXT)");
  db.prepare("INSERT INTO threads VALUES (?, ?, 0, " + JSON.stringify("cli").replace(/"/g, "'") + ")").run(id, cwd);
  db.close();
  writeState(cwd, defaultState(id));
  // Premise: git does not consider the FSM directory a repository.
  assert.throws(() => execFileSync("git", ["rev-parse", "--git-dir"], { cwd, stdio: "pipe" }));
  return { root, cwd, source, home, head, env: { CODEX_THREAD_ID: id, CODEX_HOME: home } };
}

function edge(cwd: string, verb: string, extra: Record<string, unknown> = {}) {
  const from = verb === "A" ? "P" : verb === "B" ? "A" : verb === "C" ? "B" : "C";
  // A bound goalplan with registered work phases requires workPhaseId on every gated edge
  // (LOOP-UNIT-CHAIN-01), and D additionally refuses a plan with no work-phase to close
  // (CYCLE-COMPLETION-01), which is why boundInit registers one.
  const att = { from, to: verb, did: "split-cwd probe work", workPhaseId: "wp0", ...extra };
  const args = parseOrchestrateCliArgs([verb, "--session", id, "--attest", JSON.stringify(att)], cwd);
  assert.ok(!("error" in args), JSON.stringify(args));
  return runOrchestrateCli(args);
}

function enter(cwd: string, verb: string) {
  const args = parseOrchestrateCliArgs([verb, "--session", id], cwd);
  assert.ok(!("error" in args));
  return runOrchestrateCli(args);
}

function planUnit(cwd: string): string {
  const rel = join("devlog", "_plan", "260911_probe");
  mkdirSync(join(cwd, rel), { recursive: true });
  writeFileSync(join(cwd, rel, "000_plan.md"), "# probe\n\nobjective and constraints.\n");
  return rel.split("\\").join("/");
}

function boundInit(f: ReturnType<typeof splitCwd>) {
  const args = parseGoalplanCliArgs(["init", "--objective", "split cwd probe objective", "--session", id, "--criterion", "the probe closes a cycle"], f.cwd);
  assert.ok(!("error" in args), JSON.stringify(args));
  const init = runGoalplanCli(args as never);
  if (init.code !== 0) return init;
  const wp = parseGoalplanCliArgs(["add-work-phase", "--session", id, "--id", "wp0", "--title", "the split-cwd probe unit"], f.cwd);
  assert.ok(!("error" in wp), JSON.stringify(wp));
  const added = runGoalplanCli(wp as never);
  assert.equal(added.code, 0, added.output);
  return init;
}

function driveToC(f: ReturnType<typeof splitCwd>) {
  const unit = planUnit(f.cwd);
  assert.equal(enter(f.cwd, "P").code, 0);
  const toA = edge(f.cwd, "A", { planUnit: unit });
  assert.equal(toA.code, 0, toA.output);
  const toB = edge(f.cwd, "B", { auditOutput: "VERDICT: PASS", auditVerdict: "pass" });
  assert.equal(toB.code, 0, toB.output);
  // SOURCE-DELTA-01: B->C refuses when the source is unchanged since B began, because
  // nothing was implemented in this B. Implement INSIDE B, in the bound source tree --
  // which is itself a small proof that the bound tree is the one the gate watches.
  writeFileSync(join(f.source, "implemented.txt"), "work done in B\n");
  const toC = edge(f.cwd, "C");
  assert.equal(toC.code, 0, toC.output);
}

test("#109 c-8: a bound cycle in a split cwd closes on a receipt carrying a real commit sha", t => {
  const f = splitCwd(t);

  // 1. bind the nested repository as this session source
  assert.equal(runSessionCli(["source", f.source, "--json"], f.cwd, f.env).code, 0);

  // 2. L4 + L6 composition: this call is refused when the identity is unavailable.
  const init = boundInit(f);
  assert.equal(init.code, 0, init.output);
  assert.equal(readState(f.cwd, id).slug.length > 0, true);

  // 3. drive the cycle
  driveToC(f);

  // 4. the receipt, and the criterion is its CONTENT rather than its existence
  const receipt = runReceiptCli({ verb: "test", cwd: f.cwd, session: id,
    command: [process.execPath, "-e", "process.stdout.write(\"probe ok\")"] } as never);
  assert.equal(receipt.code, 0, receipt.output);
  const written = JSON.parse(readFileSync(receiptPathFor(f.cwd, id), "utf8"));
  assert.notEqual(written.sourceIdentity?.kind, "unavailable");
  assert.equal(written.sourceIdentity?.commitSha, f.head);
  // The receipt stays in the NATIVE cwd while the identity follows the source.
  assert.equal(written.sourceIdentity?.sourceRoot, f.source);
});

// Control A. A mutation made DURING the check command is what "changed the source while
// running" detects. A mutation made BEFORE the command starts leaves the before/after
// snapshots equal and would pass, which is why this control writes from inside the command.
test("#109: a check that rewrites the source still refuses to produce a receipt", t => {
  const f = splitCwd(t);
  assert.equal(runSessionCli(["source", f.source, "--json"], f.cwd, f.env).code, 0);
  assert.equal(boundInit(f).code, 0);
  driveToC(f);

  const target = JSON.stringify(join(f.source, "tracked.txt"));
  const script = "require(" + JSON.stringify("node:fs") + ").writeFileSync(" + target + ", " + JSON.stringify("rewritten\n") + ")";
  const receipt = runReceiptCli({ verb: "test", cwd: f.cwd, session: id, command: [process.execPath, "-e", script] } as never);
  assert.equal(receipt.code, 1);
  assert.match(receipt.output, /changed the source while running/);
});

// Control B. A mutation made AFTER the check ran is a different gate: the receipt is
// already written and internally consistent, so `receipt test` has nothing to say about
// it. C->D is what must refuse, via the "source changed after the check ran" path in
// check-gate. Asserting control A alone would leave this half unproven, and between them
// they are what shows the split-cwd separation did not cost staleness detection.
test("#109: a source mutated after the check cannot close C to D", t => {
  const f = splitCwd(t);
  assert.equal(runSessionCli(["source", f.source, "--json"], f.cwd, f.env).code, 0);
  assert.equal(boundInit(f).code, 0);
  driveToC(f);

  const receipt = runReceiptCli({ verb: "test", cwd: f.cwd, session: id,
    command: [process.execPath, "-e", "process.stdout.write(\"probe ok\")"] } as never);
  assert.equal(receipt.code, 0, receipt.output);
  const receiptPath = receiptPathFor(f.cwd, id);

  // Now move the tree out from under the receipt.
  writeFileSync(join(f.source, "tracked.txt"), "changed after the check\n");

  const toD = edge(f.cwd, "D", { checkOutput: "probe ok", exitCode: 0, testReceiptPath: receiptPath });
  assert.equal(toD.code, 1, toD.output);
  assert.match(toD.output, /source changed after the check ran/);
  // And the cycle is still at C, not silently advanced.
  assert.equal(readState(f.cwd, id).phase, "C");
});

// The closing half of c-8: with the tree untouched, the same edge DOES close to IDLE.
test("#109 c-8: the untouched cycle closes C to D and back to IDLE", t => {
  const f = splitCwd(t);
  assert.equal(runSessionCli(["source", f.source, "--json"], f.cwd, f.env).code, 0);
  assert.equal(boundInit(f).code, 0);
  driveToC(f);

  const receipt = runReceiptCli({ verb: "test", cwd: f.cwd, session: id,
    command: [process.execPath, "-e", "process.stdout.write(\"probe ok\")"] } as never);
  assert.equal(receipt.code, 0, receipt.output);

  const toD = edge(f.cwd, "D", { checkOutput: "probe ok", exitCode: 0, testReceiptPath: receiptPathFor(f.cwd, id) });
  assert.equal(toD.code, 0, toD.output);
  assert.equal(readState(f.cwd, id).phase, "IDLE");
});
