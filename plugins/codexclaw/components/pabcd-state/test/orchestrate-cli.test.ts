import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseOrchestrateCliArgs, renderOrchestrateHelp, renderOrchestrateParseError, runOrchestrateCli, resolveSession } from "../src/orchestrate-cli.ts";
import { writeState, readState, defaultState, STATE_DIR, SESSIONS_SUBDIR, LEDGER_FILE } from "../src/state.ts";
import {
  buildGoalplan,
  effectiveActiveWorkPhaseId,
  goalplanWriteLockDir,
  readGoalplan,
  writeGoalplan,
  type Goalplan,
} from "../src/goalplan.ts";
import { captureSourceIdentity } from "../src/source-identity.ts";
import { RENDER_OBS_FILE } from "../src/render-observations.ts";
import { defaultInterview, DIMENSIONS } from "../src/interview.ts";

const expectedTaskFields = [
  { id: "t-1", dependsOn: [], outcome: "first task verified" },
  { id: "t-2", dependsOn: ["t-1"], outcome: "second task verified" },
];

function taskFields(plan: { workPhases: Array<{ tasks: Array<{
  id: string;
  dependsOn?: string[];
  outcome?: string;
}> }> }) {
  return plan.workPhases[0].tasks.map(({ id, dependsOn, outcome }) => ({ id, dependsOn, outcome }));
}

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

// ---- #31: --attest-file (PowerShell cannot pass the inline JSON as one argv token) ----

const FILE_ATTEST = '{"from":"P","to":"A","did":"wrote the plan from a file"}';

