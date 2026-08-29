import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildGoalplan,
  dependencyDeadlock,
  dependencyWaitReasons,
  readGoalplan,
  readGoalplanDetailed,
  writeGoalplan,
  appendGoalplanLedger,
  goalplanDir,
  remainingWorkPhases,
  nextOpenTask,
  unmetCriteria,
  isGoalplanComplete,
  validateGoalplan,
  advanceWorkPhase,
  effectiveActiveWorkPhaseId,
  effectiveSchemaVersion,
  type Goalplan,
  goalplanWriteLockDir,
  goalplanWriteLockStatus,
} from "../src/goalplan.ts";
import { deriveSlug } from "../src/freeze.ts";
import { parseGoalplanCliArgs, runGoalplanCli, type GoalplanCliArgs } from "../src/goalplan-cli.ts";
import { readState } from "../src/state.ts";
import { supportsSymlinks, symlinkDirSync } from "../test-support/symlink-support.ts";

const NOW = "2026-08-29T00:00:00.000Z";

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "cxc-goalplan-"));
}

test("030: schema round-trips (write then read returns an equal Goalplan)", () => {
  const cwd = tmp();
  const plan = buildGoalplan({
    objective: "Build the Thing",
    criteria: [{ scenario: "it builds", expectedEvidence: "exit 0" }],
    now: () => "2026-07-01T00:00:00Z",
  });
  writeGoalplan(cwd, plan);
  const read = readGoalplan(cwd, plan.slug);
  assert.ok(read);
  // updatedAt is refreshed on write; compare the rest structurally.
  assert.equal(read!.objective, plan.objective);
  assert.equal(read!.slug, plan.slug);
  assert.deepEqual(read!.criteria, plan.criteria);
  assert.deepEqual(read!.host, plan.host);
});

test("schema v3: work-phase/task dependsOn survives a write/read round trip", () => {
  // arrange
  const cwd = tmp();
  const plan = buildGoalplan({ objective: "dependency round trip" });
  plan.workPhases = [
    {
      id: "wp-1",
      title: "foundation",
      status: "done",
      tasks: [{ id: "t-1", title: "first", status: "done" }],
      criteriaIds: [],
    },
    {
      id: "wp-2",
      title: "dependent",
      status: "pending",
      dependsOn: ["wp-1"],
      tasks: [
        { id: "t-1", title: "leader", status: "pending" },
        { id: "t-2", title: "follower", status: "pending", dependsOn: ["t-1"] },
      ],
      criteriaIds: [],
    },
  ];

  // act
  writeGoalplan(cwd, plan);
  const back = readGoalplan(cwd, plan.slug);

  // assert
  assert.ok(back);
  assert.deepEqual(back.workPhases[1].dependsOn, ["wp-1"]);
  assert.deepEqual(back.workPhases[1].tasks[1].dependsOn, ["t-1"]);
  assert.equal(
    Object.prototype.hasOwnProperty.call(back.workPhases[0], "dependsOn"),
    false,
    "an absent phase dependsOn stays absent",
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(back.workPhases[1].tasks[0], "dependsOn"),
    false,
    "an absent task dependsOn stays absent",
  );
});

test("schema v3: an empty dependsOn array is preserved as an empty array", () => {
  // arrange
  const cwd = tmp();
  const plan = buildGoalplan({ objective: "empty dependency list" });
  plan.workPhases = [{
    id: "wp-1",
    title: "phase",
    status: "pending",
    dependsOn: [],
    tasks: [{ id: "t-1", title: "task", status: "pending", dependsOn: [] }],
    criteriaIds: [],
  }];

  // act
  writeGoalplan(cwd, plan);
  const back = readGoalplan(cwd, plan.slug);

  // assert
  assert.ok(back);
  assert.deepEqual(back.workPhases[0].dependsOn, [], "undefined and [] both mean no phase dependency");
  assert.deepEqual(
    back.workPhases[0].tasks[0].dependsOn,
    [],
    "undefined and [] both mean no task dependency",
  );
});

test("schema v3: malformed dependsOn or phase shape rejects the whole plan and names the field", () => {
  // arrange
  const cases: Array<{
    name: string;
    field: string;
    detailPattern: RegExp;
    apply: (raw: Record<string, any>) => void;
  }> = [
    { name: "phase is not an array", field: "workPhases[].dependsOn", detailPattern: /dependsOn/, apply: (raw) => { raw.workPhases[0].dependsOn = "wp-0"; } },
    { name: "phase has a non-string", field: "workPhases[].dependsOn", detailPattern: /dependsOn/, apply: (raw) => { raw.workPhases[0].dependsOn = [1]; } },
    { name: "phase has an empty id", field: "workPhases[].dependsOn", detailPattern: /dependsOn/, apply: (raw) => { raw.workPhases[0].dependsOn = [" "]; } },
    { name: "task is not an array", field: "workPhases[].tasks[].dependsOn", detailPattern: /dependsOn/, apply: (raw) => { raw.workPhases[0].tasks[0].dependsOn = "t-0"; } },
    { name: "task has a non-string", field: "workPhases[].tasks[].dependsOn", detailPattern: /dependsOn/, apply: (raw) => { raw.workPhases[0].tasks[0].dependsOn = [null]; } },
    { name: "task has an empty id", field: "workPhases[].tasks[].dependsOn", detailPattern: /dependsOn/, apply: (raw) => { raw.workPhases[0].tasks[0].dependsOn = [""]; } },
    // Audit round 10 blocker 2: cover the widened work-phase shape check (id -> id and title).
    { name: "phase title is missing", field: "workPhases[] entries (each needs id/title)", detailPattern: /workPhases/, apply: (raw) => { delete raw.workPhases[0].title; } },
    { name: "phase title is not a string", field: "workPhases[] entries (each needs id/title)", detailPattern: /workPhases/, apply: (raw) => { raw.workPhases[0].title = 42; } },
  ];

  for (const c of cases) {
    // arrange
    const cwd = tmp();
    const plan = buildGoalplan({ objective: `bad dependsOn ${c.name}` });
    plan.workPhases = [{
      id: "wp-1",
      title: "phase",
      status: "pending",
      tasks: [{ id: "t-1", title: "task", status: "pending" }],
      criteriaIds: [],
    }];
    writeGoalplan(cwd, plan);
    const path = join(goalplanDir(cwd, plan.slug), "goalplan.json");
    const raw = JSON.parse(readFileSync(path, "utf8"));
    c.apply(raw);
    writeFileSync(path, JSON.stringify(raw));

    // act
    const result = readGoalplanDetailed(cwd, plan.slug);

    // assert
    assert.equal(result.plan, null, c.name);
    assert.equal(result.diagnostic?.kind, "invalid-shape", c.name);
    if (result.diagnostic?.kind === "invalid-shape") {
      assert.equal(result.diagnostic.field, c.field, c.name);
      assert.match(result.diagnostic.detail, c.detailPattern, c.name);
    }
  }
});

