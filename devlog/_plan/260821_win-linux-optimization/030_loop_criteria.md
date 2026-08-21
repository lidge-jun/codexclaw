# 030 - wp04 loop criteria (issue #29)

> DIFFLEVEL-ROADMAP-01: this doc is the copy-paste-executable PRD for wp04.

Defect closed from 002 section D: **#5 (P1)** goalplan-cli.ts:69,181 + steering.ts:45 -
criteria are unregistrable after `loop init`, and `goalplan.ts:807` advertises a
`cxc loop final-gate open` verb that exists nowhere.

The failure chain, from 002 section A:

1. `--criterion` is parsed at `goalplan-cli.ts:69` but consumed only by `init` (:183).
2. `VERBS` (:56) is `{init, show, validate, steer}` - no `add-criterion`, no `add-work-phase`.
3. `steer` is the only mutation path, and `SUPPORTED_OPS` (`steering.ts:45`) is
   `new Set(["annotate"])`, rejected explicitly at :116.
4. `buildGoalplan` (`goalplan.ts:584-608`) always sets `workPhases: []`, and
   `validateGoalplan` fails an empty plan (`goalplan.ts:705-708`).
5. `schemaVersion 2` requires a `surface` per criterion (`goalplan.ts:801-803`), which
   `buildGoalplan` never sets - so even init-time criteria fail v2 validation.

So the plan is frozen at birth and the hook (`hook.ts:1128`) tells the agent to
hand-edit `.codexclaw/goalplans/<slug>/goalplan.json` because no CLI verb exists.

## MODIFY / NEW / DELETE map

### 1. MODIFY plugins/codexclaw/components/pabcd-state/src/steering.ts

#### 1a. SUPPORTED_OPS gains the two mutating kinds

BEFORE (:44-45)
```ts
/** 091 adds the mutating kinds; until then an unknown kind is a rejection. */
const SUPPORTED_OPS: ReadonlySet<string> = new Set(["annotate"]);
```

AFTER
```ts
/**
 * Mutating kinds land here (issue #29). An unknown kind is still a rejection.
 *
 * Both mutating ops are strictly ADDITIVE. Steering must never weaken a plan
 * (loop/SKILL.md:230), and adding a criterion raises the completion bar rather
 * than lowering it - which is why these are safe to admit while removal ops
 * are not, and why there is deliberately no `remove-criterion` here.
 */
const SUPPORTED_OPS: ReadonlySet<string> = new Set(["annotate", "add-criterion", "add-work-phase"]);
```

#### 1b. SteerOp becomes a discriminated union

The current `SteerOp` (above :30) is an annotate-shaped record. Replace with:

```ts
export type SteerOp =
  | { kind: "annotate"; note: string }
  | {
      kind: "add-criterion";
      scenario: string;
      /** schemaVersion 2 requires this (goalplan.ts:801). Defaulted to "logic". */
      surface?: "logic" | "web" | "tui";
      expectedEvidence?: string;
    }
  | { kind: "add-work-phase"; id: string; title: string };
```

#### 1c. validateBatch parses the new kinds

BEFORE (:111-123)
```ts
  const ops: SteerOp[] = [];
  for (const [i, raw] of (b.ops as unknown[]).entries()) {
    if (typeof raw !== "object" || raw === null) return { error: `ops[${i}] must be an object` };
    const op = raw as Record<string, unknown>;
    if (typeof op.kind !== "string") return { error: `ops[${i}].kind must be a string` };
    if (!SUPPORTED_OPS.has(op.kind)) {
      return { error: `ops[${i}].kind "${op.kind}" is not supported yet - this slice implements "annotate" only` };
    }
    if (op.kind === "annotate" && (typeof op.note !== "string" || op.note.trim().length === 0)) {
      return { error: `ops[${i}] is an annotate without a note` };
    }
    ops.push({ kind: op.kind, note: typeof op.note === "string" ? op.note : undefined });
  }
```