test("#31: --attest-file reads JSON from disk", () => {
  const cwd = freshCwd();
  try {
    writeFileSync(join(cwd, "att.json"), FILE_ATTEST, "utf8");
    const r = parseOrchestrateCliArgs(["a", "--session", "s1", "--attest-file", "att.json", "--cwd", cwd], "/unused");
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.attestError, undefined);
    assert.equal(r.attest?.did, "wrote the plan from a file");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("#31: --attest-file resolves against --cwd even when --cwd comes later in argv", () => {
  const cwd = freshCwd();
  try {
    writeFileSync(join(cwd, "att.json"), FILE_ATTEST, "utf8");
    // the flag is parsed BEFORE --cwd is known, so resolution must be deferred
    const r = parseOrchestrateCliArgs(["a", "--attest-file", "att.json", "--cwd", cwd], "/unused");
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.attestError, undefined);
    assert.equal(r.attest?.from, "P");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("#31: --attest-file on a missing path sets attestError", () => {
  const cwd = freshCwd();
  try {
    const r = parseOrchestrateCliArgs(["a", "--attest-file", "nope.json", "--cwd", cwd], "/unused");
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.match(r.attestError ?? "", /could not read the attest file/);
    assert.equal(r.attest, null);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("#31: --attest and --attest-file together are rejected", () => {
  const cwd = freshCwd();
  try {
    writeFileSync(join(cwd, "att.json"), FILE_ATTEST, "utf8");
    const r = parseOrchestrateCliArgs(
      ["a", "--attest", FILE_ATTEST, "--attest-file", "att.json", "--cwd", cwd],
      "/unused",
    );
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.match(r.attestError ?? "", /not both/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("#31: --attest-file with no argument sets attestError", () => {
  const r = parseOrchestrateCliArgs(["a", "--attest-file"], "/tmp");
  assert.ok(!("error" in r));
  if ("error" in r) return;
  assert.match(r.attestError ?? "", /requires a path argument/);
});

test("#31: --attest-file tolerates CRLF line endings", () => {
  const cwd = freshCwd();
  try {
    const crlf = '{\r\n"from":"P",\r\n"to":"A",\r\n"did":"crlf attest"\r\n}\r\n';
    writeFileSync(join(cwd, "att.json"), crlf, "utf8");
    const r = parseOrchestrateCliArgs(["a", "--attest-file", "att.json", "--cwd", cwd], "/unused");
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.attestError, undefined);
    assert.equal(r.attest?.did, "crlf attest");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("#31: --attest-file tolerates a UTF-8 BOM (PowerShell 5.1 Set-Content -Encoding utf8)", () => {
  const cwd = freshCwd();
  try {
    writeFileSync(join(cwd, "att.json"), "\uFEFF" + FILE_ATTEST, "utf8");
    const r = parseOrchestrateCliArgs(["a", "--attest-file", "att.json", "--cwd", cwd], "/unused");
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.attestError, undefined, "a BOM must not reject the documented win32 recipe");
    assert.equal(r.attest?.did, "wrote the plan from a file");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("#31: win32 help shows the file form; posix help keeps the inline examples", () => {
  const win = renderOrchestrateHelp("win32");
  assert.match(win, /--attest-file/);
  assert.ok(!win.includes("--attest '{"), "win32 help must not suggest inline JSON");
  const linux = renderOrchestrateHelp("linux");
  assert.ok(linux.includes("--attest '{"), "posix help keeps the inline examples");
  assert.match(linux, /--attest <json> \| --attest-file <path>/);
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

// ── CYCLE-COMPLETION-01 (030): D-close preflight ────────────────────────────
// A cycle may not close over unfinished work, and a refusal must leave state,
// the PABCD ledger and the goalplan all untouched — the preflight runs before
// any write precisely so that "FSM idle, ledger done, goalplan unfinished"
// cannot happen.

/** CHECK-BINDING-01 compares source identity, so these cases need a real repo. */
function boundCwd(): string {
  return gitRepo();
}

function seedBoundCycleAtC(cwd: string, id: string, slug: string, taskStatus: "pending" | "done") {
  const plan = buildGoalplan({ objective: "cycle completion gate" });
  plan.slug = slug;
  plan.workPhases = [
    {
      id: "wp-1",
      title: "first",
      status: "in_progress",
      tasks: [{
        id: "t-1",
        title: "the work",
        status: taskStatus,
        ...(taskStatus === "done" ? { outcome: "focused tests passed" } : {}),
      }],
      criteriaIds: [],
    },
    { id: "wp-2", title: "second", status: "pending", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";
  writeGoalplan(cwd, plan);
  const epoch = "c-test-epoch";
  writeState(cwd, { ...defaultState(id), phase: "C", slug, checkEpoch: epoch, flags: { interview: false, auditPassed: true, checkPassed: false } });
  seedReceipt(cwd, id, epoch);
}

/**
 * A receipt the C>D gate accepts (075). These cases predate CHECK-BINDING-01 and
 * exist to exercise CYCLE-COMPLETION-01, so they need a valid one to reach it.
 */
function seedReceipt(cwd: string, id: string, epoch: string): string {
  const dir = join(cwd, STATE_DIR, "evidence", id);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, "test-receipt.json");
  writeFileSync(p, JSON.stringify({
    kind: "test",
    sourceIdentity: captureSourceIdentity(cwd, { excludeCodexclawArtifacts: true }),
    command: "npm test",
    exitCode: 0,
    createdAt: new Date().toISOString(),
    ownerSessionId: id,
    checkEpoch: epoch,
  }));
  return p;
}

function goalplanPath(cwd: string, slug: string): string {
  return join(cwd, STATE_DIR, "goalplans", slug, "goalplan.json");
}

const dAttest = (id: string) => JSON.stringify({
  from: "C", to: "D", did: "ran the suite", checkOutput: "722 pass", exitCode: 0, workPhaseId: "wp-1",
  testReceiptPath: `.codexclaw/evidence/${id}/test-receipt.json`,
});

test("D-close is refused while the active work-phase still has open tasks, and writes nothing", () => {
  const cwd = boundCwd();
  const id = "cycle-pending";
  seedBoundCycleAtC(cwd, id, "cycle-gate-pending", "pending");
  const before = readFileSync(goalplanPath(cwd, "cycle-gate-pending"), "utf8");

  const args = parseOrchestrateCliArgs(["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 1);
  assert.match(r.output, /open task/);
  assert.match(r.output, /t-1/);
  assert.match(r.output, /CYCLE-COMPLETION-01/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(ledgerLines(cwd).length, 0);
  assert.equal(readFileSync(goalplanPath(cwd, "cycle-gate-pending"), "utf8"), before);
});

test("D-close succeeds once the tasks are done, closing the phase and starting the next", () => {
  const cwd = boundCwd();
  const id = "cycle-done";
  seedBoundCycleAtC(cwd, id, "cycle-gate-done", "done");

  const args = parseOrchestrateCliArgs(["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 0, r.output);
  assert.match(r.output, /close target wp-1 is complete/);
  assert.equal(readState(cwd, id).phase, "IDLE");
  const plan = JSON.parse(readFileSync(goalplanPath(cwd, "cycle-gate-done"), "utf8"));
  assert.equal(plan.workPhases[0].status, "done");
  assert.equal(plan.workPhases[1].status, "in_progress");
  assert.equal(plan.activeWorkPhaseId, "wp-2");
  assert.equal(ledgerLines(cwd).filter((l) => l.reason === "done").length, 1);
});

test("D-close on a bound session is refused when the goalplan cannot be read", () => {
  const cwd = boundCwd();
  const id = "cycle-unreadable";
  seedBoundCycleAtC(cwd, id, "cycle-gate-gone", "done");
  // hand-editing goalplans is ordinary practice here, so a missing file must not
  // become the cheapest way past the gate
  rmSync(goalplanPath(cwd, "cycle-gate-gone"), { force: true });

  const args = parseOrchestrateCliArgs(["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 1);
  assert.match(r.output, /could not be read/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(ledgerLines(cwd).length, 0);
});

// #49: a plan whose work-phases are ALL done is complete, not broken. Refusing D
// here stranded the cycle, and the reported workaround was to write a finished
// phase back to in_progress purely to satisfy this gate — corrupting the record
// to satisfy a check about the record. It closes now.
test("D-close succeeds when every work-phase is already done", () => {
  const cwd = boundCwd();
  const id = "cycle-all-done";
  const slug = "cycle-gate-complete";
  const plan = buildGoalplan({ objective: "all phases done" });
  plan.slug = slug;
  plan.workPhases = [{ id: "wp-1", title: "closed", status: "done", tasks: [], criteriaIds: [] }];
  plan.activeWorkPhaseId = null;
  writeGoalplan(cwd, plan);
  const epoch = "c-test-epoch";
  writeState(cwd, { ...defaultState(id), phase: "C", slug, checkEpoch: epoch, flags: { interview: false, auditPassed: true, checkPassed: false } });
  seedReceipt(cwd, id, epoch);

  const args = parseOrchestrateCliArgs(["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 0, r.output);
  // 050 wp5 §40 Z2: an all-done plan closes the cycle only. It mints no recovery
  // marker, and the deadlock wording belongs to a plan that still has open work.
  assert.doesNotMatch(r.output, /blocked or superseded/);
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
  assert.equal(ledgerLines(cwd).length, 1);
});

// The gate still exists — it just names the two REAL failures instead.
test("D-close is refused when the bound goalplan is empty", () => {
  const cwd = boundCwd();
  const id = "cycle-empty-plan";
  const slug = "cycle-gate-empty";
  const plan = buildGoalplan({ objective: "no phases registered" });
  plan.slug = slug;
  plan.workPhases = [];
  plan.activeWorkPhaseId = null;
  writeGoalplan(cwd, plan);
  const epoch = "c-test-epoch";
  writeState(cwd, { ...defaultState(id), phase: "C", slug, checkEpoch: epoch, flags: { interview: false, auditPassed: true, checkPassed: false } });
  seedReceipt(cwd, id, epoch);

  const args = parseOrchestrateCliArgs(["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 1);
  assert.match(r.output, /the plan is empty/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(ledgerLines(cwd).length, 0);
});

test("D-close is refused when every remaining work-phase is blocked", () => {
  const cwd = boundCwd();
  const id = "cycle-all-blocked";
  const slug = "cycle-gate-blocked";
  const plan = buildGoalplan({ objective: "everything blocked" });
  plan.slug = slug;
  plan.workPhases = [{ id: "wp-1", title: "stuck", status: "blocked", tasks: [], criteriaIds: [] }];
  plan.activeWorkPhaseId = null;
  writeGoalplan(cwd, plan);
  const epoch = "c-test-epoch";
  writeState(cwd, { ...defaultState(id), phase: "C", slug, checkEpoch: epoch, flags: { interview: false, auditPassed: true, checkPassed: false } });
  seedReceipt(cwd, id, epoch);

  const args = parseOrchestrateCliArgs(["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 1);
  assert.match(r.output, /Dependency deadlock: work-phase wp-1 is blocked/);
  assert.equal(readState(cwd, id).phase, "C");
});

test("an unbound (HITL) session closes its cycle exactly as before", () => {
  const cwd = freshCwd();
  const id = "cycle-hitl";
  writeState(cwd, { ...defaultState(id), phase: "C", flags: { interview: false, auditPassed: true, checkPassed: false } });

  const args = parseOrchestrateCliArgs(["d", "--session", id, "--cwd", cwd, "--attest", '{"from":"C","to":"D","did":"ran the suite","checkOutput":"722 pass","exitCode":0}'], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 0);
  // 050 wp5 §35-1: an unbound close never touches the goalplan lock, so it keeps the
  // pre-wp5 wording. The bound path is the only one that reports a close target.
  assert.equal(
    r.output,
    `orchestrate D: current=C -> IDLE (C → IDLE, cycle closed, session ${id})`,
  );
  assert.doesNotMatch(r.output, /close target/);
  assert.equal(readState(cwd, id).phase, "IDLE");
});

test("070: C>D without exitCode is refused, and the CLI writes nothing", () => {
  const cwd = freshCwd();
  const id = "exit-missing";
  writeState(cwd, { ...defaultState(id), phase: "C", flags: { interview: false, auditPassed: true, checkPassed: false } });

  const args = parseOrchestrateCliArgs(["d", "--session", id, "--cwd", cwd, "--attest",
    '{"from":"C","to":"D","did":"ran the suite","checkOutput":"1702 pass"}'], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 1);
  assert.match(r.output, /exitCode/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(ledgerLines(cwd).length, 0);
});


// ── SOURCE-DELTA-01 (050): B>C source delta ────────────────────────────────
// B is the implementation phase. If the source is byte-identical to what it was
// on entry to B, nothing was implemented there — the work happened earlier and B
// is being used as a rubber stamp.

function gitRepo(): string {
  const cwd = freshCwd();
  const run = (...a: string[]) => spawnSync("git", a, { cwd, encoding: "utf8" });
  run("init", "-q");
  run("config", "user.email", "t@example.com");
  run("config", "user.name", "t");
  writeFileSync(join(cwd, "seed.txt"), "seed\n");
  run("add", "-A");
  run("commit", "-qm", "seed");
  return cwd;
}

function seedAtB(cwd: string, id: string) {
  writeState(cwd, {
    ...defaultState(id),
    phase: "B",
    flags: { interview: false, auditPassed: true, checkPassed: false },
    phaseEntrySource: captureSourceIdentity(cwd, { excludeCodexclawArtifacts: true }),
  });
}

const C_ATTEST = '{"from":"B","to":"C","did":"implemented the slice"}';

test("B>C is refused when the source never changed during B", () => {
  const cwd = gitRepo();
  seedAtB(cwd, "delta-none");

  const args = parseOrchestrateCliArgs(["c", "--session", "delta-none", "--cwd", cwd, "--attest", C_ATTEST], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 1);
  assert.match(r.output, /source is unchanged/);
  assert.match(r.output, /SOURCE-DELTA-01/);
  assert.equal(readState(cwd, "delta-none").phase, "B");
});

test("B>C passes once B actually changed something", () => {
  const cwd = gitRepo();
  seedAtB(cwd, "delta-yes");
  writeFileSync(join(cwd, "implemented.ts"), "export const x = 1;\n");

  const args = parseOrchestrateCliArgs(["c", "--session", "delta-yes", "--cwd", cwd, "--attest", C_ATTEST], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 0);
  assert.equal(readState(cwd, "delta-yes").phase, "C");
});

test("B>C without a snapshot (legacy session or no git) is left alone", () => {
  const cwd = freshCwd(); // not a repo, and no phaseEntrySource
  writeState(cwd, { ...defaultState("delta-legacy"), phase: "B", flags: { interview: false, auditPassed: true, checkPassed: false } });

  const args = parseOrchestrateCliArgs(["c", "--session", "delta-legacy", "--cwd", cwd, "--attest", C_ATTEST], cwd);
  assert.ok(!("error" in args));
  const r = runOrchestrateCli(args as never);

  assert.equal(r.code, 0);
  assert.equal(readState(cwd, "delta-legacy").phase, "C");
});

test("entering B snapshots the source, and leaving B clears it", () => {
  const cwd = gitRepo();
  writeState(cwd, { ...defaultState("delta-life"), phase: "A", flags: { interview: false, auditPassed: false, checkPassed: false } });

  const toB = parseOrchestrateCliArgs(["b", "--session", "delta-life", "--cwd", cwd, "--attest",
    '{"from":"A","to":"B","did":"audited","auditOutput":"VERDICT: PASS","auditVerdict":"pass"}'], cwd);
  assert.ok(!("error" in toB));
  assert.equal(runOrchestrateCli(toB as never).code, 0);
  const atB = readState(cwd, "delta-life");
  assert.equal(atB.phase, "B");
  assert.ok(atB.phaseEntrySource, "entering B must snapshot the source");
  assert.equal(atB.phaseEntrySource?.kind, "resolved");

  writeFileSync(join(cwd, "work.ts"), "export const y = 2;\n");
  const toC = parseOrchestrateCliArgs(["c", "--session", "delta-life", "--cwd", cwd, "--attest", C_ATTEST], cwd);
  assert.ok(!("error" in toC));
  assert.equal(runOrchestrateCli(toC as never).code, 0);
  assert.equal(readState(cwd, "delta-life").phaseEntrySource, null, "a snapshot must not outlive its phase");
});

test("wp4: gated attest binds to dependency-aware effective workPhaseId", () => {
  const cwd = freshCwd();
  try {
    writeState(cwd, { ...defaultState("dep-bind"), phase: "B" as never, slug: "dep-bind" });
    const plan = buildGoalplan({ objective: "dependency binding" });
    plan.slug = "dep-bind";
    plan.schemaVersion = 3;
    plan.activeWorkPhaseId = "blocked-child";
    plan.workPhases = [
      { id: "upstream", title: "upstream", status: "blocked", blockedReason: "external", dependsOn: [], tasks: [], criteriaIds: [] },
      { id: "blocked-child", title: "blocked child", status: "in_progress", dependsOn: ["upstream"], tasks: [], criteriaIds: [] },
      { id: "ready", title: "ready", status: "pending", dependsOn: [], tasks: [], criteriaIds: [] },
    ];
    writeGoalplan(cwd, plan);

    const stale = runOrchestrateCli({
      verb: "C",
      attest: { from: "B", to: "C", did: "worked", workPhaseId: "blocked-child" },
      session: "dep-bind",
      cwd,
      json: false,
    });
    assert.equal(stale.code, 1);
    assert.match(stale.output, /active work-phase is ready/);

    const ready = runOrchestrateCli({
      verb: "C",
      attest: { from: "B", to: "C", did: "worked", workPhaseId: "ready" },
      session: "dep-bind",
      cwd,
      json: false,
    });
    assert.equal(ready.code, 0, ready.output);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("wp4: D-close reports dependency deadlock and writes nothing", () => {
  const cwd = boundCwd();
  const id = "cycle-dependency-deadlock";
  const slug = "cycle-dependency-deadlock";
  const plan = buildGoalplan({ objective: "dependency deadlock" });
  plan.slug = slug;
  plan.schemaVersion = 3;
  plan.workPhases = [
    { id: "wp-1", title: "upstream", status: "blocked", blockedReason: "vendor", dependsOn: [], tasks: [], criteriaIds: [] },
    { id: "wp-2", title: "downstream", status: "pending", dependsOn: ["wp-1"], tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = null;
  writeGoalplan(cwd, plan);
  const before = readFileSync(goalplanPath(cwd, slug), "utf8");
  const epoch = "c-test-epoch";
  writeState(cwd, { ...defaultState(id), phase: "C", slug, checkEpoch: epoch, flags: { interview: false, auditPassed: true, checkPassed: false } });
  seedReceipt(cwd, id, epoch);

  const args = parseOrchestrateCliArgs(["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)], cwd);
  assert.ok(!("error" in args));
  const result = runOrchestrateCli(args as never);
  assert.equal(result.code, 1);
  assert.match(result.output, /Dependency deadlock/);
  assert.match(result.output, /wp-2 waits for work-phase wp-1 \(blocked\)/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(ledgerLines(cwd).length, 0);
  assert.equal(readFileSync(goalplanPath(cwd, slug), "utf8"), before);
});

function goalplanLedgerRows(cwd: string, slug: string): Array<Record<string, unknown>> {
  const path = join(cwd, STATE_DIR, "goalplans", slug, "ledger.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function parsedDclose(cwd: string, id: string) {
  const parsed = parseOrchestrateCliArgs(
    ["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)],
    cwd,
  );
  assert.ok(!("error" in parsed));
  return parsed as never;
}

function assertOnlyFirstPhaseClosed(cwd: string, slug: string): void {
  const plan = readGoalplan(cwd, slug)!;
  assert.equal(plan.workPhases.find((workPhase) => workPhase.id === "wp-1")?.status, "done");
  assert.equal(plan.workPhases.find((workPhase) => workPhase.id === "wp-2")?.status, "in_progress");
  assert.equal(plan.activeWorkPhaseId, "wp-2");
  assert.equal(
    goalplanLedgerRows(cwd, slug).filter(
      (row) => row.event === "workphase_done" && row.detail === "closed wp-1",
    ).length,
    1,
  );
}

test("past done phase id in C does not become a recovery marker", () => {
  const cwd = boundCwd();
  const id = "past-done-c";
  const slug = "past-done-c-plan";
  const plan = buildGoalplan({ objective: "past done phase" });
  plan.slug = slug;
  plan.workPhases = [
    { id: "wp-1", title: "past", status: "done", tasks: [], criteriaIds: [] },
    { id: "wp-2", title: "current", status: "in_progress", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-2";
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id),
    phase: "C",
    slug,
    checkEpoch: "c-past",
    flags: { interview: false, auditPassed: true, checkPassed: true },
  });
  seedReceipt(cwd, id, "c-past");

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 1);
  assert.match(result.output, /active work-phase is wp-2/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
  assert.equal(readGoalplan(cwd, slug)!.workPhases[1].status, "in_progress");
});

test("IDLE D attest without a matching marker is refused", () => {
  const cwd = boundCwd();
  const id = "idle-no-marker";
  const slug = "idle-no-marker-plan";
  const plan = buildGoalplan({ objective: "idle without marker" });
  plan.slug = slug;
  plan.workPhases = [{ id: "wp-1", title: "past", status: "done", tasks: [], criteriaIds: [] }];
  plan.activeWorkPhaseId = null;
  writeGoalplan(cwd, plan);
  writeState(cwd, { ...defaultState(id), slug });

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 1);
  assert.match(result.output, /cannot transition|illegal|IDLE/);
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
});

test("a marker from another session cannot authorize recovery", () => {
  const cwd = boundCwd();
  const id = "marker-owner";
  const slug = "marker-owner-plan";
  const plan = buildGoalplan({ objective: "foreign marker" });
  plan.slug = slug;
  plan.workPhases = [
    { id: "wp-1", title: "past", status: "done", tasks: [], criteriaIds: [] },
    { id: "wp-2", title: "current", status: "in_progress", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-2";
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id),
    phase: "C",
    slug,
    checkEpoch: "c-owner",
    dcloseRecovery: {
      sessionId: "different-session",
      checkEpoch: "c-owner",
      closedWorkPhaseId: "wp-1",
      nextWorkPhaseId: "wp-2",
    },
  });
  seedReceipt(cwd, id, "c-owner");

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 1);
  assert.match(result.output, /active work-phase is wp-2/);
  assert.equal(readState(cwd, id).dcloseRecovery, null);
  assert.equal(readGoalplan(cwd, slug)!.workPhases[1].status, "in_progress");
});

test("D-close retry after goalplan commit closes the fixed phase only once", () => {
  const cwd = boundCwd();
  const id = "retry-after-goalplan";
  const slug = "retry-after-goalplan-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterGoalplanCommit: () => { throw new Error("fail after goalplan commit"); },
    }),
    /fail after goalplan commit/,
  );
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(
    goalplanLedgerRows(cwd, slug).filter((row) => row.detail === "closed wp-1").length,
    0,
  );
  assert.deepEqual(readState(cwd, id).dcloseRecovery, {
    sessionId: id,
    checkEpoch: "c-test-epoch",
    closedWorkPhaseId: "wp-1",
    // §48: the marker carries the successor this close picked, so the retry does not
    // have to infer it from a file a later edit may have touched.
    nextWorkPhaseId: "wp-2",
  });

  const retry = runOrchestrateCli(args);
  assert.equal(retry.code, 0, retry.output);
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
  assertOnlyFirstPhaseClosed(cwd, slug);
  assert.equal(
    ledgerLines(cwd).filter(
      (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE",
    ).length,
    1,
  );
});

test("D-close retry after the recovery marker write closes the fixed phase like a normal close", () => {
  // §40 Z1: the earlier draft had recovery patch only the target status, which left
  // activeWorkPhaseId on a done phase and logged a false `started wp-1`. Both paths
  // now go through closeFixedWorkPhase(), so the recovered plan must equal what an
  // uninterrupted close would have written.
  const cwd = boundCwd();
  const id = "retry-after-marker";
  const slug = "retry-after-marker-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  const reference = boundCwd();
  seedBoundCycleAtC(reference, "reference-close", "reference-close-plan", "done");
  const uninterrupted = runOrchestrateCli(parsedDclose(reference, "reference-close"));
  assert.equal(uninterrupted.code, 0, uninterrupted.output);
  const referencePlan = readGoalplan(reference, "reference-close-plan")!;

  assert.throws(
    () => runOrchestrateCli(args, {
      afterRecoveryMarkerWrite: () => { throw new Error("fail right after the marker"); },
    }),
    /fail right after the marker/,
  );
  // The marker survives and the plan is untouched: this is step 1 of the §5 table.
  assert.equal(readState(cwd, id).phase, "C");
  assert.deepEqual(readState(cwd, id).dcloseRecovery, {
    sessionId: id,
    checkEpoch: "c-test-epoch",
    closedWorkPhaseId: "wp-1",
    // §48: the marker carries the successor this close picked, so the retry does not
    // have to infer it from a file a later edit may have touched.
    nextWorkPhaseId: "wp-2",
  });
  assert.equal(readGoalplan(cwd, slug)!.workPhases.find((wp) => wp.id === "wp-1")!.status, "in_progress");

  const retry = runOrchestrateCli(args);
  assert.equal(retry.code, 0, retry.output);
  const recovered = readGoalplan(cwd, slug)!;
  assert.deepEqual(
    {
      workPhases: recovered.workPhases.map((wp) => ({ id: wp.id, status: wp.status })),
      activeWorkPhaseId: recovered.activeWorkPhaseId,
    },
    {
      workPhases: referencePlan.workPhases.map((wp) => ({ id: wp.id, status: wp.status })),
      activeWorkPhaseId: referencePlan.activeWorkPhaseId,
    },
  );
  assert.equal(recovered.workPhases.find((wp) => wp.id === "wp-1")!.status, "done");
  assert.equal(recovered.workPhases.find((wp) => wp.id === "wp-2")!.status, "in_progress");
  assert.equal(recovered.activeWorkPhaseId, "wp-2");
  // The started row names the successor, not the phase that just closed.
  assert.deepEqual(
    goalplanLedgerRows(cwd, slug).filter((row) => row.event === "workphase_started").map((row) => row.detail),
    ["started wp-2"],
  );
  assert.deepEqual(
    goalplanLedgerRows(cwd, slug).filter((row) => row.event === "workphase_done").map((row) => row.detail),
    ["closed wp-1"],
  );
  assert.equal(readState(cwd, id).dcloseRecovery, null);
  rmSync(reference, { recursive: true, force: true });
});

test("all-done close writes its PABCD row inside the first lock and takes no finalization lock", () => {
  // §40 Z2: all-done mints no marker. If its close row waited for a second lock and
  // that lock failed, the retry would hit `IDLE -> D` with nothing to recover from
  // and the row would be lost permanently.
  const cwd = boundCwd();
  const id = "all-done-single-lock";
  const slug = "all-done-single-lock-plan";
  const plan = buildGoalplan({ objective: "already finished" });
  plan.slug = slug;
  plan.workPhases = [
    { id: "wp-1", title: "first", status: "done", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = null;
  writeGoalplan(cwd, plan);
  writeState(cwd, { ...defaultState(id), phase: "C", slug, orchestrationActive: true, checkEpoch: "c-all-done" });
  // CHECK-BINDING-01 runs before the all-done branch (orchestrate-cli.ts:600-607), so
  // without a receipt this test would refuse at the gate and never reach its subject.
  seedReceipt(cwd, id, "c-all-done");

  let stateWrites = 0;
  const result = runOrchestrateCli(parsedDclose(cwd, id), {
    afterStateWrite: () => {
      stateWrites += 1;
      // A lock held from here on would break a finalization pass. all-done must be
      // finished already, so this proves there is no second critical section.
      mkdirSync(goalplanWriteLockDir(cwd, slug), { recursive: false });
    },
  });

  assert.equal(result.code, 0, result.output);
  // §39 Y3 makes a failed finalization lock return code 0 too, so code alone cannot
  // tell "no second lock" from "second lock timed out". The output must be silent
  // about pending finalization.
  assert.doesNotMatch(result.output, /finalization is pending/);
  assert.equal(stateWrites, 1);
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
  assert.deepEqual(
    ledgerLines(cwd).filter((row) => row.sessionId === id && row.from === "C" && row.to === "IDLE")
      .map((row) => [row.checkEpoch, row.closedWorkPhaseId]),
    [["c-all-done", null]],
  );
  // No goalplan row and no plan mutation for a cycle-only close.
  assert.deepEqual(goalplanLedgerRows(cwd, slug).filter((row) => row.event === "workphase_done"), []);
  assert.equal(readGoalplan(cwd, slug)!.activeWorkPhaseId, null);
});

test("recovery is refused when the fixed target gained an open task after its marker", () => {
  // §41 W1: the marker survives edits, and add-task can put a pending task on a live
  // phase between the crash and the retry. The gate lives in closeFixedWorkPhase(),
  // so recovery cannot slip past it. The marker is kept on purpose — wiping it would
  // remove the only route back.
  const cwd = boundCwd();
  const id = "recovery-target-gained-task";
  const slug = "recovery-target-gained-task-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterRecoveryMarkerWrite: () => { throw new Error("fail right after the marker"); },
    }),
    /fail right after the marker/,
  );

  const plan = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...plan,
    workPhases: plan.workPhases.map((wp) =>
      wp.id === "wp-1"
        ? { ...wp, tasks: [...wp.tasks, { id: "t-late", title: "added late", status: "pending" as const }] }
        : wp
    ),
  });
  const before = readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8");

  const retry = runOrchestrateCli(args);
  assert.equal(retry.code, 1);
  assert.match(retry.output, /recovery target wp-1 gained 1 open task\(s\) after its marker was written/);
  assert.match(retry.output, /The recovery marker was kept/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.deepEqual(readState(cwd, id).dcloseRecovery, {
    sessionId: id,
    checkEpoch: "c-test-epoch",
    closedWorkPhaseId: "wp-1",
    // §48: the marker carries the successor this close picked, so the retry does not
    // have to infer it from a file a later edit may have touched.
    nextWorkPhaseId: "wp-2",
  });
  assert.equal(readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8"), before);
  assert.deepEqual(goalplanLedgerRows(cwd, slug).filter((row) => row.event === "workphase_done"), []);
});

test("recovery is refused when the fixed target became blocked after its marker", () => {
  const cwd = boundCwd();
  const id = "recovery-target-blocked";
  const slug = "recovery-target-blocked-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterRecoveryMarkerWrite: () => { throw new Error("fail right after the marker"); },
    }),
    /fail right after the marker/,
  );

  const plan = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...plan,
    workPhases: plan.workPhases.map((wp) =>
      wp.id === "wp-1" ? { ...wp, status: "blocked" as const } : wp
    ),
  });

  const retry = runOrchestrateCli(args);
  assert.equal(retry.code, 1);
  assert.match(retry.output, /recovery target wp-1 is now blocked/);
  assert.match(retry.output, /The recovery marker was kept/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.notEqual(readState(cwd, id).dcloseRecovery, null);
});

test("recovery is refused when the fixed target lost a dependency after its marker", () => {
  // §41 W5: the third gate closeFixedWorkPhase() owns. add-dependency can put an
  // unmet edge on the fixed target between the crash and the retry, and the chat
  // 3-scenario loop already covers it. Without this case the CLI
  // `dependencies_unmet` branch (§6.3) has no regression at all, so deleting it or
  // letting it wipe the marker would still leave the focused suite green.
  const cwd = boundCwd();
  const id = "recovery-target-lost-dependency";
  const slug = "recovery-target-lost-dependency-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterRecoveryMarkerWrite: () => { throw new Error("fail right after the marker"); },
    }),
    /fail right after the marker/,
  );

  // wp-2 is the pending successor seedBoundCycleAtC() already creates, so this edge
  // is unmet without inventing a phase the integrity check would reject.
  const plan = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...plan,
    workPhases: plan.workPhases.map((wp) =>
      wp.id === "wp-1" ? { ...wp, dependsOn: ["wp-2"] } : wp
    ),
  });
  const before = readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8");

  const retry = runOrchestrateCli(args);
  assert.equal(retry.code, 1);
  assert.match(retry.output, /recovery target wp-1 now waits for wp-2/);
  assert.match(retry.output, /The recovery marker was kept/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.deepEqual(readState(cwd, id).dcloseRecovery, {
    sessionId: id,
    checkEpoch: "c-test-epoch",
    closedWorkPhaseId: "wp-1",
    // §48: the marker carries the successor this close picked, so the retry does not
    // have to infer it from a file a later edit may have touched.
    nextWorkPhaseId: "wp-2",
  });
  assert.equal(readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8"), before);
  assert.deepEqual(goalplanLedgerRows(cwd, slug).filter((row) => row.event === "workphase_done"), []);
});

test("recovery is refused when a pending task is hidden under the already-closed target", () => {
  // §43: the plan commit really landed here — wp-1 is done and the cursor moved to
  // wp-2 — so a caller-side commit test would skip the helper entirely. Neither
  // integrity helper D-close calls rejects a done phase holding an open task
  // (goalplan.ts:943 owns that shape and this path never called it), so the gate has
  // to come from closeFixedWorkPhase() running unconditionally.
  const cwd = boundCwd();
  const id = "recovery-done-hides-pending";
  const slug = "recovery-done-hides-pending-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterGoalplanCommit: () => { throw new Error("fail after goalplan commit"); },
    }),
    /fail after goalplan commit/,
  );

  // The commit landed before the crash: target done, cursor already on the successor.
  const plan = readGoalplan(cwd, slug)!;
  assert.equal(plan.workPhases.find((wp) => wp.id === "wp-1")!.status, "done");
  assert.equal(plan.activeWorkPhaseId, "wp-2");
  writeGoalplan(cwd, {
    ...plan,
    workPhases: plan.workPhases.map((wp) =>
      wp.id === "wp-1"
        ? { ...wp, tasks: [...wp.tasks, { id: "t-hidden", title: "snuck in", status: "pending" as const }] }
        : wp
    ),
  });
  const before = readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8");

  const retry = runOrchestrateCli(args);

  assert.equal(retry.code, 1);
  assert.match(retry.output, /recovery target wp-1 gained 1 open task\(s\) after its marker was written/);
  assert.match(retry.output, /The recovery marker was kept/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.notEqual(readState(cwd, id).dcloseRecovery, null);
  assert.equal(readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8"), before);
});

for (const forgery of [
  {
    name: "a null cursor stranding an in_progress phase",
    edit: (plan: Goalplan): Goalplan => ({
      ...plan,
      activeWorkPhaseId: null,
      workPhases: plan.workPhases.map((wp) =>
        wp.id === "wp-1" ? { ...wp, status: "done" as const }
          : wp.id === "wp-2" ? { ...wp, status: "in_progress" as const } : wp
      ),
    }),
    cursor: "wp-2",
  },
  {
    // §55: a cursor on a phase that is NOT the recorded successor and cannot run. The
    // recorded successor wp-2 stays runnable, so the retry still settles; the forged
    // cursor is simply not what decides the shape. Pointing this at wp-2 itself would
    // not be a forgery case at all — an unready successor is refused outright now,
    // which the dedicated dependencies_unmet test covers.
    name: "a cursor on a phase that cannot run",
    edit: (plan: Goalplan): Goalplan => ({
      ...plan,
      activeWorkPhaseId: "wp-3",
      workPhases: [
        ...plan.workPhases,
        { id: "wp-3", title: "third", status: "blocked" as const, tasks: [], criteriaIds: [] },
      ],
    }),
    cursor: "wp-2",
  },
] as const) {
  test(`recovery rebuilds the cursor from ${forgery.name}`, () => {
    // §45: predicates were forgeable four different ways, so the helper compares the
    // plan against the one it would produce. Whatever the forgery, the retry lands on
    // that computed shape instead of trusting the file.
    const cwd = boundCwd();
    const id = `recovery-forgery-${forgery.name.replace(/\s+/g, "-").slice(0, 30)}`;
    const slug = `${id}-plan`;
    seedBoundCycleAtC(cwd, id, slug, "done");
    const args = parsedDclose(cwd, id);

    assert.throws(
      () => runOrchestrateCli(args, {
        afterRecoveryMarkerWrite: () => { throw new Error("fail right after the marker"); },
      }),
      /fail right after the marker/,
    );
    writeGoalplan(cwd, forgery.edit(readGoalplan(cwd, slug)!));

    const retry = runOrchestrateCli(args);

    assert.equal(retry.code, 0, retry.output);
    const repaired = readGoalplan(cwd, slug)!;
    assert.equal(repaired.activeWorkPhaseId, forgery.cursor);
    assert.equal(repaired.workPhases.find((wp) => wp.id === "wp-1")!.status, "done");
    assert.equal(readState(cwd, id).phase, "IDLE");
    assert.equal(readState(cwd, id).dcloseRecovery, null);
  });
}

test("a marker naming its own target as successor points at reset, not at a plan fix", () => {
  // §51: the other successor_lost reasons are cleared by editing the plan, but this one
  // cannot be — the marker itself is wrong. So the refusal names a command that actually
  // runs, including the --session every mutating verb requires.
  const cwd = boundCwd();
  const id = "recovery-self-successor";
  const slug = "recovery-self-successor-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const statePath = join(cwd, STATE_DIR, SESSIONS_SUBDIR, `${id}.json`);
  const seededState = JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>;
  writeFileSync(statePath, `${JSON.stringify({
    ...seededState,
    dcloseRecovery: {
      sessionId: id,
      checkEpoch: "c-test-epoch",
      closedWorkPhaseId: "wp-1",
      nextWorkPhaseId: "wp-1",
    },
  })}\n`);
  const before = readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8");

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 1);
  assert.match(result.output, /names that same work-phase as its successor/);
  assert.match(result.output, new RegExp(`cxc orchestrate reset --session ${id}`));
  assert.doesNotMatch(result.output, /restore that work-phase/);
  assert.equal(readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8"), before);
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(readState(cwd, id).dcloseRecovery?.nextWorkPhaseId, "wp-1");
});
test("closing an open target does not cancel progress the plan already made", () => {
  // §54: the recorded successor finished and started wp-3 on its way out. An earlier draft
  // nulled the cursor while closing the still-open target, cutting wp-3 off. A cursor is
  // preserved only when it names a different phase that is really running.
  const cwd = boundCwd();
  const id = "recovery-preserve-progress";
  const slug = "recovery-preserve-progress-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const seeded = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...seeded,
    workPhases: [
      ...seeded.workPhases,
      { id: "wp-3", title: "third", status: "pending" as const, tasks: [], criteriaIds: [] },
    ],
  });
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterRecoveryMarkerWrite: () => { throw new Error("fail right after the marker"); },
    }),
    /fail right after the marker/,
  );
  assert.equal(readState(cwd, id).dcloseRecovery?.nextWorkPhaseId, "wp-2");

  // The target never closed, but wp-2 ran and finished, starting wp-3.
  const crashed = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...crashed,
    activeWorkPhaseId: "wp-3",
    workPhases: crashed.workPhases.map((wp) =>
      wp.id === "wp-2" ? { ...wp, status: "done" as const }
        : wp.id === "wp-3" ? { ...wp, status: "in_progress" as const } : wp
    ),
  });

  const retry = runOrchestrateCli(args);

  assert.equal(retry.code, 0, retry.output);
  const repaired = readGoalplan(cwd, slug)!;
  assert.equal(repaired.activeWorkPhaseId, "wp-3");
  assert.deepEqual(
    repaired.workPhases.map((wp) => [wp.id, wp.status]),
    [["wp-1", "done"], ["wp-2", "done"], ["wp-3", "in_progress"]],
  );
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
});

test("a preserved cursor is dropped when the phase it names is not ready", () => {
  // §55: wp-3 is running but waits on wp-4, so effectiveActiveWorkPhaseId() refuses to
  // honour that cursor and answers wp-4 instead. Preserving it would write a plan whose
  // stored cursor and computed cursor disagree, and the next cycle would run a phase the
  // plan file does not point at. §54 covered only ready cursors, so this window was open.
  const cwd = boundCwd();
  const id = "recovery-preserve-unready";
  const slug = "recovery-preserve-unready-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const seeded = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...seeded,
    workPhases: [
      ...seeded.workPhases,
      { id: "wp-3", title: "third", status: "pending" as const, dependsOn: ["wp-4"], tasks: [], criteriaIds: [] },
      { id: "wp-4", title: "fourth", status: "pending" as const, tasks: [], criteriaIds: [] },
    ],
  });
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterRecoveryMarkerWrite: () => { throw new Error("fail right after the marker"); },
    }),
    /fail right after the marker/,
  );
  assert.equal(readState(cwd, id).dcloseRecovery?.nextWorkPhaseId, "wp-2");

  // wp-2 finished and left the cursor on wp-3, which still waits for wp-4.
  const crashed = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...crashed,
    activeWorkPhaseId: "wp-3",
    workPhases: crashed.workPhases.map((wp) =>
      wp.id === "wp-2" ? { ...wp, status: "done" as const }
        : wp.id === "wp-3" ? { ...wp, status: "in_progress" as const } : wp
    ),
  });

  const retry = runOrchestrateCli(args);

  assert.equal(retry.code, 0, retry.output);
  const repaired = readGoalplan(cwd, slug)!;
  assert.equal(repaired.activeWorkPhaseId, null);
  // §56: the point of dropping it. The stale explicit cursor is gone, so the derived
  // selection is the only answer left and it names the phase that can actually run.
  assert.equal(effectiveActiveWorkPhaseId(repaired), "wp-4");
  // The close still lands, and wp-3 keeps running: stopping it is not a resume's job.
  assert.equal(repaired.workPhases.find((wp) => wp.id === "wp-1")!.status, "done");
  assert.equal(repaired.workPhases.find((wp) => wp.id === "wp-3")!.status, "in_progress");
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
});

test("an already-done target still normalizes a cursor that cannot run", () => {
  // §56: an earlier draft returned already_done the moment the target was done, which
  // skipped the cursor normalization entirely. The same damaged cursors went through that
  // door — including one naming the finished target. Normalize first; the settled-shape
  // comparison is what decides whether anything is owed.
  const cwd = boundCwd();
  const id = "recovery-done-target-unready-cursor";
  const slug = "recovery-done-target-unready-cursor-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const seeded = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...seeded,
    workPhases: [
      ...seeded.workPhases,
      { id: "wp-3", title: "third", status: "pending" as const, dependsOn: ["wp-4"], tasks: [], criteriaIds: [] },
      { id: "wp-4", title: "fourth", status: "pending" as const, tasks: [], criteriaIds: [] },
    ],
  });
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterGoalplanCommit: () => { throw new Error("fail right after the plan commit"); },
    }),
    /fail right after the plan commit/,
  );
  assert.equal(readState(cwd, id).dcloseRecovery?.nextWorkPhaseId, "wp-2");

  // The commit landed, so wp-1 is done. wp-2 then finished and left the cursor on wp-3,
  // which still waits for wp-4.
  const committed = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...committed,
    activeWorkPhaseId: "wp-3",
    workPhases: committed.workPhases.map((wp) =>
      wp.id === "wp-2" ? { ...wp, status: "done" as const }
        : wp.id === "wp-3" ? { ...wp, status: "in_progress" as const } : wp
    ),
  });

  const retry = runOrchestrateCli(args);

  assert.equal(retry.code, 0, retry.output);
  const repaired = readGoalplan(cwd, slug)!;
  assert.equal(repaired.activeWorkPhaseId, null);
  assert.equal(effectiveActiveWorkPhaseId(repaired), "wp-4");
  // Statuses are untouched: normalizing a cursor is not stopping a phase.
  assert.deepEqual(
    repaired.workPhases.map((wp) => [wp.id, wp.status]),
    [["wp-1", "done"], ["wp-2", "done"], ["wp-3", "in_progress"], ["wp-4", "pending"]],
  );
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
});
test("an absent target refuses a running successor whose dependency is unmet", () => {
  // §55: deletion of the target must not decide the verdict. closeFixedWorkPhase() answers
  // successor_lost/dependencies_unmet for this same successor when the target is still in
  // the plan, so the absent path cannot activate it. §54 gated only the pending branch.
  const cwd = boundCwd();
  const id = "cli-recovery-unready-successor";
  const slug = "cli-recovery-unready-successor-plan";
  const plan = buildGoalplan({ objective: "absent target, unready successor" });
  plan.slug = slug;
  plan.workPhases = [
    { id: "wp-2", title: "next", status: "in_progress", dependsOn: ["wp-9"], tasks: [], criteriaIds: [] },
    { id: "wp-9", title: "blocker", status: "pending", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = null;
  writeGoalplan(cwd, plan);
  const before = readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8");
  writeState(cwd, {
    ...defaultState(id),
    slug,
    checkEpoch: "c-unready",
    dcloseRecovery: {
      sessionId: id,
      checkEpoch: "c-unready",
      closedWorkPhaseId: "wp-1",
      nextWorkPhaseId: "wp-2",
    },
  });

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /now waits for another work-phase/);
  // Fail closed: no plan write, no ledger row, and the marker stays for a real repair.
  assert.equal(readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8"), before);
  assert.equal(readState(cwd, id).dcloseRecovery?.nextWorkPhaseId, "wp-2");
});
test("an absent target restores the cursor onto a stranded running successor", () => {
  // §54: the recorded successor is already in_progress but the cursor was nulled, which
  // §45 established is corruption a resume must repair. Answering cleanup here cleared
  // the marker and left that phase running with no cursor pointing at it.
  const cwd = boundCwd();
  const id = "cli-recovery-stranded-successor";
  const slug = "cli-recovery-stranded-successor-plan";
  const plan = buildGoalplan({ objective: "absent target, stranded successor" });
  plan.slug = slug;
  plan.workPhases = [
    { id: "wp-2", title: "next", status: "in_progress", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = null;
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id),
    slug,
    checkEpoch: "c-stranded",
    dcloseRecovery: {
      sessionId: id,
      checkEpoch: "c-stranded",
      closedWorkPhaseId: "wp-1",
      nextWorkPhaseId: "wp-2",
    },
  });

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 0, result.output);
  const repaired = readGoalplan(cwd, slug)!;
  assert.equal(repaired.activeWorkPhaseId, "wp-2");
  // Status untouched: it was already running, only the cursor was missing.
  assert.equal(repaired.workPhases.find((wp) => wp.id === "wp-2")!.status, "in_progress");
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
});
test("recovery settles when the recorded successor already finished its own cycle", () => {
  // §51: a done successor is not a lost one. The recorded phase was started and then
  // closed by its own cycle, so refusing here would trap the session — escaping would
  // mean re-opening a completed work-phase or discarding the marker. The settled-shape
  // check answers already_done, which is the truth about this close.
  const cwd = boundCwd();
  const id = "recovery-successor-finished";
  const slug = "recovery-successor-finished-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterGoalplanCommit: () => { throw new Error("fail right after the plan commit"); },
    }),
    /fail right after the plan commit/,
  );
  assert.equal(readState(cwd, id).dcloseRecovery?.nextWorkPhaseId, "wp-2");

  // wp-2 runs to completion in the meantime, so the plan is all done while the wp-1
  // marker is still pending cleanup.
  const committed = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...committed,
    activeWorkPhaseId: null,
    workPhases: committed.workPhases.map((wp) =>
      wp.id === "wp-2" ? { ...wp, status: "done" as const } : wp
    ),
  });
  const before = readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8");

  const retry = runOrchestrateCli(args);

  assert.equal(retry.code, 0, retry.output);
  // No plan write: the close this marker describes is already reflected.
  assert.equal(readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8"), before);
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
  // And wp-2 keeps exactly one started row from its own activation.
  assert.deepEqual(
    goalplanLedgerRows(cwd, slug)
      .filter((row) => row.event === "workphase_started")
      .map((row) => row.detail),
    ["started wp-2"],
  );
  // The point of resuming at all: the rows this interrupted close still owed are
  // written even though no plan write was needed. Without them the ledger would say
  // wp-1 never closed while the plan says it did.
  assert.deepEqual(
    goalplanLedgerRows(cwd, slug)
      .filter((row) => row.event === "workphase_done")
      .map((row) => row.detail),
    ["closed wp-1"],
  );
  assert.equal(
    readFileSync(join(cwd, STATE_DIR, LEDGER_FILE), "utf8")
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((row) => row.sessionId === id && row.from === "C" && row.to === "IDLE"
        && row.closedWorkPhaseId === "wp-1").length,
    1,
  );
});
test("recovery is refused when the marker predates the successor field", () => {
  // §50: this marker could have been written before OR after the plan commit and the
  // file cannot say which, so neither a wp4 search nor a forced null is safe. Refuse and
  // keep everything, including the marker, so a human can finish it.
  const cwd = boundCwd();
  const id = "recovery-legacy-marker";
  const slug = "recovery-legacy-marker-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const statePath = join(cwd, STATE_DIR, SESSIONS_SUBDIR, `${id}.json`);
  const seededState = JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>;
  writeFileSync(statePath, `${JSON.stringify({
    ...seededState,
    dcloseRecovery: {
      sessionId: id,
      checkEpoch: "c-test-epoch",
      closedWorkPhaseId: "wp-1",
    },
  })}\n`);
  const before = readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8");

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 1);
  assert.match(result.output, /predates the successor field/);
  assert.match(result.output, /The marker was kept/);
  assert.equal(readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8"), before);
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(readState(cwd, id).dcloseRecovery?.legacy, true);
  assert.deepEqual(goalplanLedgerRows(cwd, slug).filter((row) => row.event === "workphase_done"), []);
});
test("recovery is refused when the recorded successor left the plan", () => {
  // §50: the marker names wp-2 and wp-2 is deleted between the crash and the retry. An
  // earlier draft let the search fall through to wp-3 and confirmed a close the first
  // attempt never decided, logging `started wp-3` and clearing the marker. The recorded
  // successor is binding, so this fails closed and keeps the marker for a human.
  const cwd = boundCwd();
  const id = "recovery-successor-lost";
  const slug = "recovery-successor-lost-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const seeded = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...seeded,
    workPhases: [
      ...seeded.workPhases,
      { id: "wp-3", title: "third", status: "pending" as const, tasks: [], criteriaIds: [] },
    ],
  });
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterRecoveryMarkerWrite: () => { throw new Error("fail right after the marker"); },
    }),
    /fail right after the marker/,
  );
  assert.equal(readState(cwd, id).dcloseRecovery?.nextWorkPhaseId, "wp-2");

  // wp-2 is removed, so the recorded successor no longer exists. wp-3 is still pending
  // and would have been picked by a fallback search.
  const crashed = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...crashed,
    workPhases: crashed.workPhases.filter((wp) => wp.id !== "wp-2"),
  });
  const before = readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8");

  const retry = runOrchestrateCli(args);

  assert.equal(retry.code, 1);
  assert.match(retry.output, /successor wp-2, which is no longer in the plan/);
  assert.match(retry.output, /The recovery marker was kept/);
  assert.equal(readFileSync(join(cwd, ".codexclaw/goalplans", slug, "goalplan.json"), "utf8"), before);
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(readState(cwd, id).dcloseRecovery?.nextWorkPhaseId, "wp-2");
  assert.deepEqual(
    goalplanLedgerRows(cwd, slug).filter((row) => row.event === "workphase_started"),
    [],
  );
});

