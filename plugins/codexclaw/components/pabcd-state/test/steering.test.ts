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

test("a weakening op kind is rejected with the supported set named", () => {
  const cwd = workspace();
  const r = applySteeringBatch(cwd, SLUG, batch({ ops: [{ kind: "retitle_work_phase", note: "x" }] }));
  assert.equal(r.kind, "rejected");
  assert.match((r as { reason: string }).reason, /use "annotate", "add-criterion", or "add-work-phase"/);
});

test("add-criterion appends a criterion and is idempotent on resubmission", () => {
  const cwd = workspace();
  const r1 = applySteeringBatch(cwd, SLUG, {
    idempotencyKey: "k-add-crit",
    rationale: "test",
    evidence: "new gate",
    ops: [{ kind: "add-criterion", scenario: "dual-platform suite green", surface: "logic", expectedEvidence: "receipts" }],
  });
  assert.equal(r1.kind, "applied");
  const plan = readGoalplan(cwd, SLUG);
  const added = plan?.criteria.find((c) => c.scenario === "dual-platform suite green");
  assert.ok(added, "criterion registered");
  assert.equal(added?.status, "open");
  assert.equal(added?.surface, "logic");
  const r2 = applySteeringBatch(cwd, SLUG, {
    idempotencyKey: "k-add-crit",
    rationale: "test",
    evidence: "new gate",
    ops: [{ kind: "add-criterion", scenario: "dual-platform suite green" }],
  });
  assert.equal(r2.kind, "duplicate");
});

test("add-work-phase appends a pending phase; duplicate id is rejected", () => {
  const cwd = workspace();
  const r1 = applySteeringBatch(cwd, SLUG, {
    idempotencyKey: "k-add-wp",
    rationale: "test",
    evidence: "scope growth",
    ops: [{ kind: "add-work-phase", id: "wp99-new", title: "Newly scoped work" }],
  });
  assert.equal(r1.kind, "applied");
  const wp = readGoalplan(cwd, SLUG)?.workPhases.find((w) => w.id === "wp99-new");
  assert.ok(wp, "work phase registered");
  assert.equal(wp?.status, "pending");
  const r2 = applySteeringBatch(cwd, SLUG, {
    idempotencyKey: "k-add-wp-2",
    rationale: "test",
    evidence: "same id again",
    ops: [{ kind: "add-work-phase", id: "wp99-new", title: "Duplicate" }],
  });
  assert.equal(r2.kind, "rejected");
  assert.match((r2 as { reason: string }).reason, /already in this plan/);
});

test("an empty ops array is rejected", () => {
  const cwd = workspace();
  const r = applySteeringBatch(cwd, SLUG, batch({ ops: [] }));
  assert.equal(r.kind, "rejected");
  assert.match((r as { reason: string }).reason, /non-empty array/);
});

test("a held common lock blocks the batch and preserves plan and ledger bytes", () => {
  const cwd = workspace();
  const lock = join(goalplanDir(cwd, SLUG), ".goalplan.lock");
  mkdirSync(lock, { recursive: false });
  writeFileSync(
    join(lock, "owner.json"),
    `${JSON.stringify({ pid: 4242, acquiredAt: "2026-08-29T00:00:00.000Z" })}\n`,
  );
  const planPath = join(goalplanDir(cwd, SLUG), "goalplan.json");
  const beforePlan = readFileSync(planPath, "utf8");
  const beforeLedger = ledgerText(cwd);

  const result = applySteeringBatch(cwd, SLUG, batch(), {
    lock: { retryDelaysMs: [], sleep: () => assert.fail("no sleep is configured") },
  });

  assert.equal(result.kind, "locked");
  assert.match(result.kind === "locked" ? result.reason : "", /4242/);
  assert.match(result.kind === "locked" ? result.reason : "", /\.goalplan\.lock/);
  assert.equal(readFileSync(planPath, "utf8"), beforePlan);
  assert.equal(ledgerText(cwd), beforeLedger);
});

