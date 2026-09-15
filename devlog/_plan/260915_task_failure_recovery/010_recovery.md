# Task failure report: executable plan

| Field | Contract |
|---|---|
| Goal | Safely recover confirmed task failures and close PR #179's substantive reviews. |
| Mode / class | Scoped HOTL; report contract receives C4 care. One recovery cycle. |
| Scope / resources | This checkout and PR only; no explicit token or time budget; no installation, live provider probe, merge or release. |
| Completion | Runtime/CLI positive and negative cases, affected suites/build, independent review and current CI pass; no medium-or-higher findings remain. |
| Escalation | Managed results govern all child recovery. `reconcile`/`stop` grant no reclaim or replacement; broader unrelated changes require a new decision. |

## Decisions and consultation

Architect proposal accepted as D1-D8 below. Main reproduced the stranded state and
accepts rotation to the existing next candidate, not a new same-model retry mode.
Generated repository payload is in scope; rebuilding it does not install the plugin.
Use `task_failed` consistently. Stagnation's review-point evidence stays in bounded
evidence text; no additional scheduler or observation database is needed.

- D1: Add `outcome: task_failed`; keep `failed` provider decoding unchanged.
- D2: Require `taskFailure: {kind: stagnation|unusable_output, evidence: string}`.
  Reject unknown keys/kinds, empty evidence, non-string values and text over 2000 characters.
- D3: Require the recorded child identity, `executionState: stopped`, and existing
  bounded reconciliation evidence. Running/unknown state returns `reconcile`; no-child
  task failure is rejected. Check state before any candidate or direct-work grant.
- D4: If `error` is supplied with `task_failed`, provider restrictions win: decoded
  stop records the code and stops; unknown returns `reconcile`; next-eligible errors
  are rejected as mixed reports and must use `outcome: failed`. No error means task path.
- D5: Reuse the existing failed-attempt tail: next configured candidate is `ready`,
  then requires claim; after the last candidate return `main-direct`. No third attempt.
- D6: Persist nullable `Attempt.taskFailure`; preserve `code` for provider codes.
  Old version-1 records missing the field normalize to null. Invalid stored values
  fail closed. New records initialize null. Expose metadata through existing `attempts`.
- D7: Keep `DispatchResult` actions, role constraints, locks and native issuance unchanged.
  Optional reason text may explain task recovery; it is not the authority signal.
- D8: Document the same payload in SessionStart guidance, delegation, waiting and
  the public subagents guide. Update CHANGELOG and the structure index owner pointer.

Alternative rejected: adding a fake OCX code or treating arbitrary `failed.error`
prose as next-eligible. That weakens the provider boundary and confuses observation
with provider error. A new `task_failed` report is an explicit main judgment with
separate evidence. It is not inferred from model output or a wait count.

Architect proposal and reflection completed: ALIGNED for D1-D8, no material gaps.
Main accepts both implementation clarifications: decoded stop precedes the child-state
gate; ordinary `failed` reports retain their existing behavior even with stray task metadata.
Actual handles and raw consultation outputs stay in local task evidence.

## File and field chain

Paths below are repository-relative. The configured executor owns this implementation
bundle after A; main owns planning records, generated build output, measured README
test badges, verification records, source review and PR publication.

| File | Change |
|---|---|
| `plugins/codexclaw/components/subagent-config/src/fallback-dispatch.ts` | MODIFY input outcome validation, task payload parser, attempt metadata factory/read validation, report transition; share bounded handoff tail. |
| `plugins/codexclaw/components/subagent-config/src/fallback-dispatch-cli.ts` | MODIFY `DISPATCH_GUIDANCE` with concrete task report. CLI already passes parsed JSON to `runDispatch`; no new command or flags. |
| `plugins/codexclaw/components/subagent-config/test/fallback-dispatch.test.ts` | MODIFY existing real fixture tests for state transitions and negatives; no deleted assertions. |
| `plugins/codexclaw/components/subagent-config/test/fallback-dispatch-cli.test.ts` | MODIFY real separate-process round trip covering task failure and persisted metadata. |
| `plugins/codexclaw/skills/pabcd/references/delegation.md` | MODIFY report instructions and evidence/limit precedence. |
| `plugins/codexclaw/skills/loop/references/waiting.md` | MODIFY recovery route for confirmed task failures; keep wait classification evidence-based. |
| `docs-site/src/content/docs/guides/subagents.md` | MODIFY public protocol example and limits. |
| `CHANGELOG.md`, `structure/INDEX.md` | MODIFY change record and owner description to include runtime recovery. |
| `plugins/codexclaw/components/subagent-config/dist/fallback-dispatch{,-cli}.js` | REGENERATE from source with the standard build; never hand-edit. |
| `README.md`, `README.ko.md` | MODIFY test count only if new tests change measured inventory; use normal inventory tool. |

Creation is explicit CLI JSON → `runDispatch`/`report`; validation is the task parser
and stopped-child gate; serialization is `saveState`; deserialization is `readState`;
consumption is the existing `result().attempts` plus main guidance. `managedSpawn` and
`issueManagedSpawn` consume unchanged candidate/claim/state fields. The decoder remains
provider-only. No SDK, GUI input form or alternative report parser owns this field.

## Acceptance and verification

| Reachable trigger | Required observation |
|---|---|
| Created, stopped child; each task kind with valid evidence | First failure → ready; claim selects configured fallback; metadata round-trips with null provider code. |
| Same valid failure on last candidate, all roles | main-direct, exactly two attempts; reviewer still requires independent review. |
| State persisted without the new key | status works and later task failure recovers; malformed new metadata is rejected. |
| Running/unknown child state | reconcile, unchanged candidate count, no spawn/direct permission. |
| not_created, missing/wrong child, missing reconciliation | Rejected; no recovery grant or hidden state advancement. |
| Invalid kind/shape/unknown key, blank/oversized evidence | Rejected; existing state remains readable and unchanged. |
| Permission/policy/cancellation error plus task label | stop wins and persists; a later label cannot reopen it. |
| Unknown error plus task label | reconcile; no extra attempt. |
| Next-eligible provider error plus task label | Rejected as mixed; ordinary failed path retains old behavior. |
| Plain failed report with task metadata and no provider error | Existing unknown-error reconcile behavior, never implicit task recovery. |
| Before claim, stale ID, duplicate claim/issuance | Existing rejection/reconciliation and one-spawn invariant remain. |
| Already complete/stopped dispatch | No reopening by task report. |
| Separate CLI processes, valid task failures through both candidates | ready → claim → main-direct, metadata survives status/restart. |

Record a failing task-recovery assertion before source changes, then the same test
passing. Focused baseline command (exit 0, 23 tests) directly loads the two target suites:
`node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/subagent-config/test/fallback-dispatch.test.ts plugins/codexclaw/components/subagent-config/test/fallback-dispatch-cli.test.ts`.
After implementation run the complete subagent-config suite, `npm run build`,
`npm run gate`, full root tests for the measured badge count, inventory check and
`git diff --check`. Normal hosted CI covers OS and packed-payload compatibility.
Semantic review checks the caller docs against the live report contract. A fresh C
reviewer re-derives recovery reachability; merely preserving unknown-error rejection
does not prove task recovery works, which was the earlier review's blind spot.

Enforcement scope: CLI validation and persisted transitions execute in code for managed
callers; direct native calls bypass this protocol. Evidence truth and actual child
termination remain main observations. No universal lifecycle-enforcement claim is made.
Keep this repair in PR #179 because its new failure classification otherwise strands
managed callers; the larger aggregate diff includes the original planning/evidence records.