test("recovery with an explicit no-successor marker does not start a phase added later", () => {
  // §50: `nextWorkPhaseId: null` is a durable decision — that close found no successor.
  // Merging null with undefined let a phase registered after the crash be started,
  // contradicting the marker. The retry must settle without touching it.
  const cwd = boundCwd();
  const id = "recovery-null-successor";
  const slug = "recovery-null-successor-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const seeded = readGoalplan(cwd, slug)!;
  // One phase only, so the close finds no successor and records null.
  writeGoalplan(cwd, {
    ...seeded,
    activeWorkPhaseId: "wp-1",
    workPhases: seeded.workPhases.filter((wp) => wp.id === "wp-1"),
  });
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterGoalplanCommit: () => { throw new Error("fail right after the plan commit"); },
    }),
    /fail right after the plan commit/,
  );
  assert.equal(readState(cwd, id).dcloseRecovery?.nextWorkPhaseId, null);

  // A new phase appears between the crash and the retry.
  const committed = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...committed,
    workPhases: [
      ...committed.workPhases,
      { id: "wp-9", title: "registered later", status: "pending" as const, tasks: [], criteriaIds: [] },
    ],
  });

  const retry = runOrchestrateCli(args);

  assert.equal(retry.code, 0, retry.output);
  const repaired = readGoalplan(cwd, slug)!;
  assert.equal(repaired.activeWorkPhaseId, null);
  assert.deepEqual(
    repaired.workPhases.map((wp) => [wp.id, wp.status]),
    [["wp-1", "done"], ["wp-9", "pending"]],
  );
  assert.deepEqual(
    goalplanLedgerRows(cwd, slug).filter((row) => row.event === "workphase_started"),
    [],
  );
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
});
test("recovery finishes the successor the marker recorded, not the one the file names", () => {
  // §48: the input that defeated every plan-only rule, run through the real CLI so the
  // marker mint, the recovery branch, both ledgers, and marker cleanup all take part.
  // A third phase is added so the file can name a DIFFERENT running phase than the one
  // this close chose: wp-2 was already in_progress before the close, the close picked
  // wp-3, and a hand edit then moves the cursor onto wp-2. Judging from the file alone,
  // that plan is indistinguishable from a finished close that chose wp-2, so a
  // plan-only rule answers already_done and logs `started wp-2` for work nobody
  // scheduled. The marker settles it.
  const cwd = boundCwd();
  const id = "recovery-marker-beats-cursor";
  const slug = "recovery-marker-beats-cursor-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const seeded = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...seeded,
    workPhases: [
      ...seeded.workPhases.map((wp) =>
        wp.id === "wp-2" ? { ...wp, status: "in_progress" as const } : wp
      ),
      { id: "wp-3", title: "third", status: "pending" as const, tasks: [], criteriaIds: [] },
    ],
  });
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterRecoveryMarkerWrite: () => { throw new Error("fail right after the marker"); },
    }),
    /fail right after the marker/,
  );
  // wp4 selection skips the running wp-2, so the marker must name wp-3.
  assert.equal(readState(cwd, id).dcloseRecovery?.nextWorkPhaseId, "wp-3");

  // The forgery: target done, cursor moved onto the phase that was already running.
  const crashed = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...crashed,
    activeWorkPhaseId: "wp-2",
    workPhases: crashed.workPhases.map((wp) =>
      wp.id === "wp-1" ? { ...wp, status: "done" as const } : wp
    ),
  });

  const retry = runOrchestrateCli(args);

  assert.equal(retry.code, 0, retry.output);
  const repaired = readGoalplan(cwd, slug)!;
  assert.equal(repaired.activeWorkPhaseId, "wp-3");
  assert.deepEqual(
    repaired.workPhases.map((wp) => [wp.id, wp.status]),
    [["wp-1", "done"], ["wp-2", "in_progress"], ["wp-3", "in_progress"]],
  );
  // The started row names the recorded successor, and wp-2 never gets a second one.
  assert.deepEqual(
    goalplanLedgerRows(cwd, slug)
      .filter((row) => row.event === "workphase_started")
      .map((row) => row.detail),
    ["started wp-3"],
  );
  assert.deepEqual(
    goalplanLedgerRows(cwd, slug)
      .filter((row) => row.event === "workphase_done")
      .map((row) => row.detail),
    ["closed wp-1"],
  );
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
});
test("recovery repairs a forged cursor that points at a phase nobody activated", () => {
  // §44: status done plus a moved cursor is forgeable by hand. If the cursor names a
  // phase that is still pending, answering already_done would log `started wp-2` for
  // a phase no one activated. The settled test compares the whole post-close shape,
  // so this falls through and the transformation rebuilds the cursor.
  const cwd = boundCwd();
  const id = "recovery-forged-cursor";
  const slug = "recovery-forged-cursor-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterRecoveryMarkerWrite: () => { throw new Error("fail right after the marker"); },
    }),
    /fail right after the marker/,
  );

  // Both halves of the old commit test, forged: target done, cursor moved, but the
  // phase it names was never activated.
  const plan = readGoalplan(cwd, slug)!;
  writeGoalplan(cwd, {
    ...plan,
    activeWorkPhaseId: "wp-2",
    workPhases: plan.workPhases.map((wp) =>
      wp.id === "wp-1" ? { ...wp, status: "done" as const } : wp
    ),
  });
  assert.equal(readGoalplan(cwd, slug)!.workPhases.find((wp) => wp.id === "wp-2")!.status, "pending");

  const retry = runOrchestrateCli(args);

  assert.equal(retry.code, 0, retry.output);
  // The successor is genuinely activated, so the started row tells the truth.
  assertOnlyFirstPhaseClosed(cwd, slug);
  assert.deepEqual(
    goalplanLedgerRows(cwd, slug)
      .filter((row) => row.event === "workphase_started").map((row) => row.detail),
    ["started wp-2"],
  );
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
});