AFTER
```ts
  const ops: SteerOp[] = [];
  const SURFACES = new Set(["logic", "web", "tui"]);
  for (const [i, raw] of (b.ops as unknown[]).entries()) {
    if (typeof raw !== "object" || raw === null) return { error: `ops[${i}] must be an object` };
    const op = raw as Record<string, unknown>;
    if (typeof op.kind !== "string") return { error: `ops[${i}].kind must be a string` };
    if (!SUPPORTED_OPS.has(op.kind)) {
      return {
        error: `ops[${i}].kind "${op.kind}" is not supported - use "annotate", "add-criterion", or "add-work-phase"`,
      };
    }
    if (op.kind === "annotate") {
      if (typeof op.note !== "string" || op.note.trim().length === 0) {
        return { error: `ops[${i}] is an annotate without a note` };
      }
      ops.push({ kind: "annotate", note: op.note });
      continue;
    }
    if (op.kind === "add-criterion") {
      if (typeof op.scenario !== "string" || op.scenario.trim().length === 0) {
        return { error: `ops[${i}] is an add-criterion without a scenario` };
      }
      if (op.surface !== undefined && (typeof op.surface !== "string" || !SURFACES.has(op.surface))) {
        return { error: `ops[${i}].surface must be "logic", "web", or "tui"` };
      }
      ops.push({
        kind: "add-criterion",
        scenario: op.scenario.trim(),
        surface: (op.surface as "logic" | "web" | "tui" | undefined) ?? "logic",
        expectedEvidence: typeof op.expectedEvidence === "string" ? op.expectedEvidence.trim() : "",
      });
      continue;
    }
    // add-work-phase
    if (typeof op.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(op.id)) {
      return { error: `ops[${i}].id must be a short lowercase work-phase id, e.g. "wp04-loop-criteria"` };
    }
    if (typeof op.title !== "string" || op.title.trim().length === 0) {
      return { error: `ops[${i}] is an add-work-phase without a title` };
    }
    ops.push({ kind: "add-work-phase", id: op.id, title: op.title.trim() });
  }
```

#### 1d. applySteeringBatch applies the ops

BEFORE (:184-188)
```ts
    // Build the whole next plan first: a batch applies entirely or not at all,
    // so nothing touches disk until every op has been accepted.
    const next: Goalplan = { ...plan, steeringLog: [...(plan.steeringLog ?? []), entry] };

    writeGoalplan(cwd, next); // commit point
```

AFTER
```ts
    // Build the whole next plan first: a batch applies entirely or not at all,
    // so nothing touches disk until every op has been accepted.
    const applied = applyOps(plan, batch.ops);
    if ("error" in applied) return { kind: "rejected", reason: applied.error };
    const next: Goalplan = { ...applied.plan, steeringLog: [...(plan.steeringLog ?? []), entry] };

    writeGoalplan(cwd, next); // commit point
```

NEW helper, placed above `applySteeringBatch`:

```ts
/**
 * Fold the ops into a plan. Pure: the caller owns the lock and the write.
 *
 * Ids are assigned here rather than accepted from the batch so two concurrent
 * batches cannot both claim `c-3`. Duplicate detection is on the scenario text
 * for criteria and on the id for work phases, and a duplicate is a rejection
 * rather than a silent no-op - a steering batch that did nothing should say so.
 */
function applyOps(plan: Goalplan, ops: SteerOp[]): { plan: Goalplan } | { error: string } {
  let criteria = [...plan.criteria];
  let workPhases = [...plan.workPhases];
  for (const op of ops) {
    if (op.kind === "annotate") continue; // ledger-only, by design
    if (op.kind === "add-criterion") {
      const scenario = op.scenario;
      if (criteria.some((c) => c.scenario === scenario)) {
        return { error: `a criterion with scenario "${scenario}" is already registered` };
      }
      // Ids are dense and monotonic: max existing c-N + 1, never criteria.length,
      // so a hand-edited plan with a gap cannot produce a collision.
      const maxId = criteria.reduce((m, c) => {
        const n = Number(/^c-(\d+)$/.exec(c.id)?.[1] ?? 0);
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      criteria = [
        ...criteria,
        {
          id: `c-${maxId + 1}`,
          scenario,
          surface: op.surface ?? "logic",
          expectedEvidence: op.expectedEvidence ?? "",
          capturedEvidence: null,
          status: "open",
        },
      ];
      continue;
    }
    if (workPhases.some((w) => w.id === op.id)) {
      return { error: `work phase '${op.id}' is already in this plan` };
    }
    workPhases = [...workPhases, { id: op.id, title: op.title, status: "pending", tasks: [] }];
  }
  return { plan: { ...plan, criteria, workPhases } };
}
```

The steering refusal rule is satisfied by construction: both ops only append, so
`remainingWorkPhases` and `unmetCriteria` can only grow. Nothing here can mark a phase
`done`, mark a criterion `met`, or set `supersededBy`.

