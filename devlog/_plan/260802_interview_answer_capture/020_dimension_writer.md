# 020 — Phase 2: derive interview dimensions from captured answers

Work-phase `wp3`. **Structurally depends on wp2**: this phase's writer READS the
QA ledger that wp2 repairs. That dependency is the point — see "The reader" below.

## Audit correction (C-6)

An earlier draft made this phase a pure CLI writer taking every value from flags
typed by the agent. The A-phase reviewer caught the fatal consequence: wp2 repairs
the write path, wp3 builds a second write path, and **nothing ever reads either
one**. `readQaEvents` would still have no production consumer after all three
phases, so questions would remain ungrounded — the user's actual complaint
untouched. Phase ordering would also be narrative rather than structural, which
PHASE-SPLIT-01 forbids.

This phase is therefore reader-first: the CLI flags are the manual override, and
ledger derivation is the default path.

## Why this is the second half of the fix

Phase 1 makes answers durable. Phase 2 makes them *consequential*. Without a
writer, `dimensions` stays at `"low"` forever, `selectMinds` keeps tying, and
"target the weakest dimension" stays unsatisfiable (evidence E3, E4).

## Design decision: extend `cxc scan`, do not add `cxc interview`

`scan-cli.ts` already reads state, mutates the `InterviewTracker`, and calls
`writeState` — it is the established writer for this exact object. Adding a
parallel `cxc interview` subcommand would introduce a second surface with no
stated requirement, and `bin/codexclaw.mjs` would need a new dispatch case.
Prefer the smaller change.

## Scope boundary

IN: `components/pabcd-state/src/scan-cli.ts` (arg parsing + tracker mutation),
`components/pabcd-state/test/scan-cli.test.ts`.

OUT: the `InterviewTracker` SHAPE (frozen L8 — fill existing fields only), the
readiness predicate, `minds.ts` (its scorer is already correct).

## The reader (the load-bearing part)

Add a derivation step that consumes `readQaEvents(cwd, sessionId)` — the function
wp2 makes useful — and folds it into the tracker:

- Every `answer_recorded` event whose `questionId` is not yet represented becomes
  a `known[]` entry on the dimension the question targeted.
- Every `question_asked` with no matching `answer_recorded` becomes an `unknown[]`
  entry (an asked-but-unresolved gap).
- `level` is derived from coverage: a dimension with no knowns stays `low`; with
  knowns and no outstanding unknowns it may reach `high`; `max` requires an
  explicit operator assertion, since the predicate gates I→P.

Dimension attribution needs a carrier. The ledger has no dimension field today,
so adopt the convention already visible in production question ids
(`item3_criterion_shape`, `d4_scope`, `fix_altitude`): accept an OPTIONAL
`--map <questionId>=<dimension>` on the recording command, and default to
`unknown-dimension` (folded into no dimension) when unmapped. Do NOT invent a
ledger schema change in this phase; the frozen shape stays frozen.

## Surface

Extend the existing `scan record` verb so one command records the scan, derives
from the ledger, and accepts manual overrides:

```
cxc scan record --session <id> [--contradictions N] [--high N] \
  [--derive] \
  [--map <questionId>=<goal|constraint|success|ontology>] \
  [--dim <dimension>=<low|mid|high|max>] \
  [--known <dimension>=<fact>] [--unknown <dimension>=<gap>] \
  [--confidence <dimension>=<0..1>]
```

All new flags are repeatable and OPTIONAL. Omitting them all preserves today's
behavior byte-for-byte, so every existing caller and test is unaffected.

Separator note (audit C-4): every flag uses `=` and splits on the FIRST `=`, so a
fact containing `=` or `:` (`"uses http://x"`) survives intact. The earlier
`--known <dim>:<fact>` colon form is rejected.

`parseScanCliArgs` (`scan-cli.ts:44-64`) returns `{error}` on ANY unknown
argument, so each new flag MUST be added there or every new invocation hard-fails.

## Tracker mutation

`runScanCli` currently produces:

```ts
const nextTracker: InterviewTracker = { ...tracker, scanRounds: roundId, lastScanRoundId: roundId };
```

It becomes: same spread, plus a `dimensions` merge from (a) ledger derivation when
`--derive` is set, then (b) explicit flags, which win on conflict. Each merged
score appends to the existing `known`/`unknown` arrays.

Do NOT re-apply the array cap manually. `writeState` (`state.ts:228`) already runs
`normalizeInterview`, which rebuilds every dimension through `strArray`
(`interview.ts:126`, `.slice(-MAX_TRACKER_ARRAY)`). The cap is enforced on the
write path automatically (audit C-4).

Validation is fail-closed and consistent with `interview.ts`: an unknown
dimension name, an invalid level, or a confidence outside `[0,1]` is a CLI error
(non-zero exit with a message), never a silent degrade — the CLI is an explicit
writer, so a typo should be loud even though the *reconstruct* path stays
tolerant.

## Tests

`test/scan-cli.test.ts` — add:

1. `--dim goal=high` promotes only `goal`; the other three stay `low`.
2. `--known goal="user wants X"` appends without clobbering existing entries.
3. A fact containing `=` and `:` round-trips intact (first-`=` split).
4. Repeated flags across two invocations accumulate rather than reset.
5. Invalid level / unknown dimension / out-of-range confidence each exit non-zero.
6. Regression: `scan record` with no new flags produces exactly today's tracker
   (guards the both-counters contract at :98 and :115).
7. Round-trip: written state survives `reconstructInterview` unchanged.
8. **Reader test (the C-6 criterion):** seed a ledger with `question_asked` +
   `answer_recorded` rows, run `--derive --map q1=goal`, and assert the answer
   text lands in `dimensions.goal.known[]` and an unanswered question lands in
   `unknown[]`. This is the proof that captured answers reach the tracker.

## Verification

```
npm test
npm run build
cxc scan record --session <id> --contradictions 0 --high 0 --dim goal=high
# then read .codexclaw/sessions/<id>.json and confirm goal.level === "high"
```

## Accept criteria

- `c4`: a session JSON shows at least one dimension off `"low"`, and the writer
  tests pass.
- `c6`: `readQaEvents` has a production consumer — a captured answer is
  observably present in `dimensions.*.known[]` after `--derive`.

## Risk

Low-to-moderate. The tracker shape is unchanged, so `freeze` manifests and
`reconstructInterview` are unaffected (see `002_refuted.md` R7 — `planHash` does
not hash the evidence bundle). The main hazard is perturbing the existing
`scan record` contract, which test 5 exists to prevent.

## Note on readiness

Promoting all four dimensions to `max` still will NOT make `isInterviewReady`
return true while any contradiction is open (R4). That paradox is deliberately
out of scope; the override paths already handle it. Do not "fix" readiness as a
side effect of this phase.