test("recovery re-runs the close when only the target status was edited to done", () => {
  // §42: `done` alone is not proof the plan commit landed. A status-only edit leaves
  // the cursor on wp-1, so treating `done` as committed would skip the helper and
  // write a false `started wp-1` row while wp-2 stayed pending forever.
  const cwd = boundCwd();
  const id = "recovery-status-only-done";
  const slug = "recovery-status-only-done-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterRecoveryMarkerWrite: () => { throw new Error("fail right after the marker"); },
    }),
    /fail right after the marker/,
  );

  // Exactly the crash state, with the status hand-edited and the cursor untouched.
  const plan = readGoalplan(cwd, slug)!;
  assert.equal(plan.activeWorkPhaseId, "wp-1");
  writeGoalplan(cwd, {
    ...plan,
    workPhases: plan.workPhases.map((wp) =>
      wp.id === "wp-1" ? { ...wp, status: "done" as const } : wp
    ),
  });

  const retry = runOrchestrateCli(args);

  assert.equal(retry.code, 0, retry.output);
  assertOnlyFirstPhaseClosed(cwd, slug);
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
  // The started row must name the successor, never the closed target.
  assert.deepEqual(
    goalplanLedgerRows(cwd, slug)
      .filter((row) => row.event === "workphase_started").map((row) => row.detail),
    ["started wp-2"],
  );
});