### 2. MODIFY plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts

#### 2a. New verbs

BEFORE (:56)
```ts
const VERBS: ReadonlySet<string> = new Set<GoalplanVerb>(["init", "show", "validate", "steer"]);
```

AFTER
```ts
const VERBS: ReadonlySet<string> = new Set<GoalplanVerb>([
  "init", "show", "validate", "steer", "add-criterion", "add-work-phase",
]);
```

`GoalplanVerb` (declared above :40) gains the two literals. The error text at :62
becomes `(expected init|show|validate|steer|add-criterion|add-work-phase)`.

#### 2b. New flags

BEFORE (:65-76) - the argv loop handles `--objective --slug --criterion --cwd --session --batch-json`.

AFTER - add three cases inside the same loop:
```ts
    else if (a === "--surface") out.surface = argv[++i];
    else if (a === "--id") out.id = argv[++i];
    else if (a === "--title") out.title = argv[++i];
```

`GoalplanCliArgs` gains `surface?: string; id?: string; title?: string;`.

#### 2c. init threads surface into buildGoalplan (the v2 fix)

BEFORE (:181-184)
```ts
    const plan = buildGoalplan({
      objective,
      criteria: args.criteria.map((scenario) => ({ scenario })),
    });
```

AFTER
```ts
    // A v2 plan requires a surface per criterion (goalplan.ts:801-803). Without
    // this, init-time criteria produced a plan that could never validate.
    const surface = (args.surface ?? "logic") as "logic" | "web" | "tui";
    if (!["logic", "web", "tui"].includes(surface)) {
      return { output: `loop init: --surface must be logic|web|tui (got '${args.surface}')`, code: 1 };
    }
    const plan = buildGoalplan({
      objective,
      criteria: args.criteria.map((scenario) => ({ scenario, surface })),
    });
```

#### 2d. The two new verbs delegate to steer

Insert before `if (args.verb === "steer") return runSteer(args);` (:201):

```ts
  // Both verbs are thin sugar over applySteeringBatch: that path already owns the
  // lock, the idempotency key, and the ledger entry, so a second write path would
  // be a second chance to corrupt the plan (issue #29 minimal-slice rule).
  if (args.verb === "add-criterion" || args.verb === "add-work-phase") {
    return runAddOp(args);
  }
  if (args.verb === "steer") return runSteer(args);
```

NEW function beside `runSteer`:

```ts
function runAddOp(args: GoalplanCliArgs): GoalplanCliResult {
  const session = (args.session ?? "").trim();
  if (session.length === 0) return { output: `loop ${args.verb}: --session <id> is required`, code: 1 };
  if (!isCanonicalSessionId(session)) {
    return {
      output: `loop ${args.verb}: --session "${session}" is not a canonical session id - it would resolve to a different state file and steer another goal`,
      code: 1,
    };
  }
  const slug = readState(args.cwd, session).slug;
  if (!slug) {
    return { output: `loop ${args.verb}: session '${session}' has no bound goalplan - run \`cxc loop init --session ${session}\` first`, code: 1 };
  }

  let op: Record<string, unknown>;
  let summary: string;
  if (args.verb === "add-criterion") {
    const scenario = (args.criteria[0] ?? "").trim();
    if (scenario.length === 0) {
      return { output: `loop add-criterion: --criterion "<scenario>" is required`, code: 1 };
    }
    op = { kind: "add-criterion", scenario, surface: args.surface ?? "logic" };
    summary = scenario;
  } else {
    const id = (args.id ?? "").trim();
    const title = (args.title ?? "").trim();
    if (id.length === 0 || title.length === 0) {
      return { output: "loop add-work-phase: --id <id> and --title <text> are both required", code: 1 };
    }
    op = { kind: "add-work-phase", id, title };
    summary = `${id}: ${title}`;
  }

  // The idempotency key is content-derived, so re-running the same command is a
  // recorded duplicate rather than a second criterion with the same text.
  const key = `${args.verb}-${createHash("sha256").update(summary).digest("hex").slice(0, 12)}`;
  const result = applySteeringBatch(args.cwd, slug, {
    idempotencyKey: key,
    rationale: `cxc loop ${args.verb}`,
    evidence: summary,
    ops: [op],
  });
  switch (result.kind) {
    case "applied":
      return { output: renderPlan(result.plan), code: 0 };
    case "duplicate":
      return { output: `loop ${args.verb}: already applied at ${result.entry.appliedAt} - nothing to do`, code: 0 };
    case "locked":
    case "rejected":
      return { output: `loop ${args.verb}: ${result.reason}`, code: 1 };
  }
}
```

`createHash` is imported from `node:crypto` at the top of the file.

### 3. MODIFY plugins/codexclaw/components/pabcd-state/src/goalplan.ts

#### 3a. buildGoalplan accepts a surface

BEFORE (:577-578, :587-593)
```ts
  /** seeded acceptance criteria (e.g. from the freeze EvidenceBundle). */
  criteria?: Array<{ scenario: string; expectedEvidence?: string }>;
