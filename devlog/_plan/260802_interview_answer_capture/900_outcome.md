# 900 — Outcome

`DONE`, with two honest residuals. Four PABCD cycles, four independent audits.

## What was actually wrong

The interview never learned anything. Across every shipped ledger there were
**222 `question_asked` events and zero `answer_recorded`** — the host delivers
`request_user_input` `tool_response` in shapes `isRecord()` rejects, so
`parseAnswers` returned `{}` and the answer branch never ran. With no captured
answers `InterviewTracker.dimensions` stayed unwritten, `selectMinds` tied all
four dimensions at `low` and fell back to canonical order, and every question was
generated from a blank slate. That is the reported symptom, recorded verbatim in
the ledger: `이어서 어느 방향으로 진행할까요?`

## What shipped

| Cycle | Commit | Change |
|-------|--------|--------|
| wp1 | `50c0e8e3` | Roadmap unit (8 docs) |
| wp2 | `1c44982a`, `afb493ab` | `asRecord`/`firstRecord` decode 5 answer transports; `__proto__` sink closed |
| wp3 | `ba0fbe91`, `e53aa989`, `15db67a5` | `scan record --derive` reads the ledger into `known[]`/`unknown[]`; dist shipped; readiness bypass closed |
| wp4 | `da14bd42`, `27ddc6c4` | The I directive consumes the state; delivery asserted on hook stdout |

Tests 1418 -> 1449, zero failures throughout.

## What the audits caught that I got wrong

Worth recording, because each was a real error and none was cosmetic.

1. **My first diagnosis was wrong.** I blamed the dead `QUESTION_SHAPE_DIRECTIVE`.
   It duplicates text already injected, so wiring it changes nothing.
2. **My second diagnosis was wrong.** "Always 3 questions" is not the pattern —
   the histogram is `{1:22, 2:12, 3:18, 4:3, 5:3, 6:7, 7:2, 9:2, 21:1}`.
3. **I called a deduction a proof.** Seven transport shapes reproduce the 222/0
   signature, not one. The fix now decodes five and degrades on two.
4. **I shipped src without dist.** `dist/` is gitignored with runtime files
   force-added; a clean clone had neither `--derive` nor four of five transports.
   The feature was absent from anything installed.
5. **My own fix opened a gate.** `--dim <d>=max` forged `isInterviewReady` with no
   attestation and no ledger row. It now refuses `max`.
6. **My own fix broke another.** The level recompute covered all dimensions, so a
   routine `scan record` reverted `--dim` assertions.
7. **My tests proved the wrong thing.** They asserted the directive's contents,
   not its delivery — a reviewer severed the injection wiring and all 1446 tests
   stayed green. Delivery is now asserted on hook stdout, and I reproduced his
   mutation to confirm the new tests catch it.

## Residuals (carried, not hidden)

`A-WIRE-01` — nobody has watched a real answer land in a real ledger. Hooks load
at session start and goal mode denies `request_user_input`, so the live wire was
never observed on hook stdin. The repair covers five deduced shapes rather than
one confirmed one; it is a widening, so it cannot be wrong, only insufficient.
**Do not call this proven-effective until a production ledger shows an
`answer_recorded` row.**

`A-DIM-01` — question-to-dimension attribution rides an optional `--map` flag.
`jwc` makes attribution a property of asking (the tracker accumulates at answer
time with per-fact source and confidence); here it is a separate CLI step whose
omission now warns but still has to be performed. A `dimension` field on the
ledger event would make it structural. That is the natural next cycle.

The final reviewer's summary is the fairest description of where this landed:
*structurally the loop is closed for the first time — there is a path from answer
to next question with no missing link — but it relies on agent compliance at three
joints with no runtime enforcement. Closed the way a door with no latch is closed.*