test("all-done close survives a failure right after its state write", () => {
  // §40 Z2 + §41 W4: the close row already landed inside the first lock, so a state
  // write that fails afterwards leaves nothing to lose. The retry must not add a
  // second row.
  const cwd = boundCwd();
  const id = "all-done-state-write-failure";
  const slug = "all-done-state-write-failure-plan";
  const plan = buildGoalplan({ objective: "already finished" });
  plan.slug = slug;
  plan.workPhases = [{ id: "wp-1", title: "first", status: "done", tasks: [], criteriaIds: [] }];
  plan.activeWorkPhaseId = null;
  writeGoalplan(cwd, plan);
  writeState(cwd, { ...defaultState(id), phase: "C", slug, orchestrationActive: true, checkEpoch: "c-all-done" });
  seedReceipt(cwd, id, "c-all-done");

  assert.throws(
    () => runOrchestrateCli(parsedDclose(cwd, id), {
      afterStateWrite: () => { throw new Error("fail right after the state write"); },
    }),
    /fail right after the state write/,
  );
  assert.equal(
    ledgerLines(cwd).filter((row) => row.sessionId === id && row.from === "C" && row.to === "IDLE").length,
    1,
  );

  // The state write did land before the injected throw, so the session is IDLE and
  // the ordinary illegal-transition refusal applies. The row is already complete.
  const retry = runOrchestrateCli(parsedDclose(cwd, id));
  assert.equal(retry.code, 1);
  assert.equal(
    ledgerLines(cwd).filter((row) => row.sessionId === id && row.from === "C" && row.to === "IDLE").length,
    1,
  );
});

