import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// #133 integration. A goalplan-bound cycle in a NON-GIT workspace used to sail
// P->A->B->C and then strand at C forever, because C->D needs a testReceiptPath and
// `receipt test` refuses to write a receipt it cannot bind to a commit. Meanwhile every
// transition leaked `fatal: not a git repository` to the terminal.
//
// These run the REAL CLI as a child process. That is load-bearing for case 3: the leak
// was execFileSync inheriting the PARENT stderr, so in-process it would land on the test
// runner own stderr and never appear in a returned string - the assertion would pass
// while the bug was fully present.
const CLI = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const SESSION = "019a0000-0000-7000-8000-000000000133";
// The standalone-terminal session id. `orchestrate` requires existing session state,
// and its own error names `cli` as the id to use outside a native Codex session.
// `loop init` does not require pre-existing state, so SESSION is fine there.
const TERM = "cli";

function probe(t: TestContext): string {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-nongit-cycle-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  // Sanity: the fixture must NOT be inside a repository, or the test proves nothing.
  const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd, encoding: "utf8" });
  assert.notEqual(inside.status, 0, "fixture is inside a git repository");
  return cwd;
}

function cxc(cwd: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CODEX_HOME: join(cwd, "codexhome") },
  });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

function attest(cwd: string, body: Record<string, unknown>): string[] {
  const path = join(cwd, "attest.json");
  writeFileSync(path, JSON.stringify(body));
  return ["--attest-file", path];
}

test("a bound cycle in a non-git workspace is refused at loop init and writes nothing", t => {
  const cwd = probe(t);
  const res = cxc(cwd, ["loop", "init", "--objective", "bound probe in a non-git tree", "--session", SESSION, "--criterion", "probe closes a cycle"]);
  assert.equal(res.status, 1);
  // Actionable, with BOTH exits named.
  assert.match(res.stdout, /no resolvable git source identity/);
  assert.match(res.stdout, /cxc session source/);
  assert.match(res.stdout, /unbound/);
  assert.match(res.stdout, /Nothing was written/);
  // The trap must never be built in the first place.
  assert.equal(existsSync(join(cwd, ".codexclaw", "goalplans")), false);
});

// The regression guard. This layer must NOT tighten the unbound contract: an unbound
// cycle closes D on checkOutput + exitCode alone and never touches the receipt path.
test("an unbound cycle in the same non-git workspace still closes D to IDLE", t => {
  const cwd = probe(t);
  const unit = join("devlog", "_plan", "260911_probe");
  mkdirSync(join(cwd, unit), { recursive: true });
  writeFileSync(join(cwd, unit, "000_plan.md"), "# probe plan\n\nobjective and constraints.\n");

  const toP = cxc(cwd, ["orchestrate", "P", "--session", TERM]);
  assert.equal(toP.status, 0, toP.stdout + toP.stderr);
  const toA = cxc(cwd, ["orchestrate", "A", "--session", TERM, ...attest(cwd, {
    from: "P", to: "A", did: "wrote the probe plan", planUnit: unit.replaceAll("\\", "/"),
  })]);
  assert.equal(toA.status, 0, toA.stdout + toA.stderr);
  const toB = cxc(cwd, ["orchestrate", "B", "--session", TERM, ...attest(cwd, {
    from: "A", to: "B", did: "folded nothing", auditOutput: "VERDICT: PASS", auditVerdict: "pass",
  })]);
  assert.equal(toB.status, 0, toB.stdout + toB.stderr);
  const toC = cxc(cwd, ["orchestrate", "C", "--session", TERM, ...attest(cwd, {
    from: "B", to: "C", did: "implemented the probe",
  })]);
  assert.equal(toC.status, 0, toC.stdout + toC.stderr);
  const toD = cxc(cwd, ["orchestrate", "D", "--session", TERM, ...attest(cwd, {
    from: "C", to: "D", did: "verified the probe", checkOutput: "probe ok", exitCode: 0,
  })]);
  assert.equal(toD.status, 0, toD.stdout + toD.stderr);
  assert.match(toD.stdout, /IDLE|cycle closed/);

  const status = cxc(cwd, ["orchestrate", "status", "--session", TERM]);
  assert.match(status.stdout, /phase=IDLE/);
});

// #133 second half. Before the fix, source-identity git() inherited stderr, so B->C and
// C each emitted `fatal: not a git repository` even though the transition SUCCEEDED.
test("no git fatal line reaches user output on any transition", t => {
  const cwd = probe(t);
  const unit = join("devlog", "_plan", "260911_probe");
  mkdirSync(join(cwd, unit), { recursive: true });
  writeFileSync(join(cwd, unit, "000_plan.md"), "# probe plan\n\nobjective and constraints.\n");

  const runs = [
    cxc(cwd, ["orchestrate", "P", "--session", TERM]),
    cxc(cwd, ["orchestrate", "A", "--session", TERM, ...attest(cwd, { from: "P", to: "A", did: "plan", planUnit: unit.replaceAll("\\", "/") })]),
    cxc(cwd, ["orchestrate", "B", "--session", TERM, ...attest(cwd, { from: "A", to: "B", did: "audit", auditOutput: "VERDICT: PASS", auditVerdict: "pass" })]),
    cxc(cwd, ["orchestrate", "C", "--session", TERM, ...attest(cwd, { from: "B", to: "C", did: "build" })]),
  ];
  for (const [i, res] of runs.entries()) {
    assert.doesNotMatch(res.stderr, /^fatal:/m, `transition ${i} leaked git stderr: ${res.stderr}`);
    assert.doesNotMatch(res.stdout, /^fatal:/m, `transition ${i} leaked git stdout: ${res.stdout}`);
  }
});
