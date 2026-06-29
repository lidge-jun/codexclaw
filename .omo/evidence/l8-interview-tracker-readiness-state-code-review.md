# L8 Interview Tracker Readiness State - Code Review

Verdict: BLOCK
Recommendation: REQUEST_CHANGES
Reviewer mode: read-only adversarial review. No production or test fixes were made.

## Skill-Perspective Check

- `remove-ai-slops`: unavailable in the configured skill locations (`/Users/jun/.cli-jaw-3458/skills`, `/Users/jun/.codex/skills`); applied the prompt's remove-ai-slops criteria manually.
- `programming`: unavailable in the configured skill locations; applied the prompt's programming criteria manually.
- Violations found: yes. Tests miss adversarial T3/T2 cases and some tests mirror intended constants without covering write-side behavior.

## Evidence

- Frozen specs inspected:
  - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/080_L8_interview_state_schema.md`
  - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/081_L8.1_state_schema_fields.md`
  - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/082_L8.2_readiness_fsm_is_interview_ready.md`
  - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/083_L8.3_bound_ledger_t2_t3_t6.md`
- Implementation inspected:
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts`
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/state.ts`
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/fsm.ts`
- Tests inspected:
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/interview.test.ts`
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/state.test.ts`
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/fsm.test.ts`
- Runtime/dist check: `dist/interview.js`, `dist/state.js`, and `dist/fsm.js` mirror the source behavior for the reviewed L8 paths.
- `npm test` from repo root: 109 tests, 109 pass, 0 fail.

## Findings

### CRITICAL

1. Malformed/lossy tracker data can reconstruct into `isInterviewReady() === true`.

`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:126`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:133`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:153`

`reconstructInterview()` filters non-object contradiction and assumption entries before readiness runs. If all four dimensions are `max`, malformed persisted arrays such as `contradictions: ["bad"]` or `assumptions: ["legacy"]` become empty arrays, and `isInterviewReady()` returns true. This violates T3's fail-closed requirement: corrupted tracker data and dropped malformed entries must not silently produce a ready tracker.

Probe result:

```text
invalidContradictionNonObject {"ready":true,"contradictions":[],"assumptions":[]}
invalidAssumptionNonObject {"ready":true,"contradictions":[],"assumptions":[]}
invalidAssumptionNull {"ready":true,"contradictions":[],"assumptions":[]}
invalidContradictionNull {"ready":true,"contradictions":[],"assumptions":[]}
```

2. The readiness predicate itself accepts malformed trackers as ready.

`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:153`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:156`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:160`

`isInterviewReady()` only checks each dimension's `level`, plus the top-level contradiction and assumption arrays. A direct caller can pass dimensions with only `{ level: "max" }` and no `known`, `unknown`, or valid `confidence`, and the predicate returns true. The L8.2 spec says null, malformed, or incomplete trackers must return false.

Probe result:

```text
{ "ready": true }
```

### HIGH

1. `flags.interview` is not actually derived on persisted-state read or transition.

`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/state.ts:86`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/fsm.ts:18`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/fsm.ts:60`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/fsm.ts:93`

`deriveInterviewFlag()` exists, but the production code search found no non-test call site. `readState()` preserves a persisted `flags.interview:true`, and `canEnter("P")`/`transition()` trust that flag. A malformed tracker with a persisted true flag can enter P unless every caller remembers to derive first, which does not satisfy the spec statement that user transition requests cannot override a false predicate.

Probe result:

```text
{
  "rawFlag": true,
  "ready": false,
  "canEnterP": true,
  "derivedFlag": false,
  "derivedCanEnterP": false
}
```

2. T2 caps are reconstruct-only; `writeState()` can persist oversized in-state arrays.

`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/state.ts:108`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/state.ts:114`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:67`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:126`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:133`

The helper caps arrays when reconstructing, but `writeState()` serializes `next` directly. Any writer that appends interview data before calling `writeState()` can put arrays larger than `MAX_TRACKER_ARRAY` into hot session JSON. That violates T2's "cap in-state arrays" and the L8.3 acceptance criterion allowing cap during reconstruct or write normalization.

Probe result after one `writeState()`:

```text
{
  "knownLen": 57,
  "unknownLen": 58,
  "assumptionsLen": 59,
  "contradictionsLen": 60
}
```

### MEDIUM

1. T6 operation-id schema does not match the frozen hardening pins.

`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:39`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:52`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:107`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:142`

The frozen L8.3 hardening pin names `roundId: number` as monotonic per interview and calls out explicit tracker-adjacent ids (`contradictionId`, `planEditId`, `freezeId`). The implementation uses `roundId: string`, defaults it to `""`, normalizes non-string values to `""`, and uses generic `id` for contradictions. This weakens the replay/idempotency surface the spec says L8 must establish.

### LOW

1. Test coverage does not cover the acceptance-critical adversarial paths.

`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/interview.test.ts:48`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/interview.test.ts:82`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/state.test.ts:217`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/fsm.test.ts:95`

Current tests prove happy readiness, a few malformed scalar fields, reconstruct-side contradiction cap, and isolated `deriveInterviewFlag()`. They do not cover malformed contradiction/assumption entries producing readiness, direct malformed all-max trackers, persisted true flags with not-ready trackers, write-side cap enforcement, dimension known/unknown cap coverage, assumption cap coverage, or unknown-key dropping inside contradiction/assumption entries.

## Positive Checks

- Existing Phase-1 state fields are preserved by the strict read reconstruction literal.
- Unknown top-level state keys, unknown flag keys, unknown tracker keys, unknown dimension keys, and extra dimensions are dropped.
- Reconstruct caps dimension `known`/`unknown`, `assumptions`, and `contradictions` on read with drop-oldest behavior.
- `isInterviewReady()` does not trust a tracker-level `ready` field.
- `npm test` passes 109/109.

## Blockers

- Fix fail-closed reconstruction/predicate behavior so malformed or dropped contradiction/assumption entries cannot yield readiness.
- Ensure P-entry uses a freshly derived interview flag, or normalize/read/write state so persisted `flags.interview` cannot contradict `isInterviewReady(state.interview)`.
- Normalize interview arrays before persistence, not only during read reconstruction.