test("an absent target still activates the successor the marker recorded", () => {
  // §52: the existing absent-target case seeds wp-2 already in_progress, which hides the
  // window. Here the crash happened before the plan commit, so wp-2 is still pending when
  // an edit removes wp-1. Skipping to cleanup would clear the marker and close the cycle
  // while wp-2 never starts — the ledger would claim a close that scheduled nothing.
  const cwd = boundCwd();
  const id = "cli-recovery-absent-pending-successor";
  const slug = "cli-recovery-absent-pending-successor-plan";
  const plan = buildGoalplan({ objective: "absent target, pending successor" });
  plan.slug = slug;
  plan.workPhases = [
    { id: "wp-2", title: "next", status: "pending", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = null;
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id),
    slug,
    checkEpoch: "c-absent-pending",
    dcloseRecovery: {
      sessionId: id,
      checkEpoch: "c-absent-pending",
      closedWorkPhaseId: "wp-1",
      nextWorkPhaseId: "wp-2",
    },
  });

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 0, result.output);
  const repaired = readGoalplan(cwd, slug)!;
  assert.equal(repaired.activeWorkPhaseId, "wp-2");
  assert.equal(repaired.workPhases.find((wp) => wp.id === "wp-2")!.status, "in_progress");
  assert.deepEqual(
    goalplanLedgerRows(cwd, slug)
      .filter((row) => row.event === "workphase_started")
      .map((row) => row.detail),
    ["started wp-2"],
  );
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).dcloseRecovery, null);
});

