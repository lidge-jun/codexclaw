/**
 * steering transaction tests (WP14 / plan 090).
 *
 * Lock contention is tested by pre-creating the lock directory rather than
 * racing two calls: mkdirSync is synchronous, so two calls in one process run
 * one after the other and both succeed. The filesystem state of a pre-created
 * lock is identical to "another process holds it", and it actually exercises
 * the EEXIST path.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGoalplan, goalplanDir, readGoalplan, writeGoalplan, type Goalplan } from "../src/goalplan.ts";
import { applySteeringBatch, type SteerResult } from "../src/steering.ts";
import { parseGoalplanCliArgs, runGoalplanCli } from "../src/goalplan-cli.ts";
import { defaultState, writeState } from "../src/state.ts";

const OBJECTIVE = "steering fixture";
const SLUG = buildGoalplan({ objective: OBJECTIVE }).slug;

function batch(over: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "k1",
    rationale: "the scope shifted after the audit",
    evidence: "devlog/_plan/x/090.md:12",
    ops: [{ kind: "annotate", note: "narrowed to the parser" }],
    ...over,
  };
}

function workspace(): string {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-steer-"));
  writeGoalplan(cwd, buildGoalplan({ objective: OBJECTIVE }));
  return cwd;
}

function applied(r: SteerResult): Extract<SteerResult, { kind: "applied" }> {
  assert.equal(r.kind, "applied", `expected applied, got ${r.kind}: ${"reason" in r ? r.reason : ""}`);
  return r as Extract<SteerResult, { kind: "applied" }>;
}

function ledgerText(cwd: string): string {
  const path = join(goalplanDir(cwd, SLUG), "ledger.jsonl");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

test("a valid batch applies once, records the entry and one ledger line", () => {
  const cwd = workspace();
  const r = applied(applySteeringBatch(cwd, SLUG, batch(), { now: () => "2026-03-03T00:00:00.000Z" }));
  assert.equal(r.entry.idempotencyKey, "k1");
  assert.equal(r.entry.appliedAt, "2026-03-03T00:00:00.000Z");
  assert.match(r.entry.summary, /1 op\(s\): annotate/);

  const stored = readGoalplan(cwd, SLUG);
  assert.equal(stored?.steeringLog?.length, 1);
  assert.equal((ledgerText(cwd).match(/"event":"steered"/g) ?? []).length, 1);
});

test("re-running the same key is a no-op that writes nothing", () => {
  const cwd = workspace();
  applySteeringBatch(cwd, SLUG, batch());
  const before = ledgerText(cwd);
  const again = applySteeringBatch(cwd, SLUG, batch({ rationale: "different words, same key" }));
  assert.equal(again.kind, "duplicate");
  assert.equal(readGoalplan(cwd, SLUG)?.steeringLog?.length, 1);
  assert.equal(ledgerText(cwd), before, "no second ledger line");
});

test("rationale, evidence and idempotencyKey are all required", () => {
  for (const key of ["idempotencyKey", "rationale", "evidence"]) {
    const cwd = workspace();
    const bad = batch({ [key]: "" });
    const r = applySteeringBatch(cwd, SLUG, bad);
    assert.equal(r.kind, "rejected", key);
    assert.match((r as { reason: string }).reason, new RegExp(key));
    assert.equal(readGoalplan(cwd, SLUG)?.steeringLog, undefined, `${key}: nothing written`);
  }
});

test("one invalid op rejects the whole batch", () => {
  const cwd = workspace();
  const r = applySteeringBatch(
    cwd,
    SLUG,
    batch({
      ops: [
        { kind: "annotate", note: "fine" },
        { kind: "annotate", note: "also fine" },
        { kind: "annotate" },
      ],
    }),
  );
  assert.equal(r.kind, "rejected");
  assert.match((r as { reason: string }).reason, /ops\[2\]/);
  assert.equal(readGoalplan(cwd, SLUG)?.steeringLog, undefined);
});

test("an op kind this slice does not implement is rejected", () => {
  const cwd = workspace();
  const r = applySteeringBatch(cwd, SLUG, batch({ ops: [{ kind: "retitle_work_phase", note: "x" }] }));
  assert.equal(r.kind, "rejected");
  assert.match((r as { reason: string }).reason, /"annotate" only/);
});

test("an empty ops array is rejected", () => {
  const cwd = workspace();
  const r = applySteeringBatch(cwd, SLUG, batch({ ops: [] }));
  assert.equal(r.kind, "rejected");
  assert.match((r as { reason: string }).reason, /non-empty array/);
});

test("a held lock blocks the batch and names the owner", () => {
  const cwd = workspace();
  const lock = join(goalplanDir(cwd, SLUG), ".steer.lock");
  mkdirSync(lock, { recursive: true });
  writeFileSync(join(lock, "owner.json"), JSON.stringify({ pid: 4242, acquiredAt: "2026-01-01T00:00:00.000Z" }));
  const r = applySteeringBatch(cwd, SLUG, batch());
  assert.equal(r.kind, "locked");
  assert.match((r as { reason: string }).reason, /4242/);
  assert.match((r as { reason: string }).reason, /\.steer\.lock/);
  assert.equal(readGoalplan(cwd, SLUG)?.steeringLog, undefined);
});

test("the lock is released on success and on rejection", () => {
  const cwd = workspace();
  const lock = join(goalplanDir(cwd, SLUG), ".steer.lock");
  applySteeringBatch(cwd, SLUG, batch());
  assert.equal(existsSync(lock), false, "released after success");
  applySteeringBatch(cwd, SLUG, batch({ idempotencyKey: "k2", ops: [{ kind: "nope" }] }));
  assert.equal(existsSync(lock), false, "released after rejection");
});

test("a failed ledger append still succeeds, with a warning and the entry intact", () => {
  const cwd = workspace();
  // A directory at the ledger path makes appendFileSync fail with EISDIR, which
  // lands after the goalplan commit. Removing write permission instead would
  // break writeGoalplan's temp file first and never reach this path.
  mkdirSync(join(goalplanDir(cwd, SLUG), "ledger.jsonl"), { recursive: true });
  const r = applySteeringBatch(cwd, SLUG, batch());
  const hit = applied(r);
  assert.ok(hit.warning, "a missing audit line must be reported");
  assert.match(hit.warning ?? "", /ledger/);
  assert.equal(readGoalplan(cwd, SLUG)?.steeringLog?.length, 1, "the commit still stands");
});

test("an unbound slug is refused before anything is touched", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-steer-"));
  const r = applySteeringBatch(cwd, "no-such-plan", batch());
  assert.equal(r.kind, "rejected");
  assert.match((r as { reason: string }).reason, /no goalplan found/);
});

test("the ledger entry stays compact — no copy of the plan", () => {
  const cwd = workspace();
  applySteeringBatch(cwd, SLUG, batch());
  const line = ledgerText(cwd).trim().split("\n").at(-1) ?? "";
  assert.ok(line.length < 400, `ledger line is ${line.length} chars`);
  assert.equal(line.includes("workPhases"), false);
  assert.equal(line.includes("criteria"), false);
});

test("steeringLog survives a write/read round trip", () => {
  const cwd = workspace();
  applySteeringBatch(cwd, SLUG, batch());
  const back = readGoalplan(cwd, SLUG);
  assert.equal(back?.steeringLog?.[0]?.idempotencyKey, "k1");
  assert.equal(back?.steeringLog?.[0]?.evidence, "devlog/_plan/x/090.md:12");
});

test("a malformed steeringLog rejects the whole plan rather than dropping entries", () => {
  const cwd = workspace();
  applySteeringBatch(cwd, SLUG, batch());
  const file = join(goalplanDir(cwd, SLUG), "goalplan.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  delete (raw.steeringLog as Record<string, unknown>[])[0].evidence;
  writeFileSync(file, JSON.stringify(raw));
  // Dropping the entry would make the key look unapplied and let the batch run twice.
  assert.equal(readGoalplan(cwd, SLUG), null);
});

// ---- CLI surface -----------------------------------------------------------

function cli(cwd: string, argv: string[]) {
  const parsed = parseGoalplanCliArgs(argv, cwd);
  assert.ok(!("error" in parsed), `parse failed: ${"error" in parsed ? parsed.error : ""}`);
  return runGoalplanCli(parsed as Exclude<typeof parsed, { error: string }>);
}

function boundWorkspace(session = "sess-1"): string {
  const cwd = workspace();
  writeState(cwd, { ...defaultState(session), slug: SLUG });
  return cwd;
}

test("cli: steer applies a batch passed inline", () => {
  const cwd = boundWorkspace();
  const r = cli(cwd, ["steer", "--session", "sess-1", "--batch-json", JSON.stringify(batch())]);
  assert.equal(r.code, 0, r.output);
  assert.match(r.output, /applied k1/);
  assert.equal(readGoalplan(cwd, SLUG)?.steeringLog?.length, 1);
});

test("cli: steer reads a batch from a file", () => {
  const cwd = boundWorkspace();
  const path = join(cwd, "batch.json");
  writeFileSync(path, JSON.stringify(batch()));
  const r = cli(cwd, ["steer", "--session", "sess-1", "--batch-json", path]);
  assert.equal(r.code, 0, r.output);
});

test("cli: a non-canonical session id is refused", () => {
  const cwd = boundWorkspace();
  const r = cli(cwd, ["steer", "--session", "a/b", "--batch-json", JSON.stringify(batch())]);
  assert.equal(r.code, 1);
  assert.match(r.output, /not a canonical session id/);
});

test("cli: a session with no bound goalplan says so", () => {
  const cwd = workspace();
  writeState(cwd, defaultState("sess-2"));
  const r = cli(cwd, ["steer", "--session", "sess-2", "--batch-json", JSON.stringify(batch())]);
  assert.equal(r.code, 1);
  assert.match(r.output, /no bound goalplan/);
});

test("cli: malformed batch JSON reports the parse error", () => {
  const cwd = boundWorkspace();
  const r = cli(cwd, ["steer", "--session", "sess-1", "--batch-json", "{not json"]);
  assert.equal(r.code, 1);
  assert.match(r.output, /not valid JSON/);
});

test("cli: steer requires both flags", () => {
  const cwd = boundWorkspace();
  assert.match(cli(cwd, ["steer", "--batch-json", "{}"]).output, /--session <id> is required/);
  assert.match(cli(cwd, ["steer", "--session", "sess-1"]).output, /--batch-json/);
});

test("cli: an unknown verb still lists the supported ones", () => {
  const parsed = parseGoalplanCliArgs(["wander"], "/tmp");
  assert.ok("error" in parsed);
  assert.match((parsed as { error: string }).error, /init\|show\|validate\|steer/);
});
