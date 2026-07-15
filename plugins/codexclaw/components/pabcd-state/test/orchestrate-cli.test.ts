import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseOrchestrateCliArgs, renderOrchestrateParseError, runOrchestrateCli, resolveSession } from "../src/orchestrate-cli.ts";
import { writeState, readState, defaultState, STATE_DIR, SESSIONS_SUBDIR, LEDGER_FILE } from "../src/state.ts";
import { buildGoalplan, writeGoalplan } from "../src/goalplan.ts";
import { RENDER_OBS_FILE } from "../src/render-observations.ts";
import { defaultInterview, DIMENSIONS } from "../src/interview.ts";

// Build an interview-ready tracker (maxed dims, empty contradictions, a scan recorded)
// so readState() derives flags.interview=true (it ignores a persisted flag — the tracker
// is the single source of truth).
function readyInterview() {
  const t = defaultInterview("r1");
  for (const d of DIMENSIONS) t.dimensions[d] = { level: "max", known: ["x"], unknown: [], confidence: 1 };
  t.scanRounds = 1;
  t.lastScanRoundId = 1;
  return t;
}

function freshCwd(): string {
  return mkdtempSync(join(tmpdir(), "codexclaw-cli-"));
}
// 260714 wp2: the P>A edge now requires an on-disk plan unit (plan-gate.ts).
// Seed a minimal valid unit and return the planUnit value for the attest.
function seedPlanUnit(cwd: string): string {
  const unit = join(cwd, "devlog", "_plan", "000000_test-unit");
  mkdirSync(unit, { recursive: true });
  writeFileSync(join(unit, "000_plan.md"), "# 000 — test plan\n", "utf8");
  return "devlog/_plan/000000_test-unit";
}
function seedSession(cwd: string, id: string, phase: Parameters<typeof defaultState>[0] extends string ? string : never = "IDLE"): void {
  writeState(cwd, { ...defaultState(id), phase: phase as never });
}
function ledgerLines(cwd: string): Array<Record<string, unknown>> {
  const p = join(cwd, STATE_DIR, LEDGER_FILE);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

test("parseOrchestrateCliArgs: verb + structural --attest (single quoted token)", () => {
  const r = parseOrchestrateCliArgs(["a", "--attest", '{"from":"P","to":"A","did":"x y z"}'], "/tmp");
  assert.ok(!("error" in r));
  if ("error" in r) return;
  assert.equal(r.verb, "A");
  assert.deepEqual(r.attest, { from: "P", to: "A", did: "x y z" });
});

test("parseOrchestrateCliArgs: unknown verb -> error", () => {
  const r = parseOrchestrateCliArgs(["idle"], "/tmp");
  assert.ok("error" in r);
});

test("parseOrchestrateCliArgs: help tokens return help result", () => {
  for (const argv of [["--help"], ["-h"], ["help"], ["status", "--help"]]) {
    const r = parseOrchestrateCliArgs(argv, "/tmp");
    assert.ok("help" in r, `${argv.join(" ")} should parse as help`);
  }
});

test("parseOrchestrateCliArgs: malformed --attest sets attestError, no throw", () => {
  const r = parseOrchestrateCliArgs(["a", "--attest", "{nope}"], "/tmp");
  assert.ok(!("error" in r));
  if ("error" in r) return;
  assert.ok(r.attestError);
});

test("orchestrate help exits 0 and does not mutate state, ledger, or render ledger", () => {
  const empty = freshCwd();
  try {
    const parsed = parseOrchestrateCliArgs(["--help"], empty);
    assert.ok("help" in parsed);
    const r = runOrchestrateCli(parsed);
    assert.equal(r.code, 0);
    assert.match(r.output, /cxc orchestrate/);
    assert.equal(existsSync(join(empty, STATE_DIR, SESSIONS_SUBDIR)), false);
    assert.equal(existsSync(join(empty, STATE_DIR, LEDGER_FILE)), false);
    assert.equal(existsSync(join(empty, STATE_DIR, RENDER_OBS_FILE)), false);
  } finally { rmSync(empty, { recursive: true, force: true }); }

  const existing = freshCwd();
  try {
    seedSession(existing, "s1", "P");
    const statePath = join(existing, STATE_DIR, SESSIONS_SUBDIR, "s1.json");
    const ledgerPath = join(existing, STATE_DIR, LEDGER_FILE);
    const renderPath = join(existing, STATE_DIR, RENDER_OBS_FILE);
    writeFileSync(ledgerPath, "{\"x\":1}\n");
    writeFileSync(renderPath, "{\"kind\":\"artifact-modified\"}\n");
    const beforeState = readFileSync(statePath, "utf8");
    const beforeLedger = readFileSync(ledgerPath, "utf8");
    const beforeRender = readFileSync(renderPath, "utf8");
    const r = runOrchestrateCli({ help: true, cwd: existing });
    assert.equal(r.code, 0);
    assert.equal(readFileSync(statePath, "utf8"), beforeState);
    assert.equal(readFileSync(ledgerPath, "utf8"), beforeLedger);
    assert.equal(readFileSync(renderPath, "utf8"), beforeRender);
  } finally { rmSync(existing, { recursive: true, force: true }); }
});

test("AGENT-GATED: P->A without --attest fails (unlike chat free-pass)", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s1", "P");
    const r = runOrchestrateCli({ verb: "A", attest: null, session: "s1", cwd, json: false });
    assert.equal(r.code, 1);
    assert.match(r.output, /current=P/);
    assert.match(r.output, /attestation|did/i);
    assert.equal(readState(cwd, "s1").phase, "P"); // unchanged
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("malformed attest with explicit session reports current phase without mutating", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s1", "P");
    const r = runOrchestrateCli({ verb: "A", attest: null, attestError: "attest JSON is not valid JSON", session: "s1", cwd, json: false });
    assert.equal(r.code, 1);
    assert.match(r.output, /current=P/);
    assert.match(r.output, /attest JSON is not valid JSON/);
    assert.equal(readState(cwd, "s1").phase, "P");
    assert.deepEqual(ledgerLines(cwd), []);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("AGENT-GATED: P->A WITH valid --attest advances + ledger reason 'cli'", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s2", "P");
    const planUnit = seedPlanUnit(cwd);
    const r = runOrchestrateCli({ verb: "A", attest: { from: "P", to: "A", did: "audited", planUnit }, session: "s2", cwd, json: false });
    assert.equal(r.code, 0);
    assert.equal(readState(cwd, "s2").phase, "A");
    const led = ledgerLines(cwd);
    assert.equal(led.at(-1)?.reason, "cli");
    assert.equal(led.at(-1)?.to, "A");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("PLAN-GATE: P->A without planUnit is refused; with a seeded unit it advances", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "sg", "P");
    const bare = runOrchestrateCli({ verb: "A", attest: { from: "P", to: "A", did: "audited the plan" }, session: "sg", cwd, json: false });
    assert.equal(bare.code, 1);
    assert.match(bare.output, /planUnit/);
    assert.match(bare.output, /cxc plan init/);
    assert.equal(readState(cwd, "sg").phase, "P"); // unchanged
    // nonexistent unit dir is also refused
    const ghost = runOrchestrateCli({ verb: "A", attest: { from: "P", to: "A", did: "audited", planUnit: "devlog/_plan/000000_missing" }, session: "sg", cwd, json: false });
    assert.equal(ghost.code, 1);
    assert.match(ghost.output, /does not exist/);
    // seeded unit passes
    const planUnit = seedPlanUnit(cwd);
    const ok = runOrchestrateCli({ verb: "A", attest: { from: "P", to: "A", did: "audited", planUnit }, session: "sg", cwd, json: false });
    assert.equal(ok.code, 0, ok.output);
    assert.equal(readState(cwd, "sg").phase, "A");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("260714 wp4: goalplan-bound gated edge requires matching workPhaseId", () => {
  const cwd = freshCwd();
  try {
    // bind a goalplan (slug on state + plan on disk) with a registered work-phase map
    writeState(cwd, { ...defaultState("wb", "unit-bind"), phase: "B" as never, slug: "unit-bind" });
    const plan = buildGoalplan({ objective: "binding test" });
    plan.slug = "unit-bind"; // buildGoalplan derives slug from objective; pin it to the state binding
    plan.workPhases = [
      { id: "wp1", title: "one", status: "in_progress", tasks: [], criteriaIds: [] },
      { id: "wp2", title: "two", status: "pending", tasks: [], criteriaIds: [] },
    ];
    writeGoalplan(cwd, plan);
    // missing workPhaseId -> refused, reason teaches the field
    const missing = runOrchestrateCli({ verb: "C", attest: { from: "B", to: "C", did: "built it" }, session: "wb", cwd, json: false });
    assert.equal(missing.code, 1);
    assert.match(missing.output, /workPhaseId/);
    assert.equal(readState(cwd, "wb").phase, "B");
    // wrong id -> refused with LOOP-UNIT-CHAIN-01
    const wrong = runOrchestrateCli({ verb: "C", attest: { from: "B", to: "C", did: "built it", workPhaseId: "wp2" }, session: "wb", cwd, json: false });
    assert.equal(wrong.code, 1);
    assert.match(wrong.output, /LOOP-UNIT-CHAIN-01/);
    // matching effective id -> advances
    const ok = runOrchestrateCli({ verb: "C", attest: { from: "B", to: "C", did: "built it", workPhaseId: "wp1" }, session: "wb", cwd, json: false });
    assert.equal(ok.code, 0, ok.output);
    assert.equal(readState(cwd, "wb").phase, "C");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("WP3: A->B without auditOutput is rejected; with verdict, advances", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s2b", "A");
    const bare = runOrchestrateCli({ verb: "B", attest: { from: "A", to: "B", did: "audited it myself" }, session: "s2b", cwd, json: false });
    assert.equal(bare.code, 1);
    assert.match(bare.output, /auditOutput/);
    assert.equal(readState(cwd, "s2b").phase, "A"); // unchanged
    const withAudit = runOrchestrateCli({
      verb: "B",
      attest: { from: "A", to: "B", did: "audit folded back", auditOutput: "reviewer: GO; refs verified", auditVerdict: "pass" },
      session: "s2b", cwd, json: false,
    });
    assert.equal(withAudit.code, 0);
    assert.equal(readState(cwd, "s2b").phase, "B");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("A->B CLI rejects auditVerdict=fail with blocked reason", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s2c", "A");
    const r = runOrchestrateCli({
      verb: "B",
      attest: { from: "A", to: "B", did: "audit found blockers", auditOutput: "VERDICT: FAIL", auditVerdict: "fail" },
      session: "s2c", cwd, json: false,
    });
    assert.equal(r.code, 1);
    assert.match(r.output, /blocked/);
    assert.match(r.output, /SAME reviewer/);
    assert.equal(readState(cwd, "s2c").phase, "A");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("C->D with failing exitCode is rejected (gated check)", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s3", "C");
    const r = runOrchestrateCli({ verb: "D", attest: { from: "C", to: "D", did: "ran", checkOutput: "x", exitCode: 1 }, session: "s3", cwd, json: false });
    assert.equal(r.code, 1);
    assert.equal(readState(cwd, "s3").phase, "C");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("G1: C->D with passing attest CLOSES to IDLE (D is not a resting state)", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s3c", "C");
    const r = runOrchestrateCli({ verb: "D", attest: { from: "C", to: "D", did: "checks passed", checkOutput: "tests 1 pass 1", exitCode: 0 }, session: "s3c", cwd, json: false });
    assert.equal(r.code, 0);
    assert.match(r.output, /→ IDLE/);
    const st = readState(cwd, "s3c");
    assert.equal(st.phase, "IDLE", "CLI D must close the cycle to IDLE, not rest at D");
    assert.equal(st.orchestrationActive, false, "closed cycle must not stay orchestration-active");
    // exactly one ledger row for the close, recorded as a C->IDLE 'done' (no double row).
    const led = ledgerLines(cwd);
    const last = led.at(-1);
    assert.equal(last?.from, "C");
    assert.equal(last?.to, "IDLE");
    assert.equal(last?.reason, "done");
    assert.equal(led.filter((l) => l.to === "D").length, 0, "no intermediate phase=D ledger row");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("G2: explicit --session with an UNKNOWN id refuses to mutate (no divergent session minted)", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "real-sess", "P");
    // a typo / never-created codex-style id must not be silently created on a mutating verb.
    const r = runOrchestrateCli({ verb: "A", attest: { from: "P", to: "A", did: "x" }, session: "ghost-9999", cwd, json: false });
    assert.equal(r.code, 1);
    assert.match(r.output, /unknown session 'ghost-9999'/);
    assert.ok(!existsSync(join(cwd, STATE_DIR, SESSIONS_SUBDIR, "ghost-9999.json")), "no divergent session file may be written");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("G2: explicit --session targeting an EXISTING file still works", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "real-sess", "P");
    const planUnit = seedPlanUnit(cwd);
    const r = runOrchestrateCli({ verb: "A", attest: { from: "P", to: "A", did: "audited", planUnit }, session: "real-sess", cwd, json: false });
    assert.equal(r.code, 0);
    assert.equal(readState(cwd, "real-sess").phase, "A");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("G2: reserved 'cli' key may bootstrap a terminal session even with no file yet", () => {
  const cwd = freshCwd();
  try {
    mkdirSync(join(cwd, STATE_DIR, SESSIONS_SUBDIR), { recursive: true });
    // no sessions exist; explicit --session cli is the documented terminal bootstrap.
    const r = runOrchestrateCli({ verb: "I", attest: { from: "IDLE", to: "I", did: "interview start" }, session: "cli", cwd, json: false });
    assert.equal(r.code, 0, r.output);
    assert.equal(readState(cwd, "cli").phase, "I");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("illegal edge from IDLE is refused", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s4", "IDLE");
    const r = runOrchestrateCli({ verb: "C", attest: null, session: "s4", cwd, json: false });
    assert.equal(r.code, 1);
    assert.match(r.output, /illegal transition|attestation/i);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("status renders phase; reset clears to IDLE", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s5", "C");
    const st = runOrchestrateCli({ verb: "status", attest: null, session: "s5", cwd, json: false });
    assert.match(st.output, /session=s5/);
    assert.match(st.output, /phase=C/);
    const rs = runOrchestrateCli({ verb: "reset", attest: null, session: "s5", cwd, json: false });
    assert.equal(rs.code, 0);
    assert.match(rs.output, /current=C -> IDLE/);
    assert.equal(readState(cwd, "s5").phase, "IDLE");
    const noop = runOrchestrateCli({ verb: "reset", attest: null, session: "s5", cwd, json: false });
    assert.equal(noop.code, 0);
    assert.match(noop.output, /current=IDLE/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("mutating verb with no session and empty dir -> error (no silent divergence)", () => {
  const cwd = freshCwd();
  try {
    const r = runOrchestrateCli({ verb: "P", attest: null, cwd, json: false });
    assert.equal(r.code, 1);
    assert.match(r.output, /require an explicit --session/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("G3: mutating verb WITHOUT --session refuses even when sessions exist (fork-FSM fix)", () => {
  const cwd = freshCwd();
  try {
    // Seed an existing session that the old implicit fallback would have picked.
    seedSession(cwd, "victim", "P");
    // No --session: must refuse, must NOT touch the victim session.
    const r = runOrchestrateCli({ verb: "A", attest: { from: "P", to: "A", did: "foreign audit" }, cwd, json: false });
    assert.equal(r.code, 1);
    assert.match(r.output, /require an explicit --session/);
    assert.equal(readState(cwd, "victim").phase, "P");
    // reset without --session is also refused (this is the exact foreign-reset shape).
    const rr = runOrchestrateCli({ verb: "reset", attest: null, cwd, json: false });
    assert.equal(rr.code, 1);
    assert.match(rr.output, /require an explicit --session/);
    assert.equal(readState(cwd, "victim").phase, "P");
    // Explicit --session still works.
    const planUnit = seedPlanUnit(cwd);
    const ok = runOrchestrateCli({ verb: "A", attest: { from: "P", to: "A", did: "owner audit", planUnit }, cwd, json: false, session: "victim" });
    assert.equal(ok.code, 0);
    assert.equal(readState(cwd, "victim").phase, "A");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("status with no session reports it without creating one", () => {
  const cwd = freshCwd();
  try {
    const r = runOrchestrateCli({ verb: "status", attest: null, cwd, json: false });
    assert.equal(r.code, 0);
    assert.match(r.output, /no active session/);
    assert.equal(existsSync(join(cwd, STATE_DIR, SESSIONS_SUBDIR)), false);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("parse error renderer includes phase for an explicit existing session", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s1", "P");
    const parsed = parseOrchestrateCliArgs(["wat", "--session", "s1", "--cwd", cwd], "/unused");
    assert.ok("error" in parsed);
    if (!("error" in parsed)) return;
    const out = renderOrchestrateParseError(parsed);
    assert.match(out, /current=P/);
    assert.match(out, /run cxc orchestrate --help/);
    assert.equal(readState(cwd, "s1").phase, "P");
    assert.deepEqual(ledgerLines(cwd), []);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("resolveSession: explicit wins; latest-mtime otherwise; null on empty", () => {
  const cwd = freshCwd();
  try {
    assert.equal(resolveSession(cwd), null); // missing dir
    const dir = join(cwd, STATE_DIR, SESSIONS_SUBDIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "old.json"), "{}");
    writeFileSync(join(dir, "new.json"), "{}");
    const past = Date.now() / 1000 - 100;
    utimesSync(join(dir, "old.json"), past, past);
    assert.equal(resolveSession(cwd), "new"); // latest mtime
    assert.equal(resolveSession(cwd, "explicit"), "explicit"); // explicit wins
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// CLI dist integration: drive the compiled cli.js orchestrate path end-to-end with a
// retry, since node:test runs many spawn-using suites concurrently and a transient
// loader/resource hiccup can make a single child exit non-zero. Two attempts removes
// that harness flake without weakening the assertion (the dist logic itself is also
// covered in-process by the runOrchestrateCli tests above).
function distCli(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "dist", "cli.js");
}

function runDistStatus(cwd: string): { status: number | null; stdout: string } {
  let last = { status: null as number | null, stdout: "" };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = spawnSync(process.execPath, [distCli(), "orchestrate", "status", "--session", "binsess", "--cwd", cwd], { encoding: "utf8" });
    last = { status: res.status, stdout: res.stdout ?? "" };
    if (res.status === 0 && /phase=P/.test(last.stdout)) return last;
  }
  return last;
}

test("dist cli: `cli.js orchestrate status` runs end-to-end", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "binsess", "P");
    const res = runDistStatus(cwd);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /phase=P/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("dist cli: `cli.js orchestrate --help` exits 0", () => {
  const res = spawnSync(process.execPath, [distCli(), "orchestrate", "--help"], { encoding: "utf8" });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /cxc orchestrate/);
});

test("dist cli: unknown orchestrate verb reports current phase with explicit session", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "binsess", "P");
    const res = spawnSync(process.execPath, [distCli(), "orchestrate", "wat", "--session", "binsess", "--cwd", cwd], { encoding: "utf8" });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /current=P/);
    assert.match(res.stderr, /cxc orchestrate --help/);
    assert.equal(readState(cwd, "binsess").phase, "P");
    assert.deepEqual(ledgerLines(cwd), []);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

// --- G20 (L20-WP8): ungated-edge CLI coverage. The four forward edges P>A/A>B/B>C/C>D
// are attest-gated (covered above); the entry + abort edges are NOT gated and were
// previously untested through runOrchestrateCli. These prove they advance WITHOUT an
// --attest and that an illegal edge is still refused.
test("G20: IDLE->I interview entry advances with no --attest (ungated edge)", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s1", "IDLE");
    const r = runOrchestrateCli({ verb: "I", attest: null, session: "s1", cwd, json: false });
    assert.equal(r.code, 0, r.output);
    assert.equal(readState(cwd, "s1").phase, "I");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("G20: I->P needs the interview flag — refused without it, advances with it (no --attest)", () => {
  // I->P is ungated by attest, but the FSM requires interview completion (flags.interview)
  // so the plan can't start before the interview ran. Prove BOTH halves of that contract.
  const denied = freshCwd();
  try {
    seedSession(denied, "s1", "I"); // interview flag not set
    const r = runOrchestrateCli({ verb: "P", attest: null, session: "s1", cwd: denied, json: false });
    assert.equal(r.code, 1, "I->P without the interview flag must be refused");
    assert.match(r.output, /interview/i);
    assert.equal(readState(denied, "s1").phase, "I"); // unchanged
  } finally { rmSync(denied, { recursive: true, force: true }); }

  const allowed = freshCwd();
  try {
    writeState(allowed, { ...defaultState("s1"), phase: "I", interview: readyInterview() });
    const r = runOrchestrateCli({ verb: "P", attest: null, session: "s1", cwd: allowed, json: false });
    assert.equal(r.code, 0, `I->P with the interview flag should advance: ${r.output}`);
    assert.equal(readState(allowed, "s1").phase, "P");
  } finally { rmSync(allowed, { recursive: true, force: true }); }
});

test("I->P agent override succeeds with an unready interview", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s1", "I");
    const r = runOrchestrateCli({
      verb: "P",
      attest: { from: "I", to: "P", did: "interview done", override: true },
      session: "s1",
      cwd,
      json: false,
    });
    assert.equal(r.code, 0, r.output);
    assert.match(r.output, /agent override/);
    assert.equal(readState(cwd, "s1").phase, "P");
    assert.equal(readState(cwd, "s1").interview, null);
    const last = ledgerLines(cwd).at(-1);
    assert.equal(last?.actor, "agent");
    assert.equal(last?.override, true);
    assert.deepEqual(last?.scanEvidence, { scanRounds: 0, highContradictionCount: 0 });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("I->P agent override without override flag is soft-gate blocked", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s1", "I");
    const r = runOrchestrateCli({
      verb: "P",
      attest: { from: "I", to: "P", did: "interview done" },
      session: "s1",
      cwd,
      json: false,
    });
    assert.equal(r.code, 1);
    assert.match(r.output, /soft-gate/);
    assert.equal(readState(cwd, "s1").phase, "I");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("I->P with a ready interview uses the normal path without override", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("s1"), phase: "I", interview: readyInterview() });
    const r = runOrchestrateCli({ verb: "P", attest: null, session: "s1", cwd, json: false });
    assert.equal(r.code, 0, r.output);
    assert.equal(readState(cwd, "s1").phase, "P");
    assert.equal(ledgerLines(cwd).at(-1)?.override, undefined);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("I->P agent override ledger records zero-round scan evidence", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s1", "I");
    const r = runOrchestrateCli({
      verb: "P",
      attest: { from: "I", to: "P", did: "interview complete by agent judgment", override: true },
      session: "s1",
      cwd,
      json: false,
    });
    assert.equal(r.code, 0, r.output);
    const last = ledgerLines(cwd).at(-1);
    assert.deepEqual(last?.scanEvidence, { scanRounds: 0, highContradictionCount: 0 });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("I->P agent override rejects empty did", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s1", "I");
    const r = runOrchestrateCli({
      verb: "P",
      attest: { from: "I", to: "P", did: "", override: true },
      session: "s1", cwd, json: false,
    });
    assert.equal(r.code, 1);
    assert.match(r.output, /placeholder/i);
    assert.equal(readState(cwd, "s1").phase, "I");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("I->P agent override rejects placeholder did", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s1", "I");
    const r = runOrchestrateCli({
      verb: "P",
      attest: { from: "I", to: "P", did: "done", override: true },
      session: "s1", cwd, json: false,
    });
    assert.equal(r.code, 1);
    assert.match(r.output, /placeholder/i);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("I->P agent override rejects mismatched from/to", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s1", "I");
    const r = runOrchestrateCli({
      verb: "P",
      attest: { from: "P", to: "A", did: "interview complete with evidence", override: true },
      session: "s1", cwd, json: false,
    });
    assert.equal(r.code, 1);
    assert.match(r.output, /from\/to must be I\/P/i);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("I->P agent override preserves existing partial tracker", () => {
  const cwd = freshCwd();
  try {
    // Seed a partial tracker with some content
    const partial = defaultInterview(3);
    partial.dimensions.goal = { level: "max", known: ["real-goal"], unknown: [], confidence: 0.9 };
    partial.contradictions = [{ contradictionId: "c1", severity: "medium", summary: "test contradiction" }];
    partial.assumptions = [{ id: "a1", text: "test assumption", recorded: true }];
    writeState(cwd, { ...defaultState("s1"), phase: "I", interview: partial });

    const r = runOrchestrateCli({
      verb: "P",
      attest: { from: "I", to: "P", did: "interview complete despite partial tracker", override: true },
      session: "s1", cwd, json: false,
    });
    assert.equal(r.code, 0, r.output);
    // The tracker must be UNCHANGED after override
    const after = readState(cwd, "s1");
    assert.equal(after.phase, "P");
    assert.equal(after.interview?.roundId, 3);
    assert.equal(after.interview?.contradictions?.length, 1);
    assert.equal(after.interview?.assumptions?.length, 1);
    assert.equal(after.interview?.dimensions?.goal?.known?.[0], "real-goal");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("G20: abort-to-I edges P->I, A->I, B->I are ungated (no --attest)", () => {
  for (const from of ["P", "A", "B"] as const) {
    const cwd = freshCwd();
    try {
      seedSession(cwd, "s1", from);
      const r = runOrchestrateCli({ verb: "I", attest: null, session: "s1", cwd, json: false });
      assert.equal(r.code, 0, `${from}->I should be free: ${r.output}`);
      assert.equal(readState(cwd, "s1").phase, "I");
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
});

test("G20: illegal edge I->B is refused (no attest can force a non-adjacency)", () => {
  const cwd = freshCwd();
  try {
    seedSession(cwd, "s1", "I");
    const r = runOrchestrateCli({ verb: "B", attest: null, session: "s1", cwd, json: false });
    assert.equal(r.code, 1);
    assert.equal(readState(cwd, "s1").phase, "I"); // unchanged
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