test("recovery refuses when both the target and its recorded successor are gone", () => {
  // §52: with neither phase present there is nothing this retry can honestly finish, so
  // it keeps everything and points at reset instead of closing a cycle over an empty plan.
  const cwd = boundCwd();
  const id = "cli-recovery-both-gone";
  const slug = "cli-recovery-both-gone-plan";
  const plan = buildGoalplan({ objective: "target and successor both gone" });
  plan.slug = slug;
  plan.workPhases = [
    { id: "wp-9", title: "unrelated", status: "pending", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = null;
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id),
    slug,
    checkEpoch: "c-both-gone",
    dcloseRecovery: {
      sessionId: id,
      checkEpoch: "c-both-gone",
      closedWorkPhaseId: "wp-1",
      nextWorkPhaseId: "wp-2",
    },
  });
  const before = readFileSync(goalplanPath(cwd, slug), "utf8");

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 1);
  assert.match(result.output, /the successor wp-2 it recorded is gone too/);
  assert.match(result.output, new RegExp(`cxc orchestrate reset --session ${id}`));
  assert.equal(readFileSync(goalplanPath(cwd, slug), "utf8"), before);
  assert.equal(readState(cwd, id).dcloseRecovery?.closedWorkPhaseId, "wp-1");
  assert.deepEqual(goalplanLedgerRows(cwd, slug), []);
});
test("CLI D-close recovery resumes when the marker target is absent from the plan", () => {
  const cwd = boundCwd();
  const id = "cli-recovery-target-absent";
  const slug = "cli-recovery-target-absent-plan";
  const plan = buildGoalplan({ objective: "resume a partially committed CLI close" });
  plan.slug = slug;
  plan.workPhases = [
    { id: "wp-2", title: "next", status: "in_progress", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-2";
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id),
    slug,
    checkEpoch: "c-cli-recovery",
    dcloseRecovery: {
      sessionId: id,
      checkEpoch: "c-cli-recovery",
      closedWorkPhaseId: "wp-1",
      nextWorkPhaseId: "wp-2",
    },
  });
  const planPath = goalplanPath(cwd, slug);
  const beforePlan = readFileSync(planPath, "utf8");

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 0, result.output);
  assert.equal(
    result.output,
    `orchestrate D: close target wp-1 is complete (cycle closed, session ${id})`,
  );
  assert.doesNotMatch(result.output, /not in the bound goalplan/);
  assert.equal(readFileSync(planPath, "utf8"), beforePlan);
  assert.equal(
    ledgerLines(cwd).filter(
      (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE"
        && row.checkEpoch === "c-cli-recovery" && row.closedWorkPhaseId === "wp-1",
    ).length,
    1,
  );
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(readState(cwd, id).checkEpoch, null);
  assert.equal(readState(cwd, id).dcloseRecovery, null);
});

test("D-close retry after state write appends only the missing PABCD row", () => {
  const cwd = boundCwd();
  const id = "retry-after-state";
  const slug = "retry-after-state-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterStateWrite: () => { throw new Error("fail after state write"); },
    }),
    /fail after state write/,
  );
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(
    ledgerLines(cwd).filter(
      (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE",
    ).length,
    0,
  );

  const retry = runOrchestrateCli(args);
  assert.equal(retry.code, 0, retry.output);
  assertOnlyFirstPhaseClosed(cwd, slug);
  assert.equal(
    ledgerLines(cwd).filter(
      (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE",
    ).length,
    1,
  );
});