...
  const criteria: GoalplanCriterion[] = (input.criteria ?? []).map((c, i) => ({
    id: `c-${i + 1}`,
    scenario: c.scenario,
    expectedEvidence: c.expectedEvidence ?? "",
    capturedEvidence: null,
    status: "open",
  }));
```

AFTER
```ts
  /** seeded acceptance criteria (e.g. from the freeze EvidenceBundle). */
  criteria?: Array<{ scenario: string; expectedEvidence?: string; surface?: "logic" | "web" | "tui" }>;
...
  const criteria: GoalplanCriterion[] = (input.criteria ?? []).map((c, i) => ({
    id: `c-${i + 1}`,
    scenario: c.scenario,
    // schemaVersion 2 refuses an unclassified criterion (:801-803). Defaulting to
    // "logic" keeps v1 plans byte-identical while making v1->v2 promotion legal.
    surface: c.surface ?? "logic",
    expectedEvidence: c.expectedEvidence ?? "",
    capturedEvidence: null,
    status: "open",
  }));
```

#### 3b. The phantom final-gate hint (the second half of #5)

BEFORE (:805-809)
```ts
  const gate = plan.finalGate;
  if (!gate) {
    out.push('schemaVersion 2 requires a finalGate - open one with `cxc loop final-gate open`');
    return out;
  }
```

AFTER
```ts
  const gate = plan.finalGate;
  if (!gate) {
    // No `final-gate` verb exists in goalplan-cli.ts or cli.ts (002 A/#29). Naming a
    // command the user cannot run is worse than naming none, so this points at the
    // review-round surface that actually produces a gate.
    out.push(
      "schemaVersion 2 requires a finalGate - open a final-gate review round with " +
        "`cxc review-round open --lane final_gate --session <id>` and record its verdict",
    );
    return out;
  }
```

The verdict of this campaign is REMOVE the phantom, not implement it: a real
`final-gate open` verb is a new gate surface with its own review-round binding, well
outside a criteria-registration slice. File it as a follow-up issue (see section 5).

#### 3c. readGoalplan diagnostics (issue #29's "no plan found" complaint)

BEFORE (:518-528)
```ts
/** Read a goalplan; returns null on absent/unreadable/malformed (never throws). */
export function readGoalplan(cwd: string, slug: string): Goalplan | null {
  try {
    const path = goalplanPath(cwd, slug);
    assertNotSymlink(path);
    const raw = readFileSync(path, "utf8");
    return reviveGoalplan(JSON.parse(raw), validateGoalplanSlug(slug));
  } catch {
    return null;
  }
}
```

AFTER
```ts
/** Why a read failed. `null` on the diagnostic means the plan loaded. */
export type GoalplanReadDiagnostic =
  | { kind: "absent"; path: string }
  | { kind: "unreadable"; path: string; detail: string }
  | { kind: "invalid-json"; path: string; detail: string }
  | { kind: "invalid-shape"; path: string; field: string; detail: string };

export interface GoalplanReadResult {
  plan: Goalplan | null;
  diagnostic: GoalplanReadDiagnostic | null;
}

/**
 * Read a goalplan and say why when it fails.
 *
 * The bare `catch { return null }` made every failure - absent file, bad JSON, a
 * `steeringLog` the reviver rejected - surface identically as "no plan found at
 * slug X" (goalplan-cli.ts:209), so a malformed plan was indistinguishable from
 * no plan at all (issue #29).
 */
