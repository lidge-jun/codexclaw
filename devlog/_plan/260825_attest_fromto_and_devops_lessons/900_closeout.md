# 900 — closeout

Four work-phases, ten commits, three independent audits. Terminal outcome:
**DONE**.

Baseline `74245989` (npm test 1961/0) → head `f0e6442c` (npm test 1987/0).
26 net new tests. No behavior was changed in any test to make it pass.

## What shipped

| wp | Commits | Delivered |
|----|---------|-----------|
| wp0 | `472beb3f` | Roadmap unit: 000 baseline, 001 inventory, 002 plan audit, 010/020/030 decade docs |
| wp1 | `49d90e64`, `c19e5781`, `db129710` | The attest contract, the runtime error shape, and the `--help` family |
| wp2 | `3d5d0d34`, `836954db`, `3ae38473` | 11 `DEVOPS-*` freeze-gate rules |
| wp3 | `6cf7b698`, `6268501b`, `f0e6442c` | Elimination-first `TEST-FLAKE-*` policy with one canonical owner |

## The defect that started it

`attest JSON missing valid from/to` had 50+ occurrences across four repos since
2026-08-13, and the gate was not at fault. `coerceAttest` rejects an attest
without `from`/`to` before any other check, while the table agents are
instructed to copy named neither those keys nor `planUnit`, `workPhaseId`, or
`testReceiptPath`. A goalplan-bound P>A therefore cost three round trips, each
one a turn, all caused by one incomplete table.

Both halves were needed. The docs stop producing the malformed attest; the error
message rescues the agent that produced one anyway from a stale copy or its own
memory. Fixing only the docs would have left the refusal teaching nothing for
another year.

## What the audits caught that self-review did not

This is the part worth keeping. Three lanes, three findings I would have shipped.

**wp0 — the plan asserted a falsehood about its own codebase.** 010 claimed the
parser cannot know which edge is being advanced, and proposed
`"<current>"/"<target>"` placeholders. The auditor read
`orchestrate-cli.ts:200` and disproved it in one line: `verb` is `argv[0]`,
resolved 27 lines before the attest loop, and `runOrchestrateCli:345-348`
already reads session state on that exact error path. The shipped message names
the real edge because an auditor checked a claim I had not.

**wp1 — I introduced the bug I was fixing.** Renaming `buildGoalIdleBlock`'s
`evidence` key to `did` corrupted the template literal's closing backtick into a
backslash, and no existing test covered that function's rendered text. It would
have shipped. Its regression test now asserts balanced backticks and no trailing
backslash — a structural property rather than the wording.

**wp2 — I fabricated evidence.** Three historical claims in the first
dev-devops draft were invented detail wrapped around real lessons: a 100-call
canary that "produced numbers" (it was rejected as the wrong instrument before it
ran), a green/fail/finding run sequence (the table is green/green/fail), and
"three files each in its own job" (three path patterns, seven files, two jobs).
The rules survived; my evidence for them did not. A rule whose cited evidence is
wrong is a rule the next reader is right to distrust.

**wp3 — the words were right and the classification let them be ignored.**
`QUARANTINE-01` was DEFAULT end to end, so its four-field receipt — the entire
accountability mechanism — was waivable. And `ATTRIBUTION-01` (DEFAULT) mirrored
`DEVOPS-BASELINE-DEFECT-01` (STRICT) on the same triple, letting an agent reach
the weaker class by choosing which skill to load.

## Verification

`npm test` 1987 pass / 0 fail / exit 0, receipt at
`.codexclaw/evidence/<session>/test-receipt.json`.

A green suite is not by itself evidence that the new tests work, so each class
was falsified deliberately:

| Test | Falsified by | Result |
|------|--------------|--------|
| The hint assertions | Neutering `renderAttestShapeHint` to return `""` | 5 of 13 failed |
| The doc-drift test | Deleting `planUnit` from the P>A table row | 1 failed: `P->A row must name "planUnit"` |

Both were re-run at wp4 against the final tree, not quoted from wp1. The hint
count grew from 3 to 5 because the Stop-command and arming-directive coverage
added later depends on the same function.

The drift test's FIRST version passed against injected drift, because it read the
whole table row and the Notes column happened to mention `planUnit`. It was
narrowed to the contract cell and re-verified. A test that has never failed is
not evidence.

## Deliberately not done

- **The interview-readiness dead end.** `isInterviewReady` requires all four
  dimensions at `max`; `scan record --dim x=max` is rejected and `deriveLevel`
  never emits `max`, so an honest I>P is unreachable through the shipped CLI
  while `interview/SKILL.md` says scan-record is the path. Every HITL interview
  either dead-ends or forges an override. This is a design decision about what
  readiness should accept, not a text fix, and it needs its own unit.
- **The chat surface discarding `attestError`.** `hook.ts` drops it and the human
  free-pass advances regardless. Fixing that makes the HUMAN path stricter, which
  nobody asked for.
- **docs-site attest examples.** A live copy-paste surface, incomplete, but its
  own build with its own review.
- **`cxc loop --help`'s `--slug`** on `steer`/`add-*`, which the runtime ignores.
- **The C10 contention itself.** The 30s ceiling is now honestly named as a hang
  detector, and the two real fixes — build/test serialization, or removing the
  real-process dependency — are recorded rather than done.

## Not pushed

Ten local commits. `LOOP-GIT-01`: committing is autonomous, pushing is an
external state change that needs explicit approval. The pre-existing dirty
worktree (`scripts/dev-symlink.sh`, two untracked `devlog/_plan` directories, a
stray `mktemp:` path) was preserved untouched throughout.

**One correction to that claim, and it happened twice.** `3ae38473` staged with
`git add devlog` and swept in the two untracked plan units —
`260722_repo-governance-config` and `260814_fix-main-ci-windows-worktree` —
which belong to the user's own in-progress work. Caught in the wp4 acceptance
sweep by noticing they had vanished from `git status`, and untracked in
`438ddd31`.

Then `260e2b49` did it again, because I reached for `git add devlog` a second
time. Untracked again in `d0c2ad0`. The files were never modified on disk in
either case; only their tracked status was.

Recorded twice rather than quietly repaired, because a mistake that recurs after
being fixed is a habit, not a slip. The fix is mechanical: stage explicit paths,
never a directory that also contains someone else's work. It is also why the
acceptance sweep re-reads `git status` instead of trusting that scope was
respected — the first occurrence was invisible until something compared the
worktree against its baseline.
