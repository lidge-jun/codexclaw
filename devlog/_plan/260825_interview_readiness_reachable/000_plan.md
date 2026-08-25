# 000 — the readiness gate nobody can pass

`isInterviewReady` demands a level that no production writer can produce. Every
HITL interview therefore ends the same way: dead-end, or an attested override.

## The defect

`interview.ts`:

```ts
export const DIMENSION_LEVELS = ["low", "mid", "high", "max"] as const;

export function isInterviewReady(tracker) {
  for (const d of DIMENSIONS) {
    if (!isValidScore(score) || score.level !== "max") return false;   // :260
  }
  ...
  return roundIdNum(tracker.scanRounds) >= 1;                          // :268
}
```

`scan-cli.ts` is the only production writer of `dimensions[d].level`, and it
cannot write `max` by either route:

```ts
function deriveLevel(score) {                                          // :273
  if (score.known.length === 0 && score.unknown.length === 0) return "low";
  if (score.unknown.length > 0) return "mid";
  return "high";                          // <- the ceiling of --derive
}
```

```ts
if (pair.value === "max") {                                            // :143
  return { error: "scan record: --dim cannot set 'max'. ..." };
}
```

So the gate's condition is unreachable through the shipped CLI. The override at
`orchestrate-cli.ts` is the only exit, and it was designed for the opposite
case:

> the sanctioned way past an **unready** interview

When the hatch is the only path, its ledger row stops distinguishing anything.
"Bypassed the readiness gate" is written for the thorough interview and the
skipped one alike, which is the same as not recording it.

## Two honest options, and the one being rejected

**(b) An attested `max`-assertion path.** Add a command that writes `max` and a
ledger row proving a human asserted it.

Rejected. It rebuilds the override with extra steps: the agent still asserts
readiness rather than demonstrating it, and we would then own two attested
bypass surfaces instead of one. The existing override already covers "I judge
this ready without the evidence" and covers it honestly.

**(a) Make readiness reachable from evidence the scan already derives.** CHOSEN,
but not in the naive form.

`deriveLevel` computes:

| level | meaning |
|---|---|
| `low` | nothing known about this dimension |
| `mid` | facts recorded, **open gaps remain** |
| `high` | facts recorded, **no open gap** |

### The naive version of this fix is worse than the bug

The first draft of this plan said "accept `high`". Before writing it down I ran
the writer to see what `high` costs:

```
cxc scan record --session s1 --known goal=x --known constraint=x \
                --known success=x --known ontology=x
-> levels: {"goal":"high","constraint":"high","success":"high","ontology":"high"}
   scanRounds: 1
```

Four `--known` flags with the literal value `x`. One command. `--known` is free
text an agent types, and `deriveLevel` only asks whether `unknown` is empty — a
dimension that was never questioned has no gaps to be missing.

So "accept high" trades a gate nobody can pass for a gate nobody can fail. That
is the trade the scan-cli comment warns about, arriving through a different
door: `--known` is a writer flag with no attestation and no trail, exactly like
the `--dim=max` it forbids.

### What actually distinguishes a real interview

`--derive` does not read agent input. It reads the Q&A ledger
(`.codexclaw/interviews/<session>.jsonl`), which is written by
`captureInterviewAnswers` from real `request_user_input` traffic — questions the
user was actually asked and answers the user actually gave. `deriveFromLedger`
then refuses to guess: an unmapped question is skipped entirely, an unanswered
question becomes an open gap that pins the dimension at `mid`.

That is the property worth gating on. Not the level, which is a number an agent
can write — **the provenance of the level**.

### The rule

A dimension satisfies readiness when it is:

- at `max` — an operator's explicit assertion, unchanged; or
- at `high` **and derived from the answer ledger** — at least one of its
  `known` entries traces to a recorded `answer_recorded` event.

`max` is not deleted and `--known` is not removed. `--known` still records
facts and still moves a dimension off `low`; it just cannot, by itself, carry a
dimension across the readiness line.

## The change

### A tracker field cannot carry this, and measuring says so

The obvious move is a `derived?: boolean` on `DimensionScore`. I probed it
before writing it down:

```
writeState(... dimensions.goal = {level:"high", ..., derived:true})
on disk:          {"level":"high","known":["k"],"unknown":[],"confidence":1}
after readState:  {"level":"high","known":["k"],"unknown":[],"confidence":1}
```