export function readGoalplanDetailed(cwd: string, slug: string): GoalplanReadResult {
  const path = goalplanPath(cwd, slug);
  let raw: string;
  try {
    assertNotSymlink(path);
    raw = readFileSync(path, "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const detail = e?.message ?? String(err);
    if (e?.code === "ENOENT") return { plan: null, diagnostic: { kind: "absent", path } };
    return { plan: null, diagnostic: { kind: "unreadable", path, detail } };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      plan: null,
      diagnostic: { kind: "invalid-json", path, detail: err instanceof Error ? err.message : String(err) },
    };
  }
  const plan = reviveGoalplan(parsed, validateGoalplanSlug(slug));
  if (!plan) {
    const field = firstInvalidField(parsed);
    return {
      plan: null,
      diagnostic: {
        kind: "invalid-shape",
        path,
        field,
        detail: `the goalplan parsed as JSON but field '${field}' did not satisfy the schema`,
      },
    };
  }
  return { plan, diagnostic: null };
}

/** Back-compat wrapper: every existing caller keeps its null-on-failure contract. */
export function readGoalplan(cwd: string, slug: string): Goalplan | null {
  return readGoalplanDetailed(cwd, slug).plan;
}

/**
 * Name the first field the reviver would have rejected. Mirrors reviveGoalplan's
 * required set in declaration order; `"(unknown)"` when the object looks structurally
 * fine and the rejection came from a nested reviver such as steeringLog.
 */
function firstInvalidField(parsed: unknown): string {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return "(root: not an object)";
  const o = parsed as Record<string, unknown>;
  if (typeof o.objective !== "string") return "objective";
  if (typeof o.slug !== "string") return "slug";
  if (!Array.isArray(o.workPhases)) return "workPhases";
  if (!Array.isArray(o.criteria)) return "criteria";
  if (typeof o.host !== "object" || o.host === null) return "host";
  if (o.steeringLog !== undefined && !Array.isArray(o.steeringLog)) return "steeringLog";
  return "(unknown)";
}
```

#### 3d. goalplan-cli surfaces the diagnostic

BEFORE (`goalplan-cli.ts:207-210`)
```ts
  const plan = readGoalplan(args.cwd, slug);
  if (!plan) {
    return { output: `loop ${args.verb}: no plan found at slug '${slug}'`, code: 1 };
  }
```

AFTER
```ts
  const read = readGoalplanDetailed(args.cwd, slug);
  if (!read.plan) {
    const d = read.diagnostic;
    const detail =
      d?.kind === "absent"
        ? `no plan found at slug '${slug}' (${d.path} does not exist) - run \`cxc loop init --objective "..."\``
        : d?.kind === "invalid-json"
          ? `the plan at ${d.path} is not valid JSON: ${d.detail}`
          : d?.kind === "invalid-shape"
            ? `the plan at ${d.path} is structurally invalid - field '${d.field}': ${d.detail}`
            : `the plan at ${d?.path ?? slug} could not be read: ${d?.kind === "unreadable" ? d.detail : "unknown"}`;
    return { output: `loop ${args.verb}: ${detail}`, code: 1 };
  }
  const plan = read.plan;
```

The same substitution applies at `runSteer` (:129-132) and `runAddOp`, so a malformed
plan never again reports as an unbound session.

### 4. MODIFY plugins/codexclaw/components/pabcd-state/src/hook.ts

`hook.ts:1128` tells the agent to hand-edit `.codexclaw/goalplans/<slug>/goalplan.json`.
Replace that pointer with the now-real verbs:

```ts
    "Register the plan before the E8 gate can certify it:",
    "  cxc loop add-work-phase --session <id> --id wp01-<slice> --title \"<what it lands>\"",
    "  cxc loop add-criterion --session <id> --criterion \"<observable outcome>\" --surface logic|web|tui",