test("schema v3: task outcome is trimmed while absent and blank outcomes stay absent", () => {
  // arrange
  const cwd = tmp();
  const plan = buildGoalplan({ objective: "outcome round trip" });
  plan.workPhases = [{
    id: "wp-1",
    title: "phase",
    status: "in_progress",
    tasks: [
      { id: "t-1", title: "done", status: "done", outcome: "  node --test: 0 fail  " },
      { id: "t-2", title: "missing", status: "pending" },
      { id: "t-3", title: "blank", status: "pending", outcome: "   " },
      { id: "t-4", title: "non-string", status: "pending" },
    ],
    criteriaIds: [],
  }];
  writeGoalplan(cwd, plan);
  const path = join(goalplanDir(cwd, plan.slug), "goalplan.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  raw.workPhases[0].tasks[3].outcome = 42;
  writeFileSync(path, JSON.stringify(raw));

  // act
  const back = readGoalplan(cwd, plan.slug);

  // assert
  assert.ok(back);
  assert.equal(back.workPhases[0].tasks[0].outcome, "node --test: 0 fail");
  assert.equal(Object.prototype.hasOwnProperty.call(back.workPhases[0].tasks[1], "outcome"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(back.workPhases[0].tasks[2], "outcome"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(back.workPhases[0].tasks[3], "outcome"), false);
});

test("schema v3: legacy plan without outcome keeps byte-identical serialized plan data", () => {
  // arrange
  const cwd = tmp();
  const plan = buildGoalplan({ objective: "legacy outcome omission" });
  delete plan.schemaVersion;
  plan.workPhases = [{
    id: "wp-1",
    title: "legacy phase",
    status: "done",
    tasks: [{ id: "t-1", title: "legacy done task", status: "done" }],
    criteriaIds: [],
  }];

  // act
  writeGoalplan(cwd, plan);
  const path = join(goalplanDir(cwd, plan.slug), "goalplan.json");
  const stored = readFileSync(path, "utf8");
  const back = readGoalplan(cwd, plan.slug);

  // assert
  assert.ok(back);
  assert.equal(JSON.stringify(back, null, 2), stored);
  assert.equal(Object.prototype.hasOwnProperty.call(back, "schemaVersion"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(back.workPhases[0].tasks[0], "outcome"), false);
});

test("schema v3: buildGoalplan declares schemaVersion 3", () => {
  // arrange and act
  const plan = buildGoalplan({ objective: "new v3 plan" });

  // assert
  assert.equal(plan.schemaVersion, 3);
  assert.equal(effectiveSchemaVersion(plan, false), 3);
});

test("schema v3: an unsupported future schemaVersion is rejected on read and on validate", () => {
  // arrange
  const cwd = tmp();
  const plan = buildGoalplan({ objective: "future version" });
  writeGoalplan(cwd, plan);
  const path = join(goalplanDir(cwd, plan.slug), "goalplan.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  raw.schemaVersion = 4;
  writeFileSync(path, JSON.stringify(raw));

  // act
  const result = readGoalplanDetailed(cwd, plan.slug);
  const validated = validateGoalplan({ ...plan, schemaVersion: 4 });

  // assert
  assert.equal(result.plan, null, "a v4 plan on disk does not read as a plan");
  assert.equal(result.diagnostic?.kind, "invalid-shape");
  if (result.diagnostic?.kind === "invalid-shape") {
    assert.equal(result.diagnostic.field, "schemaVersion");
    assert.match(result.diagnostic.detail, /schemaVersion/);
  }
  assert.equal(validated.ok, false, "validateGoalplan refuses an unsupported future version");
  assert.ok(
    validated.reasons.some((reason) => /schemaVersion/.test(reason)),
    `expected a schemaVersion reason, got ${JSON.stringify(validated.reasons)}`,
  );
});

test("schema v3: pre-change baseline records a private-data-free manifest and parser results", () => {
  // arrange
  const path = join(
    import.meta.dirname,
    "fixtures",
    "goalplans-pre-change-baseline.json",
  );
  type ParserResult =
    | { kind: "parsed" }
    | { kind: "absent" | "unreadable" | "invalid-json" }
    | { kind: "invalid-shape"; field: "criteria-shape" | "other-shape" };

  // act
  const text = readFileSync(path, "utf8");
  const snapshot = JSON.parse(text) as {
    measuredOn: "2026-08-29";
    sourceCount: number;
    manifest: Array<{
      ordinal: number;
      alias: string;
      sourceClass: "normal" | "legacy-text-criterion";
      expected: ParserResult;
    }>;
    fixtures: Array<{
      ordinal: number;
      alias: string;
      sourceClass: "normal" | "legacy-text-criterion";
      expected: ParserResult;
      plan: Record<string, unknown>;
    }>;
  };
  const preservedEnumsByKey = new Map<string, Set<string>>([
    ["status", new Set([
      "pending", "in_progress", "done", "blocked", "superseded", "open", "met",
      "launching", "in_flight", "approved", "changes_requested", "inconclusive",
    ])],
    ["surface", new Set(["logic", "web", "tui"])],
    ["source", new Set(["freeze", "none"])],
    ["purpose", new Set(["plan_audit", "final_gate"])],
    ["verdict", new Set(["pass", "near-pass", "fail"])],
    ["kind", new Set([
      "resolved", "unavailable", "parsed", "absent", "unreadable", "invalid-json", "invalid-shape",
    ])],
    ["sourceClass", new Set(["normal", "legacy-text-criterion"])],
    ["field", new Set(["criteria-shape", "other-shape"])],
  ]);
  const assertAliased = (value: unknown, ordinal: number, key = ""): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => assertAliased(item, ordinal, key));
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([childKey, child]) => assertAliased(child, ordinal, childKey));
      return;
    }
    if (typeof value === "string" && !preservedEnumsByKey.get(key)?.has(value)) {
      if (value === `fixture-${ordinal}`) return;
      assert.match(value, new RegExp(`^fixture-${ordinal}-string-\\d{4}$`));
    }
  };

  // assert
  assert.equal(snapshot.measuredOn, "2026-08-29");
  assert.ok(snapshot.sourceCount > 0);
  assert.equal(snapshot.sourceCount, snapshot.manifest.length);
  assert.equal(snapshot.fixtures.length, snapshot.manifest.length);
  assert.deepEqual(
    snapshot.manifest,
    snapshot.fixtures.map(({ ordinal, alias, sourceClass, expected }) => ({
      ordinal,
      alias,
      sourceClass,
      expected,
    })),
  );
  assert.deepEqual(
    snapshot.fixtures.map(({ ordinal }) => ordinal),
    snapshot.fixtures.map((_, index) => index + 1),
  );
  for (const fixture of snapshot.fixtures) {
    assert.equal(fixture.alias, `fixture-${fixture.ordinal}`);
    assert.equal(fixture.plan.slug, fixture.alias);
    assertAliased(fixture.plan, fixture.ordinal);
  }
  const legacy = snapshot.fixtures.find((fixture) => fixture.sourceClass === "legacy-text-criterion");
  assert.ok(legacy);
  assert.deepEqual(legacy.expected, { kind: "invalid-shape", field: "criteria-shape" });
  assert.doesNotMatch(text, /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  assert.doesNotMatch(text, /"\/(?!\/)/, "absolute POSIX paths must not remain");
  assert.doesNotMatch(text, /"[A-Za-z]:\\\\/, "absolute Windows paths must not remain");
  assert.doesNotMatch(text, /\b[0-9a-f]{40}\b/i, "40-character hashes must not remain");
});

test("schema v3: baseline generator privacy and reparse invariants run on every suite", async () => {
  // arrange
  const { assertFixturesPrivateAndStable, normalizeResult, PRIVACY_PATTERNS } = await import(
    "./fixtures/capture-goalplan-baseline.mjs"
  );
  const snapshot = JSON.parse(readFileSync(
    join(import.meta.dirname, "fixtures", "goalplans-pre-change-baseline.json"),
    "utf8",
  )) as { fixtures: Array<{ ordinal: number; alias: string; expected: unknown; plan: Record<string, unknown> }> };
  const reparseRoot = tmp();

  // act and assert - every checked-in fixture reparses to the same normalized result.
  assertFixturesPrivateAndStable(snapshot.fixtures, reparseRoot);

  // assert - the helper itself is alive, proven by a negative case.
  assert.ok(PRIVACY_PATTERNS.length >= 4);
  assert.throws(
    () => assertFixturesPrivateAndStable(
      [{ ordinal: 1, alias: "fixture-1", expected: { kind: "parsed" }, plan: { leak: "/Users/someone/secret" } }],
      tmp(),
    ),
    /privacy scan/,
    "an absolute path leak must be caught by the generator helper",
  );
  assert.deepEqual(normalizeResult({ plan: {}, diagnostic: null }), { kind: "parsed" });
});

test("030: slug-namespaced path, distinct from plan/interview dirs", () => {
  const cwd = tmp();
  const plan = buildGoalplan({ objective: "Hello, World!!" });
  assert.equal(plan.slug, "hello-world");
  writeGoalplan(cwd, plan);
  assert.equal(goalplanDir(cwd, plan.slug), join(cwd, ".codexclaw", "goalplans", "hello-world"));
  assert.ok(existsSync(join(cwd, ".codexclaw", "goalplans", "hello-world", "goalplan.json")));
});

test("030: absent or malformed -> readGoalplan returns null (never throws)", () => {
  const cwd = tmp();
  assert.equal(readGoalplan(cwd, "missing"), null);
  // malformed JSON
  const dir = goalplanDir(cwd, "bad");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "goalplan.json"), "{ not json");
  assert.equal(readGoalplan(cwd, "bad"), null);
  // structurally invalid (missing required fields)
  writeFileSync(join(dir, "goalplan.json"), JSON.stringify({ objective: "x" }));
  assert.equal(readGoalplan(cwd, "bad"), null);
});

test("goalplan slug is an identifier: stored traversal, mismatches, and symlink roots are rejected", (t) => {
  const cwd = tmp();
  const plan = buildGoalplan({ objective: "safe plan", criteria: [{ scenario: "ok" }] });
  writeGoalplan(cwd, plan);
  const file = join(goalplanDir(cwd, plan.slug), "goalplan.json");
  const stored = JSON.parse(readFileSync(file, "utf8"));
  writeFileSync(file, JSON.stringify({ ...stored, slug: "../../escaped" }));
  assert.equal(readGoalplan(cwd, plan.slug), null, "stored slug must match requested slug");
  assert.throws(() => writeGoalplan(cwd, { ...plan, slug: "../../escaped" }), /invalid goalplan slug/);
  assert.equal(existsSync(join(cwd, "escaped", "goalplan.json")), false);

  // The traversal assertions above already ran; only the linked-root half needs a link.
  if (!supportsSymlinks().dir) {
    t.skip("directory links unavailable on this host: symlinked state root not exercised");
    return;
  }
  const linked = tmp();
  const outside = tmp();
  symlinkDirSync(outside, join(linked, ".codexclaw"));
  assert.throws(() => writeGoalplan(linked, buildGoalplan({ objective: "linked root" })), /symlink/);
});

test("goalplan reads and ledger appends refuse symlink leaf files", (t) => {
  // Leaf links must point at a FILE, so a junction cannot stand in here.
  if (!supportsSymlinks().file) {
    t.skip("file symlinks unavailable on this host: leaf-symlink refusal not exercised");
    return;
  }
  const cwd = tmp();
  const outside = join(tmp(), "outside.txt");
  writeFileSync(outside, "unchanged");
  const slug = "leaf-link";
  const dir = goalplanDir(cwd, slug);
  mkdirSync(dir, { recursive: true });
  symlinkSync(outside, join(dir, "goalplan.json"));
  assert.equal(readGoalplan(cwd, slug), null);
  symlinkSync(outside, join(dir, "ledger.jsonl"));
  assert.throws(
    () => appendGoalplanLedger(cwd, slug, { ts: "now", slug, event: "created", detail: "x" }),
    /symlink|ELOOP/,
  );
  assert.equal(readFileSync(outside, "utf8"), "unchanged");
});

test("030: derived helpers (remaining/nextOpen/unmet/complete) on fixtures", () => {
  const plan: Goalplan = buildGoalplan({ objective: "loop", criteria: [{ scenario: "c" }] });
  plan.workPhases = [
    { id: "wp-1", title: "one", status: "done", tasks: [{ id: "t-1", title: "a", status: "done" }], criteriaIds: [] },
    { id: "wp-2", title: "two", status: "in_progress", tasks: [
      { id: "t-2", title: "b", status: "done" },
      { id: "t-3", title: "c", status: "pending" },
    ], criteriaIds: ["c-1"] },
  ];
  assert.deepEqual(remainingWorkPhases(plan).map((w) => w.id), ["wp-2"]);
  const next = nextOpenTask(plan);
  assert.equal(next?.task.id, "t-3");
  assert.deepEqual(unmetCriteria(plan).map((c) => c.id), ["c-1"]);
  assert.equal(isGoalplanComplete(plan), false);

  // close everything
  plan.workPhases.forEach((w) => { w.status = "done"; w.tasks.forEach((t) => (t.status = "done")); });
  plan.criteria.forEach((c) => { c.status = "met"; c.capturedEvidence = "done"; });
  assert.equal(nextOpenTask(plan), null);
  assert.equal(isGoalplanComplete(plan), true);
});

test("030: validateGoalplan rejects met-without-evidence and incomplete plans", () => {
  // v1 pinned: this test is about the evidence and completeness rules, not the v2+
  // final gate that buildGoalplan()'s new v3 default would bring in (wp2, 260829).
  const plan = { ...buildGoalplan({ objective: "v", criteria: [{ scenario: "c" }] }), schemaVersion: 1 };
  // unmet criterion -> not ok
  assert.equal(validateGoalplan(plan).ok, false);
  // mark met but no evidence -> still not ok (rubber-stamp guard)
  plan.criteria[0].status = "met";
  const r1 = validateGoalplan(plan);
  assert.equal(r1.ok, false);
  assert.ok(r1.reasons.some((x) => /no captured evidence/.test(x)));
  // with evidence + no work phases -> ok
  plan.criteria[0].capturedEvidence = "proof";
  assert.equal(validateGoalplan(plan).ok, true);
});

test("260709: validateGoalplan FAILS an EMPTY plan (no workPhases, no criteria)", () => {
  // 019f4456 regression: a `loop init`-only artifact passed the E8 gate vacuously.
  const plan = { ...buildGoalplan({ objective: "shell only" }), schemaVersion: 1 };
  const verdict = validateGoalplan(plan);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.some((x) => /plan is empty/.test(x)));
  // registering EITHER a criterion or a work phase lifts the empty-plan failure.
  const withCriterion = {
    ...buildGoalplan({ objective: "with criterion", criteria: [{ scenario: "c", expectedEvidence: "e" }] }),
    schemaVersion: 1,
  };
  withCriterion.criteria[0] = { ...withCriterion.criteria[0], status: "met", capturedEvidence: "proof" };
  assert.equal(validateGoalplan(withCriterion).ok, true);
});

test("030: appendGoalplanLedger is append-only JSONL", () => {
  const cwd = tmp();
  const slug = deriveSlug("led");
  appendGoalplanLedger(cwd, slug, { ts: "t1", slug, event: "created", detail: "a" });
  appendGoalplanLedger(cwd, slug, { ts: "t2", slug, event: "task_done", detail: "b" });
  const raw = readFileSync(join(goalplanDir(cwd, slug), "ledger.jsonl"), "utf8").trim().split("\n");
  assert.equal(raw.length, 2);
  assert.equal(JSON.parse(raw[0]).event, "created");
  assert.equal(JSON.parse(raw[1]).event, "task_done");
});

// ---- CLI (030.2) ----------------------------------------------------------

test("030.2: init requires a real objective, then show/validate work", () => {
  const cwd = tmp();
  // init without objective -> error
  const noObj = parseGoalplanCliArgs(["init"], cwd);
  assert.ok(!("error" in noObj));
  assert.equal(runGoalplanCli(noObj as any).code, 1);

  // init with objective -> writes plan
  const initArgs = parseGoalplanCliArgs(["init", "--objective", "Ship the loop", "--criterion", "tests green"], cwd);
  assert.ok(!("error" in initArgs));
  const init = runGoalplanCli(initArgs as any);
  assert.equal(init.code, 0);
  assert.match(init.output, /objective: Ship the loop/);
  const slug = deriveSlug("Ship the loop");
  assert.ok(readGoalplan(cwd, slug));

  // duplicate init -> error
  assert.equal(runGoalplanCli(parseGoalplanCliArgs(["init", "--objective", "Ship the loop"], cwd) as any).code, 1);

  // show by objective
  const show = runGoalplanCli(parseGoalplanCliArgs(["show", "--objective", "Ship the loop"], cwd) as any);
  assert.equal(show.code, 0);
  assert.match(show.output, /criteria: 1 \(unmet 1\)/);

  // validate fails (unmet criterion)
  const val = runGoalplanCli(parseGoalplanCliArgs(["validate", "--slug", "Ship the loop"], cwd) as any);
  assert.equal(val.code, 1);
  assert.match(val.output, /FAIL/);
});

test("030.2: unknown verb -> parse error; show/validate need a slug source", () => {
  const cwd = tmp();
  const bad = parseGoalplanCliArgs(["frobnicate"], cwd);
  assert.ok("error" in bad);
  const noSlug = runGoalplanCli(parseGoalplanCliArgs(["show"], cwd) as any);
  assert.equal(noSlug.code, 1);
  assert.match(noSlug.output, /required/);
  const missing = runGoalplanCli(parseGoalplanCliArgs(["show", "--slug", "ghost"], cwd) as any);
  assert.equal(missing.code, 1);
  assert.match(missing.output, /no plan found/);
});

test("030.3: init --session persists the derived slug into that session's state", () => {
  const cwd = tmp();
  const args = parseGoalplanCliArgs(["init", "--objective", "Bound objective", "--session", "sess-1"], cwd);
  assert.ok(!("error" in args));
  assert.equal((args as any).session, "sess-1");
  assert.equal(runGoalplanCli(args as any).code, 0);
  assert.equal(readState(cwd, "sess-1").slug, deriveSlug("Bound objective"));
});

test("030.3: init WITHOUT --session leaves session state untouched (slug stays empty)", () => {
  const cwd = tmp();
  assert.equal(runGoalplanCli(parseGoalplanCliArgs(["init", "--objective", "Unbound"], cwd) as any).code, 0);
  // a fresh read of an unknown session is the default (empty slug)
  assert.equal(readState(cwd, "never-bound").slug, "");
});


// ---- advanceWorkPhase (Phase 3: D-close auto-advance) ----------------------

test("advanceWorkPhase: marks current done, activates next in declared order", () => {
  const plan = buildGoalplan({ objective: "multi-phase" });
  plan.workPhases = [
    { id: "wp-1", title: "first", status: "in_progress", tasks: [{ id: "t-1", title: "a", status: "done" }], criteriaIds: [] },
    { id: "wp-2", title: "second", status: "pending", tasks: [{ id: "t-2", title: "b", status: "pending" }], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";
  const advanced = advanceWorkPhase(plan);
  assert.equal(advanced.kind, "ok");
  const next = (advanced as { kind: "ok"; plan: typeof plan }).plan;
  assert.equal(next.workPhases[0].status, "done");
  assert.equal(next.workPhases[1].status, "in_progress");
  assert.equal(next.activeWorkPhaseId, "wp-2");
});

// CYCLE-COMPLETION-01 (030). This case used to assert the opposite: a work-phase
// went "done" with its task still pending, which is exactly how five units of work
// were retired by a single D-close. Closing now refuses instead.
test("advanceWorkPhase: refuses to close a work-phase holding open tasks", () => {
  const plan = buildGoalplan({ objective: "pending-task" });
  plan.workPhases = [
    { id: "wp-1", title: "first", status: "in_progress", tasks: [
      { id: "t-1", title: "unfinished", status: "pending" },
      { id: "t-2", title: "finished", status: "done" },
    ], criteriaIds: [] },
    { id: "wp-2", title: "second", status: "pending", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";
  const advanced = advanceWorkPhase(plan);
  assert.equal(advanced.kind, "tasks_pending");
  const refusal = advanced as { kind: "tasks_pending"; workPhaseId: string; pending: { id: string }[] };
  assert.equal(refusal.workPhaseId, "wp-1");
  assert.deepEqual(refusal.pending.map((t) => t.id), ["t-1"]);
  // the refusal leaves the plan alone — closing a cycle never marks tasks done
  assert.equal(plan.workPhases[0].status, "in_progress");
  assert.deepEqual(plan.workPhases[0].tasks.map((t) => t.status), ["pending", "done"]);
  assert.equal(plan.activeWorkPhaseId, "wp-1");
});

test("advanceWorkPhase: returns null when plan has no work phases (empty plan)", () => {
  const plan = buildGoalplan({ objective: "no-active" });
  plan.activeWorkPhaseId = null;
  assert.equal(advanceWorkPhase(plan).kind, "no_active");
});

test("260714 wp4: null cursor + pending phases -> implicit start closes first pending, persists explicit cursor", () => {
  const plan = buildGoalplan({ objective: "implicit-start" });
  plan.workPhases = [
    { id: "wp-1", title: "one", status: "pending", tasks: [], criteriaIds: [] },
    { id: "wp-2", title: "two", status: "pending", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = null; // standard `loop init` shape — must no longer no-op
  const advanced = advanceWorkPhase(plan);
  assert.equal(advanced.kind, "ok");
  const next = (advanced as { kind: "ok"; plan: typeof plan }).plan;
  assert.equal(next.workPhases[0].status, "done");
  assert.equal(next.workPhases[1].status, "in_progress");
  assert.equal(next.activeWorkPhaseId, "wp-2");
});

test("260714 wp4: stale (ghost) cursor falls through to the effective open phase", () => {
  const plan = buildGoalplan({ objective: "stale-cursor" });
  plan.workPhases = [{ id: "wp-1", title: "one", status: "pending", tasks: [], criteriaIds: [] }];
  plan.activeWorkPhaseId = "ghost";
  const advanced = advanceWorkPhase(plan);
  assert.equal(advanced.kind, "ok"); // ghost cursor no longer freezes the plan
  const next = (advanced as { kind: "ok"; plan: typeof plan }).plan;
  assert.equal(next.workPhases[0].status, "done");
  assert.equal(next.activeWorkPhaseId, null); // no next pending
});

test("260714 wp4: effectiveActiveWorkPhaseId — explicit wins; done/ghost fall through; in_progress > pending; empty -> null", () => {
  const plan = buildGoalplan({ objective: "effective" });
  plan.workPhases = [
    { id: "wp-1", title: "one", status: "done", tasks: [], criteriaIds: [] },
    { id: "wp-2", title: "two", status: "pending", tasks: [], criteriaIds: [] },
    { id: "wp-3", title: "three", status: "in_progress", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-2";
  assert.equal(effectiveActiveWorkPhaseId(plan), "wp-2"); // explicit live cursor wins
  plan.activeWorkPhaseId = "wp-1";
  assert.equal(effectiveActiveWorkPhaseId(plan), "wp-3"); // done cursor falls through to in_progress
  plan.activeWorkPhaseId = "ghost";
  assert.equal(effectiveActiveWorkPhaseId(plan), "wp-3"); // ghost falls through too
  plan.activeWorkPhaseId = null;
  assert.equal(effectiveActiveWorkPhaseId(plan), "wp-3"); // in_progress preferred over pending
  plan.workPhases = plan.workPhases.map((wp) => ({ ...wp, status: "done" as const }));
  assert.equal(effectiveActiveWorkPhaseId(plan), null); // all done -> null
  plan.workPhases = [];
  assert.equal(effectiveActiveWorkPhaseId(plan), null); // empty -> null
});

test("advanceWorkPhase: sets null activeWorkPhaseId when last phase", () => {
  const plan = buildGoalplan({ objective: "last-phase" });
  plan.workPhases = [
    { id: "wp-1", title: "only", status: "in_progress", tasks: [{ id: "t-1", title: "a", status: "done" }], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";
  const advanced = advanceWorkPhase(plan);
  assert.equal(advanced.kind, "ok");
  const next = (advanced as { kind: "ok"; plan: typeof plan }).plan;
  assert.equal(next.activeWorkPhaseId, null);
  assert.equal(next.workPhases[0].status, "done");
});

test("advanceWorkPhase: picks next pending AFTER current, not before", () => {
  const plan = buildGoalplan({ objective: "order-test" });
  plan.workPhases = [
    { id: "wp-1", title: "first", status: "pending", tasks: [], criteriaIds: [] },
    { id: "wp-2", title: "second", status: "in_progress", tasks: [], criteriaIds: [] },
    { id: "wp-3", title: "third", status: "pending", tasks: [], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-2";
  const advanced = advanceWorkPhase(plan);
  assert.equal(advanced.kind, "ok");
  // Should pick wp-3 (after wp-2), not wp-1 (before wp-2)
  assert.equal((advanced as { kind: "ok"; plan: typeof plan }).plan.activeWorkPhaseId, "wp-3");
});

test("advanceWorkPhase: preserves individual task statuses (no auto-done)", () => {
  const plan = buildGoalplan({ objective: "preserve-task-statuses" });
  plan.workPhases = [
    { id: "wp-1", title: "mixed", status: "in_progress", tasks: [
      { id: "t-1", title: "pending task", status: "pending" },
      { id: "t-2", title: "done task", status: "done" },
    ], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";
  const advanced = advanceWorkPhase(plan);
  // CYCLE-COMPLETION-01: the mixed phase can no longer close. The invariant this
  // case was written to protect still holds and matters more than ever — closing
  // must never mark a task done on the agent's behalf.
  assert.equal(advanced.kind, "tasks_pending");
  assert.deepEqual(plan.workPhases[0].tasks.map((task) => task.status), ["pending", "done"]);
});

test("advanceWorkPhase: done tasks stay done after advance", () => {
  const plan = buildGoalplan({ objective: "preserve-done-tasks" });
  plan.workPhases = [
    { id: "wp-1", title: "complete", status: "in_progress", tasks: [
      { id: "t-1", title: "first done task", status: "done" },
      { id: "t-2", title: "second done task", status: "done" },
    ], criteriaIds: [] },
  ];
  plan.activeWorkPhaseId = "wp-1";
  const advanced = advanceWorkPhase(plan);
  assert.equal(advanced.kind, "ok");
  const next = (advanced as { kind: "ok"; plan: typeof plan }).plan;
  assert.deepEqual(next.workPhases[0].tasks.map((task) => task.status), ["done", "done"]);
});

// ---- CLI output label (Phase 2: cxc loop) ----------------------------------

test("CLI output uses loop label, not goalplan", () => {
  const cwd = tmp();
  const args = parseGoalplanCliArgs(["init", "--objective", "Label test"], cwd);
  assert.ok(!("error" in args));
  const result = runGoalplanCli(args as any);
  assert.equal(result.code, 0);
  assert.match(result.output, /\[codexclaw loop:/);
  assert.ok(!result.output.includes("[codexclaw goalplan:"));
});

test("wp4: nextOpenTask excludes a task whose direct dependency is not done", () => {
  const plan = buildGoalplan({ objective: "task dependency" });
  plan.schemaVersion = 3;
  plan.workPhases = [{
    id: "wp1",
    title: "one",
    status: "in_progress",
    dependsOn: [],
    criteriaIds: [],
    tasks: [
      { id: "t1", title: "upstream", status: "pending", dependsOn: [] },
      { id: "t2", title: "downstream", status: "pending", dependsOn: ["t1"] },
    ],
  }];
  assert.equal(nextOpenTask(plan)?.task.id, "t1");
  plan.workPhases[0].tasks[0].status = "done";
  plan.workPhases[0].tasks[0].outcome = "upstream task completed";
  assert.equal(nextOpenTask(plan)?.task.id, "t2");
});

test("wp4 regression: duplicate task ids in different phases stay phase-local", () => {
  const plan = buildGoalplan({ objective: "phase-local duplicate task ids" });
  plan.schemaVersion = 3;
  plan.workPhases = [
    {
      id: "wpA",
      title: "phase A",
      status: "done",
      dependsOn: [],
      criteriaIds: [],
      tasks: [{
        id: "t1",
        title: "phase A t1",
        status: "done",
        dependsOn: [],
        outcome: "phase A t1 completed",
      }],
    },
    {
      id: "wpB",
      title: "phase B",
      status: "in_progress",
      dependsOn: [],
      criteriaIds: [],
      tasks: [
        { id: "t2", title: "phase B t2", status: "pending", dependsOn: ["t1"] },
        { id: "t1", title: "phase B t1", status: "pending", dependsOn: [] },
      ],
    },
  ];

  const next = nextOpenTask(plan);

  assert.deepEqual(
    next ? { workPhaseId: next.wp.id, taskId: next.task.id } : null,
    { workPhaseId: "wpB", taskId: "t1" },
  );
  assert.notEqual(next?.task.id, "t2");
});

test("wp4 compatibility: undefined and empty dependsOn have identical selection semantics", () => {
  const legacy = buildGoalplan({ objective: "legacy undefined" });
  legacy.workPhases = [
    { id: "wp1", title: "one", status: "in_progress", tasks: [{ id: "t1", title: "one", status: "pending" }], criteriaIds: [] },
    { id: "wp2", title: "two", status: "pending", tasks: [], criteriaIds: [] },
  ];
  legacy.activeWorkPhaseId = "wp1";
  const explicitEmpty: Goalplan = structuredClone(legacy);
  explicitEmpty.schemaVersion = 3;
  explicitEmpty.workPhases = explicitEmpty.workPhases.map((wp) => ({
    ...wp,
    dependsOn: [],
    tasks: wp.tasks.map((task) => ({ ...task, dependsOn: [] })),
  }));
  assert.equal(effectiveActiveWorkPhaseId(legacy), effectiveActiveWorkPhaseId(explicitEmpty));
  assert.equal(nextOpenTask(legacy)?.task.id, nextOpenTask(explicitEmpty)?.task.id);
  assert.equal(dependencyDeadlock(legacy), null);
  assert.equal(dependencyDeadlock(explicitEmpty), null);
});

test("wp4 compatibility: v1 selector and advance golden result stays byte-for-byte stable", () => {
  // 감사 라운드 1 BLOCKER 1: 앞선 초안은 effective/next를 id로만, advance를 kind와 status
  // 배열로만 봐서 공개 반환 필드 closedId를 검사하지 않았다. 두 리뷰어가 각각
  // closedId를 훼손한 변이본으로 187/187 green을 재현했다. 세 경로의 관측값을 하나의
  // 손작성 golden으로 묶고, 이어지는 wrap까지 같은 테스트에서 실행한다.
  //
  // B-phase 변이 확인 260829: wp3의 runnable pending task가 하나뿐이면 nextOpenTask()가
  // 후보를 첫 개가 아니라 마지막 개로 바꾸는 변이가 관측되지 않아 이 golden이 green으로
  // 남았다. wp3에 두 번째 pending task를 두어 선언 순서 선택을 실제로 못 박는다.
  const now = () => "2026-08-29T00:00:00.000Z";
  const plan = buildGoalplan({ objective: "v1 golden", now });
  delete plan.schemaVersion;
  plan.workPhases = [
    { id: "wp1", title: "before", status: "pending", tasks: [], criteriaIds: [] },
    { id: "wp2", title: "current", status: "in_progress", tasks: [{ id: "t2", title: "done", status: "done" }], criteriaIds: [] },
    {
      id: "wp3",
      title: "after",
      status: "pending",
      tasks: [
        { id: "t3", title: "next", status: "pending" },
        { id: "t3b", title: "later", status: "pending" },
      ],
      criteriaIds: [],
    },
  ];
  plan.activeWorkPhaseId = "wp2";

  const advanced = advanceWorkPhase(plan);
  assert.equal(advanced.kind, "ok");
  if (advanced.kind !== "ok") return;

  assert.deepEqual(
    {
      effective: effectiveActiveWorkPhaseId(plan),
      next: nextOpenTask(plan),
      advanceKind: advanced.kind,
      closedId: advanced.closedId,
      activeWorkPhaseId: advanced.plan.activeWorkPhaseId,
      workPhases: advanced.plan.workPhases,
      schemaVersionPresent: Object.prototype.hasOwnProperty.call(advanced.plan, "schemaVersion"),
    },
    {
      effective: "wp2",
      next: {
        wp: {
          id: "wp3",
          title: "after",
          status: "pending",
          tasks: [
            { id: "t3", title: "next", status: "pending" },
            { id: "t3b", title: "later", status: "pending" },
          ],
          criteriaIds: [],
        },
        task: { id: "t3", title: "next", status: "pending" },
      },
      advanceKind: "ok",
      closedId: "wp2",
      activeWorkPhaseId: "wp3",
      workPhases: [
        { id: "wp1", title: "before", status: "pending", tasks: [], criteriaIds: [] },
        { id: "wp2", title: "current", status: "done", tasks: [{ id: "t2", title: "done", status: "done" }], criteriaIds: [] },
        {
          id: "wp3",
          title: "after",
          status: "in_progress",
          tasks: [
            { id: "t3", title: "next", status: "pending" },
            { id: "t3b", title: "later", status: "pending" },
          ],
          criteriaIds: [],
        },
      ],
      schemaVersionPresent: false,
    },
  );

  // 앞쪽으로 되돌아가는 wrap 순회도 같은 v1 fixture에서 직접 실행한다. wp3의 task를 닫고
  // 다시 advance하면 뒤쪽에 pending이 없어 wp1으로 돌아가야 한다.
  for (const task of advanced.plan.workPhases[2].tasks) task.status = "done";
  const wrapped = advanceWorkPhase(advanced.plan);
  assert.equal(wrapped.kind, "ok");
  if (wrapped.kind !== "ok") return;
  assert.deepEqual(
    {
      closedId: wrapped.closedId,
      activeWorkPhaseId: wrapped.plan.activeWorkPhaseId,
      statuses: wrapped.plan.workPhases.map((wp) => wp.status),
    },
    { closedId: "wp3", activeWorkPhaseId: "wp1", statuses: ["in_progress", "done", "done"] },
  );
});

test("wp4 compatibility: v2 plans without dependsOn keep the v1 selection result", () => {
  const plan = buildGoalplan({ objective: "v2 golden" });
  plan.schemaVersion = 2;
  plan.workPhases = [
    { id: "wp1", title: "one", status: "done", tasks: [], criteriaIds: [] },
    { id: "wp2", title: "two", status: "pending", tasks: [{ id: "t2", title: "next", status: "pending" }], criteriaIds: [] },
  ];
  assert.equal(effectiveActiveWorkPhaseId(plan), "wp2");
  assert.equal(nextOpenTask(plan)?.task.id, "t2");
});

test("wp7 preservation: show renders the write lock path and age", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-wp7-lock-"));
  const plan = buildGoalplan({ objective: "Ship the loop", criteria: [], now: () => NOW });
  writeGoalplan(cwd, plan);

  // 락 없음: absent 줄이 절대 경로를 담고 ageMs를 붙이지 않는다.
  const absent = runGoalplanCli(
    parseGoalplanCliArgs(["show", "--slug", plan.slug, "--cwd", cwd], cwd) as GoalplanCliArgs,
  );
  assert.equal(absent.code, 0);
  const lockDir = goalplanWriteLockDir(cwd, plan.slug);
  assert.match(absent.output, new RegExp(`^writeLock: absent path=${escapeRe(lockDir)}$`, "m"));
  assert.doesNotMatch(absent.output, /ageMs=/);

  // 락 있음: present 줄이 같은 경로와 숫자 나이를 담는다.
  mkdirSync(lockDir, { recursive: true });
  const present = runGoalplanCli(
    parseGoalplanCliArgs(["show", "--slug", plan.slug, "--cwd", cwd], cwd) as GoalplanCliArgs,
  );
  assert.equal(present.code, 0);
  assert.match(present.output, new RegExp(`^writeLock: present path=${escapeRe(lockDir)} ageMs=\\d+$`, "m"));

  // 기존 요약 줄은 두 경우 모두 그대로다. 새 줄이 기존 출력을 밀어내지 않는다.
  for (const out of [absent.output, present.output]) {
    assert.match(out, /^\[codexclaw loop: /m);
    assert.match(out, /^criteria: 0 \(unmet 0\)$/m);
    assert.match(out, /^complete: /m);
  }
});

test("wp7 preservation: show survives a lock that vanishes between exists and stat", () => {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-wp7-race-"));
  const plan = buildGoalplan({ objective: "Ship the loop", criteria: [], now: () => NOW });
  writeGoalplan(cwd, plan);
  const lockDir = goalplanWriteLockDir(cwd, plan.slug);
  mkdirSync(lockDir, { recursive: true });

  // exists 뒤 stat 사이에 락이 사라지는 경우. 주입 seam은 wp5가 만든 네 번째 인자다.
  const status = goalplanWriteLockStatus(cwd, plan.slug, Date.now(), () => {
    const err = new Error("ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    throw err;
  });
  assert.deepEqual(status, { path: lockDir, exists: false, ageMs: null });

  // 그 정규화가 렌더까지 전달되는지: show는 예외 없이 absent를 낸다.
  rmSync(lockDir, { recursive: true, force: true });
  const rendered = runGoalplanCli(
    parseGoalplanCliArgs(["show", "--slug", plan.slug, "--cwd", cwd], cwd) as GoalplanCliArgs,
  );
  assert.equal(rendered.code, 0);
  assert.match(rendered.output, new RegExp(`^writeLock: absent path=${escapeRe(lockDir)}$`, "m"));
});