test("the common lock is released after an applied or rejected batch", () => {
  const cwd = workspace();
  const lock = join(goalplanDir(cwd, SLUG), ".goalplan.lock");

  const appliedResult = applySteeringBatch(cwd, SLUG, batch());
  assert.equal(appliedResult.kind, "applied");
  assert.equal(existsSync(lock), false);

  const rejectedResult = applySteeringBatch(
    cwd,
    SLUG,
    batch({ idempotencyKey: "k2", ops: [{ kind: "nope" }] }),
  );
  assert.equal(rejectedResult.kind, "rejected");
  assert.equal(existsSync(lock), false);
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

test("add-work-phase stores dependencies and records one success event", () => {
  const cwd = workspace();
  const plan = readGoalplan(cwd, SLUG)!;
  plan.workPhases = [
    { id: "wp-a", title: "A", status: "done", tasks: [], criteriaIds: [] },
    { id: "wp-b", title: "B", status: "done", tasks: [], criteriaIds: [] },
  ];
  writeGoalplan(cwd, plan);
  const result = applySteeringBatch(cwd, SLUG, batch({
    idempotencyKey: "k-add-wp-deps",
    ops: [{ kind: "add-work-phase", id: "wp-c", title: "C", dependsOn: ["wp-a", "wp-b"] }],
  }));
  assert.equal(result.kind, "applied");
  assert.deepEqual(readGoalplan(cwd, SLUG)?.workPhases.at(-1)?.dependsOn, ["wp-a", "wp-b"]);
  const entries = ledgerText(cwd).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(entries.filter((entry) => entry.event === "dependency_registered").length, 1);
  assert.equal(entries.find((entry) => entry.event === "dependency_registered")?.detail,
    "wp-c dependsOn=wp-a,wp-b");
});

test("same-batch backward reference succeeds and forward reference is rejected as dangling", () => {
  const cwd = workspace();
  const valid = applySteeringBatch(cwd, SLUG, batch({
    idempotencyKey: "k-same-batch",
    ops: [
      { kind: "add-work-phase", id: "wp-a", title: "A", dependsOn: [] },
      { kind: "add-work-phase", id: "wp-b", title: "B", dependsOn: ["wp-a"] },
    ],
  }));
  assert.equal(valid.kind, "applied");
  const stored = readGoalplan(cwd, SLUG)!;
  assert.deepEqual(
    stored.workPhases.filter((wp) => wp.id === "wp-a" || wp.id === "wp-b").map((wp) => wp.id),
    ["wp-a", "wp-b"],
  );
  assert.deepEqual(stored.workPhases.find((wp) => wp.id === "wp-b")?.dependsOn, ["wp-a"]);
  assert.equal(stored.steeringLog?.at(-1)?.summary, "2 op(s): add-work-phase, add-work-phase");
  const beforePlan = readFileSync(join(goalplanDir(cwd, SLUG), "goalplan.json"), "utf8");
  const beforeLedger = ledgerText(cwd);
  const invalid = applySteeringBatch(cwd, SLUG, batch({
    idempotencyKey: "k-forward-dangling",
    ops: [
      { kind: "add-work-phase", id: "wp-x", title: "X", dependsOn: ["wp-y"] },
      { kind: "add-work-phase", id: "wp-y", title: "Y", dependsOn: ["wp-x"] },
    ],
  }));
  assert.equal(invalid.kind, "rejected");
  assert.equal(
    (invalid as { kind: "rejected"; reason: string }).reason,
    "work phase wp-x depends on unknown work phase 'wp-y'",
  );
  assert.equal(readFileSync(join(goalplanDir(cwd, SLUG), "goalplan.json"), "utf8"), beforePlan);
  assert.equal(ledgerText(cwd), beforeLedger);
});

test("duplicate dependencies are rejected before write", () => {
  const cwd = workspace();
  const beforePlan = readFileSync(join(goalplanDir(cwd, SLUG), "goalplan.json"), "utf8");
  const beforeLedger = ledgerText(cwd);
  const result = applySteeringBatch(cwd, SLUG, batch({
    idempotencyKey: "k-duplicate-deps",
    ops: [{ kind: "add-work-phase", id: "wp-c", title: "C", dependsOn: ["wp-a", "wp-a"] }],
  }));
  assert.equal(result.kind, "rejected");
  assert.equal((result as { kind: "rejected"; reason: string }).reason,
    "ops[0].dependsOn must not contain duplicate ids");
  assert.equal(readFileSync(join(goalplanDir(cwd, SLUG), "goalplan.json"), "utf8"), beforePlan);
  assert.equal(ledgerText(cwd), beforeLedger);
});