```

### 5. Deliberately NOT in this slice (file as issues)

- A real `cxc loop final-gate open` verb. 3b removes the phantom; building the gate
  surface is its own campaign unit.
- `remove-criterion` / `supersede-work-phase`. Both are weakening ops and need the
  steering refusal rule designed first (loop/SKILL.md:230).

## TESTS

MODIFY `plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts`

1. "buildGoalplan defaults every criterion surface to logic" - and an explicit
   `surface: "web"` survives.
2. "a v2 plan built from init-time criteria validates" - build with one criterion,
   set `schemaVersion: 2`, and assert the validation reasons do NOT include
   `/no valid surface/`. This is the regression for the 002 A finding that v2 criteria
   were unconstructible.
3. "readGoalplanDetailed distinguishes absent from malformed" - three cases against a
   `mkdtempSync` cwd: no file -> `kind: "absent"`; `"{ not json"` -> `kind: "invalid-json"`;
   `JSON.stringify({ objective: 1 })` -> `kind: "invalid-shape", field: "objective"`.
4. "readGoalplan still returns null for all three" - the back-compat contract.
5. "the finalGate reason names a runnable command" - force a v2 plan with no
   `finalGate` and assert the reason does NOT match `/final-gate open/`.

NEW `plugins/codexclaw/components/pabcd-state/test/steering-ops.test.ts`

6. "add-criterion appends with a dense id and the given surface" - apply a batch to a
   plan with `c-1` and assert the new one is `c-2` with `surface: "web"`.
7. "ids survive a gap" - a plan whose only criterion is `c-7` yields `c-8`, not `c-2`.
8. "add-criterion is idempotent by scenario" - the same scenario twice is a
   `rejected` with `/already registered/`.
9. "add-work-phase appends pending with no tasks", and a duplicate id is rejected.
10. "a malformed op rejects the WHOLE batch" - a batch of
    `[valid add-criterion, add-work-phase without title]` leaves `goalplan.json`
    byte-identical. This pins the all-or-nothing rule.
11. "steering can never weaken" - after any add batch,
    `remainingWorkPhases(next).length >= remainingWorkPhases(prev).length` and
    `unmetCriteria(next).length >= unmetCriteria(prev).length`.
12. "unknown kinds still reject" - `kind: "remove-criterion"` matches
    `/is not supported/` and names the three legal kinds.
13. "the idempotency key is content-derived" - the same `add-criterion` CLI call twice
    returns `duplicate` on the second, with exit code 0 and one criterion on disk.

NEW cases in `test/goal-gate.test.ts` (or `goal-active.test.ts`, wherever the CLI harness
already lives)

14. "the issue #29 end-to-end path" - `loop init`, then `loop add-work-phase`, then
    `loop add-criterion`, then `loop validate` must NOT report
    `/plan is empty: no workPhases/`. This is the whole issue in one test.
15. "add-criterion on an unbound session" - matches `/has no bound goalplan/`.
16. "add-criterion with a non-canonical --session" - matches `/not a canonical session id/`.

## Verification (C)

Run from the repo root; each command must exit 0.

```powershell
node --test --test-concurrency=1 "plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts" "plugins/codexclaw/components/pabcd-state/test/steering-ops.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/components/pabcd-state/test/goal-gate.test.ts" "plugins/codexclaw/components/pabcd-state/test/goal-active.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/components/pabcd-state/test/final-gate.test.ts"
npm test
node plugins/codexclaw/scripts/gate.mjs
```

`final-gate.test.ts` is listed because 3b edits a string that suite asserts on.

Manual acceptance - the exact dead end from issue #29. Every step must exit 0 and the
last must not say "plan is empty":

```powershell
node bin/codexclaw.mjs loop init --objective "win-linux optimization campaign" --session cli
node bin/codexclaw.mjs loop add-work-phase --session cli --id wp04-loop-criteria --title "criteria write path"
node bin/codexclaw.mjs loop add-criterion --session cli --criterion "criteria are registrable from the CLI" --surface logic
node bin/codexclaw.mjs loop show --slug win-linux-optimization-campaign
node bin/codexclaw.mjs loop validate --slug win-linux-optimization-campaign
```

Malformed-plan diagnostic acceptance, expected exit 1 naming the field:

```powershell
'{ "objective": 1 }' | Set-Content -Encoding utf8 .codexclaw/goalplans/win-linux-optimization-campaign/goalplan.json
node bin/codexclaw.mjs loop show --slug win-linux-optimization-campaign
```

Expected: a message containing `structurally invalid` and `field 'objective'`, NOT
`no plan found`.

WSL parity (mkdir-based locking behaves differently across drvfs), expected exit 0:

```bash
wsl -d Ubuntu -- bash -lc "cd ~/codexclaw-wsl-checkout && node --test 'plugins/codexclaw/components/pabcd-state/test/steering-ops.test.ts'"
```

Run the WSL lane from a Linux-native checkout, not `/mnt/c`: the lock is a `mkdirSync`
on the plan directory, and drvfs is exactly the tier 001 section 2.4 says to distrust
for lock-dependent behavior.

Record the C>D receipt with `cxc receipt test -- npm test` per CHECK-BINDING-01.

