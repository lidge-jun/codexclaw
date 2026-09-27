# wp4 — Goalplan decisions for issue #262

Record a submitted user question in the goalplan and link only the affected work phases to it. An open linked decision makes those phases unavailable to `ready`, cursor selection, task completion, and close/recovery; recording an answer restores their ordinary readiness. The `ask` verb records a question **after** the host sends it. It never sends a message or supplies an answer. This unit uses the delegated contract (`open|decided`, free-text answer and optional recommendation); issue #262's earlier `options[]`/`withdrawn` sketch is outside this unit.

## Phase contract

- Work phase: `wp4`, issue [#262](https://github.com/lidge-jun/codexclaw/issues/262). Docs-only implementation record; builder changes code in a later phase.
- Class: C3, with C4 care for the scheduler/enforcement paths. No schema-version bump: both fields are opt-in and absent on old plans.
- Completion: an open decision hides only its linked phases, including their tasks and explicit cursor; `decide` releases the wait without changing phase status or clearing `blockedReason`; malformed decision data fails closed; old plans round-trip without acquiring new fields.
- E8 decision: `validateGoalplan` fails while a linked phase is pending/in progress because that phase remains unfinished. An unrelated open question does not veto an otherwise complete plan. A phase marked `done` while it still awaits an open decision is an integrity error, so hand editing cannot certify completion by bypassing the wait. This follows the rule that only the dependent action stays pending (`plugins/codexclaw/skills/dev/references/async-questions.md:43-60`) and the existing remaining-work gate (`plugins/codexclaw/components/pabcd-state/src/goalplan.ts:1491-1494`).

## File change map

All paths below are repository-relative. Anchors were rechecked against `codex/issue-train-0927` at `958441a9` on 2026-09-27. No new source module, separate decision store, or Interview ledger change.

### 1. MODIFY `plugins/codexclaw/components/pabcd-state/src/goalplan.ts`

The phase schema is at `:124-136`; the plan schema at `:216-236`; the explicit reviver is at `:507-606`; invalid-shape diagnostics are at `:806-843`; atomic publication and lock are at `:737-861`. Add the following types/fields, with no defaults on `buildGoalplan`:

```diff
 export interface GoalplanWorkPhase {
   // existing fields
   dependsOn?: string[];
+  /** Decision ids; any open target pauses this phase without changing status. */
+  awaitsDecision?: string[];
   blockedReason?: string;
 }
+export interface GoalplanDecision {
+  id: string;
+  question: string;
+  recommendation?: string;
+  status: "open" | "decided";
+  answer?: string;
+  askedAt: string;
+  decidedAt?: string;
+}
 export interface Goalplan {
   // existing fields
   workPhases: GoalplanWorkPhase[];
+  decisions?: GoalplanDecision[];
 }
```

Use the existing `LIFECYCLE_ID_RE` at `:1120` for decision ids. Add this complete structural reviver before `reviveGoalplan` at `:507`. It rejects malformed optional fields rather than dropping them; otherwise a stored wait could vanish when the plan is read. Absence and `[]` stay distinct. Keep the exact string values on disk; use trimming only to test emptiness.

```ts
function validIsoTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString() === value;
}

function reviveDecisions(value: unknown): GoalplanDecision[] | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return "invalid";
  const decisions: GoalplanDecision[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return "invalid";
    const d = item as Record<string, unknown>;
    if (typeof d.id !== "string" || !LIFECYCLE_ID_RE.test(d.id)
      || typeof d.question !== "string" || !d.question.trim()
      || !validIsoTime(d.askedAt)
      || (d.recommendation !== undefined && (typeof d.recommendation !== "string" || !d.recommendation.trim()))) return "invalid";
    if (d.status === "open") {
      if (d.answer !== undefined || d.decidedAt !== undefined) return "invalid";
      decisions.push({ id: d.id, question: d.question, status: "open", askedAt: d.askedAt,
        ...(d.recommendation === undefined ? {} : { recommendation: d.recommendation as string }) });
    } else if (d.status === "decided") {
      if (typeof d.answer !== "string" || !d.answer.trim() || !validIsoTime(d.decidedAt)) return "invalid";
      decisions.push({ id: d.id, question: d.question, status: "decided", answer: d.answer,
        askedAt: d.askedAt, decidedAt: d.decidedAt,
        ...(d.recommendation === undefined ? {} : { recommendation: d.recommendation as string }) });
    } else return "invalid";
  }
  return decisions;
}
```

At `:525-550`, parse `w.awaitsDecision` with the same strict nonempty-string-array rule as `reviveDependsOn`; reject `"invalid"`, then attach the value to `phase` only when present. At `:581-605`, call `reviveDecisions(o.decisions)`, reject `"invalid"`, and attach only when present. At `firstInvalidField` (`:820-842`), report `"workPhases[].awaitsDecision"` and `"decisions"` in the same order as the reviver. For a malformed decision entry, report `"decisions"`, not `(unknown)`.

Add these pure helpers beside `isRunnablePhase` at `:983` and replace its body. Missing references fail closed in selection even if the caller skipped integrity validation:

```ts
export function openDecisionIdsForPhase(plan: Goalplan, wp: GoalplanWorkPhase): string[] {
  return [...new Set(wp.awaitsDecision ?? [])].filter((id) =>
    plan.decisions?.find((decision) => decision.id === id)?.status !== "decided");
}

function workPhaseReadyConditionsMet(plan: Goalplan, wp: GoalplanWorkPhase): boolean {
  return workPhaseDependenciesMet(plan, wp) && openDecisionIdsForPhase(plan, wp).length === 0;
}

function isRunnablePhase(plan: Goalplan, wp: GoalplanWorkPhase): boolean {
  return (wp.status === "pending" || wp.status === "in_progress")
    && workPhaseReadyConditionsMet(plan, wp);
}
```

`readyWorkPhases` and `readyTasks` then inherit the gate at `:990-1004`. In `dependencyWaitReasons` (`:1050-1072`), after the existing phase-dependency reason and before the task loop, append `work-phase ${wp.id} awaits decision ${ids.join(", ")}` for nonempty `openDecisionIdsForPhase`, including when independent work is ready. In `dependencyDeadlock` (`:1078-1117`), append the same decision reason for a waiting phase before entering its task loop; keep the existing explicit-blocked reason first for `status === "blocked"`. A phase waiting on both a prerequisite and a decision should report both direct reasons; do not let the prerequisite branch `continue` before the decision reason. Preserve the current dependency/task reason strings for legacy plans.

At `goalplanDefinitionIntegrityReasons` (`:1311-1387`), add exact checks: duplicate decision ids; duplicate ids within one `awaitsDecision`; unknown decision ids; and a `done` phase that awaits an open decision. Example messages: `duplicate decision id 'dec-1' makes awaitsDecision references ambiguous`, `work phase wp-a awaits unknown decision 'dec-missing'`, and `work phase wp-a is done while decision dec-1 is open`. Put these before task/criterion diagnostics so `ready` and E8 expose the broken reference promptly. `ready` already calls this function before returning data (`goalplan-cli.ts:427-437`).

```ts
const decisionsById = new Map((plan.decisions ?? []).map((decision) => [decision.id, decision]));
for (const id of duplicateIds((plan.decisions ?? []).map((decision) => decision.id))) {
  reasons.push(`duplicate decision id '${id}' makes awaitsDecision references ambiguous`);
}
for (const phase of plan.workPhases) {
  for (const id of duplicateIds(phase.awaitsDecision ?? [])) {
    reasons.push(`work phase ${phase.id} awaits decision '${id}' more than once`);
  }
  for (const id of new Set(phase.awaitsDecision ?? [])) {
    const decision = decisionsById.get(id);
    if (!decision) reasons.push(`work phase ${phase.id} awaits unknown decision '${id}'`);
    else if (phase.status === "done" && decision.status === "open") {
      reasons.push(`work phase ${phase.id} is done while decision ${id} is open`);
    }
  }
}
```

Add the following transitions beside `addGoalplanTask` (`:1127-1171`). They are pure; the CLI owns the locked read/write. The `ask` duplicate check applies only to still-open questions and compares trimmed question text exactly. Reusing a decided question's text is allowed as a new id. Do not mutate phase status or `blockedReason` on `decide`.

```ts
export function askGoalplanDecision(
  plan: Goalplan,
  input: { id: string; question: string; recommendation?: string; workPhaseIds: string[]; askedAt: string },
): GoalplanLifecycleResult {
  const id = input.id.trim();
  const question = input.question.trim();
  const recommendation = input.recommendation?.trim();
  const workPhaseIds = input.workPhaseIds.map((phaseId) => phaseId.trim());
  if (!LIFECYCLE_ID_RE.test(id)) return { kind: "rejected", reason: "decision id must be a short lowercase id, e.g. dec-1" };
  if (!question) return { kind: "rejected", reason: "decision question must not be empty" };
  if (input.recommendation !== undefined && !recommendation) return { kind: "rejected", reason: "decision recommendation must not be empty" };
  if (!validIsoTime(input.askedAt)) return { kind: "rejected", reason: "decision askedAt must be an ISO timestamp" };
  if (plan.decisions?.some((decision) => decision.id === id)) return { kind: "rejected", reason: `decision '${id}' is already in this plan` };
  const duplicate = plan.decisions?.find((decision) => decision.status === "open" && decision.question.trim() === question);
  if (duplicate) return { kind: "rejected", reason: `question is already open as decision '${duplicate.id}'` };
  if (workPhaseIds.some((phaseId) => !phaseId) || new Set(workPhaseIds).size !== workPhaseIds.length) {
    return { kind: "rejected", reason: "--work-phase requires distinct non-empty ids" };
  }
  for (const phaseId of workPhaseIds) {
    const phase = plan.workPhases.find((wp) => wp.id === phaseId);
    if (!phase) return { kind: "rejected", reason: `work phase '${phaseId}' is not in this plan` };
    if (phase.status === "done" || phase.status === "superseded") {
      return { kind: "rejected", reason: `work phase '${phaseId}' is ${phase.status} and cannot await a decision` };
    }
  }
  const decision: GoalplanDecision = { id, question, status: "open", askedAt: input.askedAt,
    ...(recommendation === undefined ? {} : { recommendation }) };
  const next: Goalplan = { ...plan, decisions: [...(plan.decisions ?? []), decision],
    workPhases: plan.workPhases.map((wp) => workPhaseIds.includes(wp.id)
      ? { ...wp, awaitsDecision: [...(wp.awaitsDecision ?? []), id] } : wp) };
  const reasons = goalplanDefinitionIntegrityReasons(next);
  return reasons.length ? { kind: "rejected", reason: reasons.join("; ") } : { kind: "changed", plan: next };
}

export function decideGoalplanDecision(
  plan: Goalplan, id: string, answer: string, decidedAt: string,
): GoalplanLifecycleResult {
  const decision = plan.decisions?.find((candidate) => candidate.id === id.trim());
  if (!decision) return { kind: "rejected", reason: `decision '${id.trim()}' is not in this plan` };
  if (!answer.trim()) return { kind: "rejected", reason: "decision answer must not be empty" };
  if (!validIsoTime(decidedAt)) return { kind: "rejected", reason: "decision decidedAt must be an ISO timestamp" };
  if (decision.status === "decided") return decision.answer === answer.trim()
    ? { kind: "unchanged", plan, reason: `decision '${id.trim()}' is already decided` }
    : { kind: "rejected", reason: `decision '${id.trim()}' already has a different answer` };
  const next: Goalplan = { ...plan, decisions: plan.decisions!.map((candidate) => candidate.id === decision.id
    ? { ...candidate, status: "decided" as const, answer: answer.trim(), decidedAt } : candidate) };
  return { kind: "changed", plan: next };
}
```

Enforcement bypass record: `effectiveActiveWorkPhaseId` falls back to raw dependency checks at `:2043-2049`; replace both fallback predicates with `isRunnablePhase(plan, wp)`. `closeFixedWorkPhase` checks only prerequisites at `:1795` and its successor search/recorded-marker branches at `:1822-1877`; make the following exact substitutions:

```diff
-if (!workPhaseDependenciesMet(plan, current)) {
-  return { kind: "dependencies_unmet", unmet: unmetPhaseDependencyIds(plan, current) };
+if (!workPhaseReadyConditionsMet(plan, current)) {
+  return { kind: "dependencies_unmet", unmet: [
+    ...unmetPhaseDependencyIds(plan, current),
+    ...openDecisionIdsForPhase(plan, current).map((id) => `decision:${id}`),
+  ] };
 }
 // In BOTH after/wrap successor finds at :1822-1827:
-wp.status === "pending" && workPhaseDependenciesMet(closedPlan, wp)
+isRunnablePhase(closedPlan, wp)
 // For the retained in-progress cursor at :1869-1872:
-wp.status === "in_progress" && workPhaseDependenciesMet(closedPlan, wp)
+wp.status === "in_progress" && workPhaseReadyConditionsMet(closedPlan, wp)
 // For a named successor at :1875:
-!workPhaseDependenciesMet(closedPlan, named)
+!workPhaseReadyConditionsMet(closedPlan, named)
 // For resumeAbsentTarget at :1954:
-!workPhaseDependenciesMet(plan, named)
+!workPhaseReadyConditionsMet(plan, named)
 // For effectiveActiveWorkPhaseId at :2043-2049, in both finds:
-wp.status === "in_progress" && workPhaseDependenciesMet(plan, wp)
+wp.status === "in_progress" && isRunnablePhase(plan, wp)
-wp.status === "pending" && workPhaseDependenciesMet(plan, wp)
+wp.status === "pending" && isRunnablePhase(plan, wp)
```

Keep the existing `dependencies_unmet` and `successor_lost` result variants; callers already handle them. Change `absentSuccessorDetail` at `:1918-1925` to say `now waits for a prerequisite or decision`. A recovered marker may never activate a newly waiting phase. This is necessary because `advanceWorkPhase` calls `closeFixedWorkPhase` at `:2012`, and hooks/orchestrator derive their target from `effectiveActiveWorkPhaseId` (`hook.ts:346`, `orchestrate-cli.ts:83`). No hook-specific filter is needed once these common helpers are fixed.

### 2. MODIFY `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts`

Imports are at `:14-38`; parser and per-verb flag rules are at `:51-235`; locked lifecycle mutation is at `:483-588`; `ready` at `:427-470`; `show` at `:591-614`; dispatch/help at `:621-739`. Import `askGoalplanDecision`, `decideGoalplanDecision`, `openDecisionIdsForPhase`, and `goalplanDefinitionIntegrityReasons` (already imported). Extend the existing parser, without allowing these flags on other verbs:

```diff
 export type GoalplanVerb =
   // existing verbs
+  | "ask" | "decide"
 export interface GoalplanCliArgs {
   // existing fields
+  question?: string;
+  recommendation?: string;
+  answer?: string;
+  workPhaseIds?: string[];
 }
 type GoalplanFlag =
   // existing flags
+  | "--question" | "--recommendation" | "--answer";
 const VERBS = new Set<GoalplanVerb>([
   // existing verbs
+  "ask", "decide",
 ]);
```

Add verb rules: `ask` allows `--session`, `--id`, `--question`, `--recommendation`, repeated `--work-phase`, `--cwd`; `decide` allows `--session`, `--id`, `--answer`, `--cwd`. Their usage strings are exactly `ask --session <id> --id <id> --question <text> [--recommendation <text>] [--work-phase <id>]... [--cwd <path>]` and `decide --session <id> --id <id> --answer <text> [--cwd <path>]`. Update the unknown-verb diagnostic at `:164-167`, help's verb list at `:626`, and help notes at `:629-641`. In the parser initializer at `:171`, add `workPhaseIds: []`; add cases for the three new value flags and, for `--work-phase`, push trimmed distinct nonempty ids only when `selected === "ask"`, otherwise retain its current singleton `workPhaseId` behavior. The verb rule handles wrong-verb flags; the existing missing-value and repeat rules at `:182-204` handle syntax before any write.

Add `runDecision` before `runLifecycle`; dispatch it before slug-based reads at `:712-720`. Follow the same canonical-session and bound-slug checks as `runLifecycle` (`:483-498`), including the same no-write error. Validate all required fields before entering the lock. Then use this exact locked transition shape:

```ts
type DecisionCommit = { kind: "rejected"; reason: string } | { kind: "changed" } | { kind: "unchanged"; reason: string };
const locked = withGoalplanWriteLock<DecisionCommit>(args.cwd, slug, (plan) => {
  const result = args.verb === "ask"
    ? askGoalplanDecision(plan, {
        id, question: args.question!, recommendation: args.recommendation,
        workPhaseIds: args.workPhaseIds ?? [], askedAt: new Date().toISOString(),
      })
    : decideGoalplanDecision(plan, id, args.answer!, new Date().toISOString());
  if (result.kind === "rejected") return { kind: "rejected", reason: result.reason };
  if (result.kind === "unchanged") return { kind: "unchanged", reason: result.reason };
  writeGoalplan(args.cwd, result.plan);
  return { kind: "changed" };
});
```

Map `locked`/`unreadable` to code 1 and `loop ${args.verb}: ${locked.reason}`; rejected to code 1 with its reason; unchanged to code 0 with `nothing to do`; changed to code 0 naming id and slug. Do not append an Interview event or claim the question was sent. `withGoalplanWriteLock` already reads under lock and returns `unreadable` for a bad plan (`goalplan.ts:737-804`); `writeGoalplan` performs the atomic write (`goalplan.ts:845-861`). `ask` is intentionally separate from `applySteeringBatch`, which only accepts additive criterion/work-phase operations (`goalplan-cli.ts:343-405`).

For `ready`, retain `readyWorkPhases`/`readyTasks` output and add `openDecisions` (id, question, recommendation, askedAt) and `awaitingDecisions` (workPhaseId, decisionIds) in JSON, plus readable lines in text. Include the new keys/lines only when `plan.decisions !== undefined`, keeping the old plan's JSON/text shape unchanged. A linked phase appears in `awaitingDecisions` only while its status is pending/in_progress and at least one referenced decision is open. `show` lists each open decision and a `waiting: wp-a, wp-b` line derived from `awaitsDecision`; keep explicit blocked phases in their existing status display. Neither command mutates the plan.

### 3. MODIFY `plugins/codexclaw/skills/loop/references/durable-goalplan.md`

At schema bullets `:45-77`, add optional `decisions[]` and `workPhase.awaitsDecision?: string[]` with the exact shape above and explicit absent/empty compatibility. At CLI bullets `:79-104`, document `ask` and `decide`, the required ordering (send via the host's question tool, then record with `ask`; on a user reply record with `decide`), and that `ask` never sends. Document `ready`'s `openDecisions`/`awaitingDecisions` and `show`'s waiting display; explain that `decide` only changes the decision record. Do not state that every open decision blocks the whole goal.

### 4. MODIFY `plugins/codexclaw/skills/dev/references/async-questions.md`

After `:43-49`, add: “For a bound goalplan, after the host confirms a question was submitted, run `cxc loop ask --session <id> --id <decision-id> --question <exact text> [--recommendation <text>] [--work-phase <id>]...` to keep it in the existing plan. Record each dependent work phase. Check `cxc loop show` before sending a similar question after compaction. When the user answers, run `cxc loop decide --session <id> --id <decision-id> --answer <reply>` and resume only newly runnable phases. `ask` does not deliver a question; a CLI success is no proof of host submission.” Keep the optional-answer assumption rule at `:50-55`: link a phase only while its action truly requires the reply. Keep Interview separate (`:69`).

### 5. MODIFY `plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts`

Reuse `fixture`, `workspace`, `planText`, `ledgerText`, and `cli` at `:18-72`. Add these named tests with exact assertions (each goes red before this unit because the verb/field or readiness rule is absent):

1. `ask records an open decision and hides only linked work phases` — add independent `wp-free` to the fixture; call `ask --session sess-public --id dec-1 --question "Choose API" --recommendation "Use v2" --work-phase wp-live`. Assert exit 0, stored decision has open status and ISO `askedAt`, `wp-live.awaitsDecision === ["dec-1"]`, `wp-free` remains in `readyWorkPhases`, `wp-live` and its tasks do not; `ready --json` contains `openDecisions[0].id === "dec-1"` and `awaitingDecisions` names `wp-live`; `show` names the question and waiting phase. This tests the live cursor too: `effectiveActiveWorkPhaseId` must choose `wp-free`.
2. `decide releases linked phases without unblocking explicit blocks` — start with one pending linked phase and one `status: "blocked"` linked phase with `blockedReason: "vendor"`; ask and then decide with a nonempty answer. Assert `answer`, `decidedAt`, and `status === "decided"`; the pending phase is ready, the blocked phase remains blocked with its original reason, and no `awaitingDecisions` entry remains.
3. `ask rejects duplicate open question and unknown phase without a write` — after a valid ask, snapshot `planText` and `ledgerText`; retry same trimmed question under `dec-2`, then try a distinct question with `--work-phase ghost`. Assert both code 1, diagnostic names `dec-1`/`ghost` respectively, and both files are byte-identical to snapshots.
4. `ask and decide enforce per-verb flags before writing` — parse wrong-verb `--answer`/`--question`, duplicate singleton flags, duplicate `--work-phase`, empty `--question=`, and missing value; assert `error` and unchanged plan/ledger. Check help contains both exact usage strings, and update the unknown-verb expected list at `:494-496`.
5. `decide is idempotent only for the same answer` — second identical answer returns code 0 and byte-identical plan; different answer returns code 1 and byte-identical plan. This guards against silent answer replacement after compaction.

### 6. MODIFY `plugins/codexclaw/components/pabcd-state/test/work-phase-states.test.ts`

Reuse `phase`, `plan`, and `roundTrip` at `:31-40` and `:155-161`. Add these named tests:

1. `open decision excludes linked phase from cursor close and successor selection` — use a linked `in_progress` cursor and an independent pending phase; assert `effectiveActiveWorkPhaseId` selects the independent phase, `advanceWorkPhase` cannot close the linked one, and after the independent phase closes the linked one is still pending/in_progress and `dependencyDeadlock()?.reasons` names the decision. Also cover `closeFixedWorkPhase` and `resumeAbsentTarget` with a recorded linked successor; both must refuse activation.
2. `decision wait reasons appear beside ready independent work` — with a free pending phase and a linked pending phase, assert `dependencyDeadlock() === null` and `dependencyWaitReasons()` contains `work-phase linked awaits decision dec-1`.
3. `invalid decision fields and dangling references fail closed` — import `readGoalplanDetailed` and `goalplanDefinitionIntegrityReasons`. Hand edit stored JSON to put a malformed `decisions`, malformed `awaitsDecision`, then a valid array referencing `ghost`; assert malformed variants give `readGoalplan(...) === null` with `readGoalplanDetailed(...).diagnostic.field` naming the field, while a dangling reference yields a definition-integrity reason and no linked phase in `readyWorkPhases`. Add a `ready` CLI assertion to `goalplan-public-surface.test.ts` using its existing `cli` helper: code 1 and the same unknown-decision diagnostic. Repeat for duplicate decision id and duplicate phase reference.
4. `legacy plan round trips without decision fields` — compare the old plan and read-back plan excluding `updatedAt` (which `writeGoalplan` always refreshes at `goalplan.ts:858`); assert `"decisions" in back === false`, `"awaitsDecision" in back.workPhases[0] === false`, and the old ready/validation result is unchanged. This extends the existing legacy case at `:204-209`.
5. `E8 fails a done phase waiting on an open decision but permits an unrelated open decision` — with otherwise complete schema-v1 fixtures, assert the linked/done plan has an integrity reason; assert an unlinked open decision leaves `validateGoalplan(...).ok === true`. A linked pending phase must fail through the existing `work phase(s) not done` reason.

These tests must include the negative enforcement paths because a filtered `ready` result alone cannot prove that cursor or recovery cannot advance a linked phase (`goalplan.ts:1795-1877`, `:1933-1975`, `:2033-2050`). Run focused tests with `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts" "plugins/codexclaw/components/pabcd-state/test/work-phase-states.test.ts"`, then `npm run build` (the root `package.json:21-24` defines build/test but no standalone typecheck). Run `git diff --check` after implementation. These are future builder checks; this docs-only phase did not run code tests.

## Enforcement and bypass record

**Tier:** E8 validation for plan quality and integrity; CLI write preconditions and scheduler predicates are local runtime checks outside the E1-E8 hook ladder. Any hook guidance about a waiting phase is E4 only. **Executing surface:** `goalplan.ts` reviver, integrity/ready/cursor/close/recovery helpers, `goalplan-cli.ts` locked lifecycle mutation, and the existing bound-goal completion gate. **Known bypass:** a caller can use raw library writes or edit the plan file directly; an `ask` record can be omitted after a host question; unrelated host actions are not paused. **Residual risk:** same-user plan tampering and host answers that are never recorded leave the model and plan out of sync; a manual `done` edit must be caught by integrity/E8 before completion. **Wording downgrade:** “linked work phases wait while a recorded decision is open,” not “the host is paused” or “questions are automatically captured.” **Final enforcement layer:** common readiness predicates in `goalplan.ts:983-1004,1795-1877,1933-1975,2033-2050` plus definition integrity and E8 validation at `:1311-1494`; no hook alone can enforce the wait. The negative cursor/recovery tests above are required proof of those layers.

## Activation scenarios

| Condition | Trigger and expected path |
| --- | --- |
| No decision fields | Old plan loads without synthetic fields; ready, show, E8, and write/read keep prior behavior. |
| Open, unlinked decision | Listed in `openDecisions`; independent work and E8 completion continue. |
| Open, linked decision | `ready`, tasks, cursor, successor, close and recovery refuse the linked phase; other phases continue; waits are visible even when other work is ready. |
| Two waits on one phase | Either open id keeps it waiting; deciding one leaves the other wait; deciding both restores ordinary dependency/status checks. |
| Decision answered | Store answer/time; linked phase becomes eligible only if its normal prerequisites and status permit; explicit `blocked` remains blocked. |
| Bad stored reference/shape | Structural corruption fails read; unknown/duplicate references fail integrity and `ready`/E8, and selection fails closed. |
| Repeated question/answer | Open duplicate question or conflicting decided answer is rejected without a write; same decided answer is a no-op. |
| Host submission absent | Do not run `ask`; CLI does not contact the host or imply an ask occurred. |

## Out of scope

No host question tool integration, automatic answer capture, reminder/polling mechanism, `options[]` validation, `withdrawn` status, global goal pause, schema migration/version bump, Interview ledger reuse, or new standalone decision file. Issue #262's historical option/recommendation proposal differs from this phase's delegated free-text contract; if the parent wants the issue's options semantics, it needs a separate contract decision before implementation.


## wp4 re-verification (architect 01a0e3fa-8b59-75b0-a7a4-d902727608f9, supersedes stale text above)

- **Provenance.** Anchors re-checked on `codex/issue-train-wp3` at 3637fef1 (wp2 and wp3 landed; goalplan files unchanged by them). Current line numbers: reviver ends at goalplan.ts:607; `withGoalplanWriteLock` hands the parsed plan to its callback (goalplan.ts:741/797), so `runDecision` uses that argument instead of re-reading; readiness entries goalplan.ts:986, 993-1007, 1053-1120; ID regex :1123; integrity :1314; remaining-work validation :1494-1496; close/successor :1798, :1825-1829, :1872-1879; absent-target wording :1921-1928 and gate :1957; cursor :2036-2053.
- **Stop at IDLE when only decisions remain (W4-4).** Line 205's "no hook-specific filter is needed" holds for target selection but not for the IDLE continuation block (`hook.ts:1823-1831`), which blocks every active, bound IDLE goal. Add `remainingWorkAwaitsDecisions(plan): boolean` to goalplan.ts: true when at least one work phase is not done and **every** not-done phase (pending or in progress) is decision-waiting. A phase is decision-waiting when it lists an open decision in `awaitsDecision`, or when some prerequisite in its `dependsOn` closure that is not done is itself decision-waiting (computed with a visited set, so cycles return false). A phase that is `blocked` for another reason, runnable, or waiting only on non-decision prerequisites makes the helper false and keeps today's continuation path. In `handleStop`, after the bound-plan check and before the counter, `if (remainingWorkAwaitsDecisions(plan)) return "";` (no counter write). The goal stays active and GOAL-COMPLETE-GATE-01 still refuses completion. Tests in `hook-continuation.test.ts`: `IDLE Stop releases when every remaining phase awaits an open decision` (no block, stopBlockTotal unchanged); `IDLE Stop still blocks when an independent phase is runnable` (one waiting phase plus one ready phase); after `decide`, the same plan blocks again with the arming command; `IDLE Stop still blocks when one phase waits on a decision and another is blocked for another reason`; `IDLE Stop releases when an in-progress phase gained an open decision mid-cycle and its dependents wait on it`. Also unit tests for the helper in the decisions test file.