`reconstructScore` (`interview.ts:154`) rebuilds a score from a whitelist of
four fields. An unknown key does not survive the write, let alone the read. So
the field would require widening the fail-closed reconstruct — and the moment
`derived` is reconstructable, a hand-edited session JSON can assert it. That is
the `--dim=max` objection again: a flag with no attestation and no trail, this
time spelled as a field.

### The ledger is the evidence, so ask the ledger

`isInterviewReady(tracker)` stays pure and unchanged in signature — every
existing caller keeps working. Readiness gains a second, IO-bearing form used by
the gate:

```ts
// interview.ts — pure, unchanged contract, now the SHAPE half.
export function isInterviewReady(tracker): boolean

// scan-cli.ts or a small sibling — the EVIDENCE half.
export function dimensionsBackedByAnswers(cwd, sessionId, map): Set<Dimension>
```

`evaluateInterviewGate` — already the single place that decides I->P — becomes
the composition:

- **shape**: all four dimensions at `max`, or at `high`, plus the untouched
  conditions (contradictions empty, assumptions recorded, `scanRounds >= 1`); AND
- **evidence**: every dimension the shape counted as `high` appears in
  `dimensionsBackedByAnswers`, computed by re-reading
  `.codexclaw/interviews/<session>.jsonl`.

The attribution map is the missing link: `deriveFromLedger` takes it as a
`--map` argument and then throws it away, so a later reader cannot tell which
dimension a `questionId` belonged to. Persisting it in the tracker would make it
hand-editable, which is the objection this design exists to avoid.

It goes in the ledger instead. `scan-cli` already appends a `scan_completed`
event per round; `InterviewEvent` gains an optional `map?: Record<string,
Dimension>` carrying the attributions that round used. The file is append-only
and is the same file the answers live in, so the evidence and its interpretation
share one provenance.

`dimensionsBackedByAnswers` then reads both event kinds from that one file and
returns the dimensions holding a mapped `question_asked` + `answer_recorded`
pair. Nothing is persisted in the tracker, so no state edit can forge it.

**What this is not.** It is not tamper-proof: the ledger is a file on disk, and
anyone who can write the session state can write the ledger. It removes the
*accidental* path — the one an agent takes because it is easier than asking —
and leaves forgery as a deliberate act. For a soft-gate whose honest bypass is
one attested command away, that is the right bar; a cryptographic one would cost
more than the gate is worth.

`max` keeps its meaning: an operator assertion that needs no ledger backing,
because it is the level `--dim` cannot write and only a deliberate hand-edit or
a future attested writer can produce.

### Why not `scanRounds >= N` for N>1

Rescan rounds measure how much contradiction-hunting was needed, not how
complete the result is. A first-round interview with no gaps and no
contradictions is complete. Forcing a second round would add a step without adding evidence.

### What this does not fix

An agent can still write the ledger by calling `request_user_input` and
answering itself — but it cannot, because `request_user_input` is hard-denied
while a goal is active, and in HITL the answers come from the human. The gate
now costs a real question and a real answer per dimension. That is not
unforgeable; it is expensive enough to stop being the path of least resistance,
which is the honest bar for a soft-gate whose escape hatch is one attested
command away.

## MODIFY map

| File | Change |
|---|---|
| `src/interview.ts` | `isInterviewReady` accepts `high` or `max` (SHAPE only); its doc comment currently states the `max` rule as fact. `evaluateInterviewGate` gains `cwd`/`sessionId` and composes shape with evidence, so the gate — not the pure predicate — owns the provenance requirement |
| `src/interview-ledger.ts` | export `dimensionsBackedByAnswers(cwd, sessionId)`: reads the session's Q&A events AND the `scan_completed` maps from the same file, returns the dimensions holding a mapped question_asked + answer_recorded pair |
| `src/state.ts` | `InterviewEvent.map?: Record<string, Dimension>`, threaded through `appendInterviewEvent`/`readInterviewEvents` the way `ontologySchema` is threaded through the tracker |
| `src/scan-cli.ts` | include `--map` in the `scan_completed` event it already appends; the `--dim=max` rejection names `--derive` as the honest path instead of implying override is the only route; the stale `deriveLevel` comment at `:268` |
| `skills/interview/SKILL.md` | the readiness description currently says `max` gates I->P and points at override; it must describe the path that works |
| `test/interview.test.ts` | the existing "true only for all-max" test encodes the defect as a contract |
| `test/scan-cli.test.ts` | new end-to-end: capture answers -> `scan record --derive` -> `isInterviewReady` true, with NO override |

Added after the A-round audit, which found the map incomplete:

| File | Change |
|---|---|
| `src/scan-cli.ts:268` | `deriveLevel`'s comment claims `--dim <d>=max` is the operator assertion. The parser at `:143` rejects that exact flag. The comment has been wrong since the rejection landed |
| `test/interview.test.ts:30` | `"true only for all-max"` asserts `high` is NOT ready — the defect encoded as a contract |
| `test/scan-cli.test.ts:264,337` | both assert the `--dim=max` error names `override.*true`; that message is changing |
| `test/scan-cli.test.ts:426` | already proves `--known goal=...` alone reaches `high`. It stays true and stays green — it is now the SETUP for the new "trivial path is not ready" assertion |
| `test/orchestrate-apply.test.ts:115`, `test/orchestrate-cli.test.ts:619` | the existing override tests. Test 5 asserts behavior these already cover, so it extends them rather than duplicating |

Fixtures at `orchestrate-cli.test.ts:20`, `orchestrate-apply.test.ts:80`,
`fsm.test.ts:124` and `freeze.test.ts:86` hand-build `level:"max"`. They keep
passing untouched — `max` still satisfies readiness — but they do NOT prove a
derived `high` opens I->P. That is what the new end-to-end is for.

Runtime callers (`fsm.ts:99`, `state.ts:289`, `freeze-cli.ts:88`,
`evaluateInterviewGate` via `orchestrate-cli.ts:512` and
`orchestrate-apply.ts:128`) read the predicate and never hard-code the level, so
no signature changes. `evaluateInterviewGate`'s warning text stays accurate: an
undermapped dimension is still "incomplete".

## TESTS

1. **The end-to-end that proves the fix** — capture real answers through
   `captureInterviewAnswers`, run `runScanCli` with `--derive` and `--map`, then
   assert `isInterviewReady` is true. This must drive the WRITER, not hand-build
   a tracker; a hand-built tracker would prove only that the predicate changed.
2. **A dimension with an open gap still blocks.** `mid` is not enough.
3. **The trivial path still blocks.** Four `--known` flags produce all-`high`
   and readiness stays FALSE, because none of them is `derived`. This is the
   test that makes the fix meaningful rather than cosmetic — it is the exact
   command measured above.
4. **A `--known` fact on a derived dimension does not un-derive it, and does not
   by itself derive a different one.** Mixing the two writers is the realistic
   case, and the flag must be additive without being promotive.
5. **`max` still satisfies readiness** — demoted from sole path, not removed.
6. **The unchanged conditions still block** at all-derived-`high`: one
   contradiction, one unrecorded assumption, `scanRounds === 0`.
7. **The override still works and still ledgers.** Extends the existing tests at
   `orchestrate-apply.test.ts:115` / `orchestrate-cli.test.ts:619` rather than
   duplicating them.

## What the A-round audit changed

The auditor returned **FAIL** on the first draft, and it was right to. That
draft said "accept `high`" full stop. Two of its three blockers are the trivial
`--known` path, which I had independently measured and amended before the
verdict arrived — the amendment above is the auditor's own recommended fix (ii),
reached separately. The third blocker was mine to fix: the MODIFY map omitted
every test and comment that encodes the old rule, which is how a "small" change
turns into a red suite and a surprised author.

One correction the audit forced on my reasoning, not just the plan: I wrote that
"data shape alone never proves a scan ran". For this writer that is false —
`runScanCli` increments `scanRounds` unconditionally, so the counter proves a
command ran, not that an interview happened. `derived` is what carries the
provenance; `scanRounds` only orders the rounds.
## Accept criteria

| # | Criterion | Proof |
|---|---|---|
| 1 | A complete interview reaches ready without override | test 1, driving the real writer |
| 2 | **The trivial path does NOT reach ready** — four `--known` flags leave it false | test 3; this is the criterion that makes the fix real rather than cosmetic |
| 3 | Incomplete interviews still blocked | tests 2 and 6 |
| 4 | Mixing `--known` with `--derive` neither un-derives nor falsely derives | test 4 |
| 5 | `max` still satisfies readiness; the override survives and still ledgers | tests 5 and 7 |
| 6 | The skill describes the working path | diff + `rg` for stale `max` guidance |
| 7 | `npm test` green | receipt; baseline 1987/0 |

## Scope boundary

IN: every file in the MODIFY map above, plus this unit.
OUT: the interview flow itself, question generation, the auto-resolve loop,
`evaluateInterviewGate`'s warning text beyond what this change makes false.