test("D-close retry after PABCD append is a no-op and does not close wp-2", () => {
  const cwd = boundCwd();
  const id = "retry-after-pabcd-ledger";
  const slug = "retry-after-pabcd-ledger-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const args = parsedDclose(cwd, id);

  assert.throws(
    () => runOrchestrateCli(args, {
      afterPabcdLedgerAppend: () => { throw new Error("fail after PABCD append"); },
    }),
    /fail after PABCD append/,
  );
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.equal(
    ledgerLines(cwd).filter(
      (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE",
    ).length,
    1,
  );

  const retry = runOrchestrateCli(args);
  assert.equal(retry.code, 0, retry.output);
  assertOnlyFirstPhaseClosed(cwd, slug);
  assert.equal(
    ledgerLines(cwd).filter(
      (row) => row.sessionId === id && row.from === "C" && row.to === "IDLE",
    ).length,
    1,
  );
});

test("one session closes two consecutive cycles with distinct close keys", () => {
  const cwd = boundCwd();
  const id = "two-cycles-one-session";
  const slug = "two-cycles-one-session-plan";
  seedBoundCycleAtC(cwd, id, slug, "done");

  const first = runOrchestrateCli(parsedDclose(cwd, id));
  assert.equal(first.code, 0, first.output);
  assert.equal(readGoalplan(cwd, slug)!.activeWorkPhaseId, "wp-2");

  const secondEpoch = "c-second-cycle";
  writeState(cwd, {
    ...readState(cwd, id),
    phase: "C",
    checkEpoch: secondEpoch,
    dcloseRecovery: null,
    flags: { interview: false, auditPassed: true, checkPassed: true },
  });
  seedReceipt(cwd, id, secondEpoch);
  const secondAttest = JSON.stringify({
    from: "C",
    to: "D",
    did: "verified the second cycle",
    checkOutput: "tests passed",
    exitCode: 0,
    workPhaseId: "wp-2",
    testReceiptPath: `.codexclaw/evidence/${id}/test-receipt.json`,
  });
  const secondArgs = parseOrchestrateCliArgs(
    ["d", "--session", id, "--cwd", cwd, "--attest", secondAttest],
    cwd,
  );
  assert.ok(!("error" in secondArgs));

  const second = runOrchestrateCli(secondArgs as never);

  assert.equal(second.code, 0, second.output);
  assert.equal(readState(cwd, id).phase, "IDLE");
  assert.deepEqual(
    ledgerLines(cwd)
      .filter((row) => row.sessionId === id && row.from === "C" && row.to === "IDLE")
      .map((row) => [row.checkEpoch, row.closedWorkPhaseId]),
    [
      ["c-test-epoch", "wp-1"],
      [secondEpoch, "wp-2"],
    ],
  );
  assert.equal(readGoalplan(cwd, slug)!.workPhases[1].status, "done");
});
test("D-close lock timeout returns code 1 and leaves phase, plan, and both ledgers unchanged", () => {
  const cwd = boundCwd();
  const id = "cycle-lock-timeout";
  const slug = "cycle-gate-lock-timeout";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const lock = join(cwd, STATE_DIR, "goalplans", slug, ".goalplan.lock");
  mkdirSync(lock, { recursive: false });
  writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ pid: 4242 })}\n`);
  const planPath = goalplanPath(cwd, slug);
  const goalplanLedgerPath = join(cwd, STATE_DIR, "goalplans", slug, "ledger.jsonl");
  const beforePlan = readFileSync(planPath, "utf8");
  const beforePabcdLedger = ledgerLines(cwd);
  const beforeGoalplanLedger = existsSync(goalplanLedgerPath)
    ? readFileSync(goalplanLedgerPath, "utf8")
    : "";

  const parsed = parseOrchestrateCliArgs(
    ["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)],
    cwd,
  );
  assert.ok(!("error" in parsed));
  const result = runOrchestrateCli(parsed as never);

  assert.equal(result.code, 1);
  assert.match(result.output, /\.goalplan\.lock/);
  assert.match(result.output, /D-close was not applied/);
  assert.equal(readState(cwd, id).phase, "C");
  assert.equal(readFileSync(planPath, "utf8"), beforePlan);
  assert.deepEqual(ledgerLines(cwd), beforePabcdLedger);
  assert.equal(
    existsSync(goalplanLedgerPath) ? readFileSync(goalplanLedgerPath, "utf8") : "",
    beforeGoalplanLedger,
  );
});
test("CLI D-close rejects an invalid v3 dependency plan before every write", () => {
  const cwd = boundCwd();
  const id = "invalid-v3-cli-close";
  const slug = "invalid-v3-cli-close-plan";
  const plan = buildGoalplan({ objective: "invalid dependency close" });
  plan.slug = slug;
  plan.schemaVersion = 3;
  plan.workPhases = [
    { id: "wp-1", title: "broken", status: "in_progress", dependsOn: ["missing"], tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";
  writeGoalplan(cwd, plan);
  writeState(cwd, {
    ...defaultState(id), phase: "C", slug, checkEpoch: "c-invalid",
    flags: { interview: false, auditPassed: true, checkPassed: true },
  });
  seedReceipt(cwd, id, "c-invalid");
  const statePath = join(cwd, STATE_DIR, SESSIONS_SUBDIR, `${id}.json`);
  const planPath = goalplanPath(cwd, slug);
  const pabcdPath = join(cwd, STATE_DIR, LEDGER_FILE);
  const goalplanLedgerPath = join(cwd, STATE_DIR, "goalplans", slug, "ledger.jsonl");
  const before = {
    state: readFileSync(statePath, "utf8"),
    plan: readFileSync(planPath, "utf8"),
    pabcd: existsSync(pabcdPath) ? readFileSync(pabcdPath, "utf8") : "",
    goalplan: existsSync(goalplanLedgerPath) ? readFileSync(goalplanLedgerPath, "utf8") : "",
  };

  const result = runOrchestrateCli(parsedDclose(cwd, id));

  assert.equal(result.code, 1);
  assert.match(result.output, /invalid goalplan/);
  assert.equal(readFileSync(statePath, "utf8"), before.state);
  assert.equal(readFileSync(planPath, "utf8"), before.plan);
  assert.equal(existsSync(pabcdPath) ? readFileSync(pabcdPath, "utf8") : "", before.pabcd);
  assert.equal(existsSync(goalplanLedgerPath) ? readFileSync(goalplanLedgerPath, "utf8") : "", before.goalplan);
});
test("P-to-A continues when stale-round housekeeping cannot acquire the common lock", () => {
  const cwd = freshCwd();
  try {
    const id = "housekeeping-lock";
    const slug = "housekeeping-lock-plan";
    const planUnit = seedPlanUnit(cwd);
    const plan = buildGoalplan({ objective: "housekeeping lock plan" });
    plan.slug = slug;
    plan.workPhases = [
      { id: "wp1", title: "one", status: "in_progress", tasks: [], criteriaIds: [] },
    ];
    plan.activeWorkPhaseId = "wp1";
    plan.reviewRounds = [
      {
        roundId: "r1",
        purpose: "plan_audit",
        planPath: planUnit,
        planSha256: "a".repeat(64),
        status: "in_flight",
        lane: { launchId: "r1-launch" },
        openedAt: "2026-08-28T00:00:00.000Z",
        ownerSessionId: id,
        workPhaseId: "wp1",
        planUnit,
        planEpoch: "e-old",
      },
    ];
    plan.activePlanAuditRoundId = "r1";
    writeGoalplan(cwd, plan);
    writeState(cwd, { ...defaultState(id), phase: "P", slug });
    const lock = join(cwd, STATE_DIR, "goalplans", slug, ".goalplan.lock");
    mkdirSync(lock, { recursive: false });
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({ pid: 4242 })}\n`);

    const result = runOrchestrateCli({
      verb: "A",
      attest: {
        from: "P",
        to: "A",
        did: "audited the plan",
        planUnit,
        workPhaseId: "wp1",
      },
      session: id,
      cwd,
      json: false,
    });

    assert.equal(result.code, 0, result.output);
    assert.equal(readState(cwd, id).phase, "A");
    assert.equal(ledgerLines(cwd).at(-1)?.to, "A");
    const stored = JSON.parse(readFileSync(goalplanPath(cwd, slug), "utf8"));
    assert.equal(stored.reviewRounds[0].status, "in_flight");
    assert.equal(existsSync(lock), true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("wp7 preservation: CLI D-close keeps dependsOn and outcome", () => {
  const cwd = boundCwd();
  const id = "wp7-cli-d";
  const slug = "wp7-cli-d";
  seedBoundCycleAtC(cwd, id, slug, "done");
  const seeded = readGoalplan(cwd, slug)!;
  seeded.schemaVersion = 3;
  seeded.workPhases[0].tasks = [
    { id: "t-1", title: "first", status: "done", dependsOn: [], outcome: "first task verified" },
    { id: "t-2", title: "second", status: "done", dependsOn: ["t-1"], outcome: "second task verified" },
  ];
  writeGoalplan(cwd, seeded);

  const args = parseOrchestrateCliArgs(["d", "--session", id, "--cwd", cwd, "--attest", dAttest(id)], cwd);
  assert.ok(!("error" in args));
  const result = runOrchestrateCli(args as never);

  assert.equal(result.code, 0, result.output);
  assert.equal(readState(cwd, id).phase, "IDLE");
  const saved = readGoalplan(cwd, slug)!;
  assert.equal(saved.workPhases[0].status, "done");
  assert.equal(saved.workPhases[1].status, "in_progress");
  assert.deepEqual(taskFields(saved), expectedTaskFields);
});
