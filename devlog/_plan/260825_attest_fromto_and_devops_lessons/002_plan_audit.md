# 002 — plan audit, and what it changed

Auditor: independent read-only `xai/grok-4.6` lane, dispatched at the A gate with
the five planning docs and instructions to verify every citation against the tree
rather than trust the plan. Verdict: **GO-WITH-FIXES**, four blockers, nine nits.

The audit was worth its cost immediately: **blocker 1 disproved a technical claim
the plan had asserted as fact.** Recording that first, because it is the finding
that changes the implementation rather than the prose.

## BLOCKER 1 (accepted, plan was wrong) — parse CAN name the edge

010 claimed the parse function "does not know the requested phase edge", and
proposed placeholders `{"from":"<current phase>","to":"<target phase>"}`.

That is false, and it was checkable in one read:

```
orchestrate-cli.ts:200   const verb = VERBS[verbTok];      // argv[0] -> this IS `to`
orchestrate-cli.ts:227   if (!coerced) attestError = "attest JSON missing valid from/to";
```

`verb` is resolved 27 lines BEFORE the attest loop runs. And the consumer side
already reads state on exactly this path:

```
orchestrate-cli.ts:345-348
  if (args.attestError && verb !== "status" && verb !== "reset") {
    const sessionIdForError = args.session && sessionFileExists(...) ? args.session : null;
    const context = sessionIdForError ? renderPhaseContext(readState(...), ...) : "";
```

So `from` is available whenever `--session` names a real session file — which is
mandatory for every mutating verb anyway.

**Amendment to 010 §5.** The message is built in `runOrchestrateCli`, not left as
a static string in the parser, and it is CONCRETE:

- `to` is always the verb.
- `from` is the current phase when the session resolves; only then does a
  placeholder appear.
- The forward-declared extra keys are the ones for THAT verb, not a menu of all
  of them: `A` adds `planUnit`; `B` adds `auditOutput` + `auditVerdict`; `D`
  adds `checkOutput` + `exitCode`; a bound goalplan adds `workPhaseId`, and a
  bound `D` also adds `testReceiptPath`.

A generic menu would be the same mistake in a longer form: the agent still has to
guess which half applies.

## BLOCKER 2 (accepted) — the tests as written could not fail

010 tests 1–3 asserted the message "contains `from` and `to`". The CURRENT
message is `attest JSON missing valid from/to`. It contains both. The tests would
have passed against the bug they exist to prevent.

**Amendment to 010 TESTS.** Each assertion must pin a substring that does not
exist in the tree today. Minimum set per test:

- the literal example fragment `"did":"` (today's message has no example)
- the recovery command `cxc orchestrate status`
- the verb-specific extra key (`planUnit` for `A`, `checkOutput` for `D`)

And the `--attest-file` test asserts its own wording, since `:257` emits
`attest file <path> is missing valid from/to` — a DIFFERENT string from `:227`,
which 010 had conflated (nit 2). Two paths, two assertions.

## BLOCKER 3 (accepted) — the scope contradicted itself

000 put `cxc freeze --help` OUT; 010 §7 put it IN. Both cannot be true.

**Resolution: IN, and 000 is amended.** Reasons, in order: it is a MUTATION
triggered by a read-only-looking flag, it exits 0 so nothing signals it, and the
fix is a guard before IO in the same file family wp1 already opens. Leaving a
known workspace-mutating `--help` in place for a later unit, having just written
a document that names it, is the kind of deferral that never comes back.

The rest of §7 (`review-round`, `plan`, `metric`, `divergence` help, and the
missing top-level verbs) stays IN for the same reason the auditor questioned it:
it is not the attest cascade, but it IS the same defect family — a surface that
refuses an agent following the docs — and it shares `help-verbs.test.ts`. That
file is already the home of the half-finished #47 fix. Finishing it there is
cheaper than a second unit that reopens the same test.

## BLOCKER 4 (accepted) — CLI help is not the gold source

010 §1 said the skill examples should "match `orchestrate-cli.ts:166-168`, which
is already correct". The auditor checked. It is not: there is no B→C example at
all, and the C→D example omits `testReceiptPath`.

**Amendment to 010.** CLI help is a REPAIR TARGET in wp1, not the reference. Add
the missing B→C object and `testReceiptPath` to the C→D object, then the skill
table and help agree because both were fixed — not because one copied the other.

This one matters beyond the typo: the plan was about to propagate an incomplete
example into the skill and call the result consistent.

## Nits, dispositions

| # | Finding | Disposition |
|---|---|---|
| 1 | `check-gate.ts:34` is the wrapper; the string is at `:37` | **Corrected** in 000 §"The defect" (001 never carried the wrong line) |
| 2 | `:227` and `:257` are different strings | **Folded into blocker 2** |
| 3 | "Exact wording is settled in B" — there is no B | **Corrected**: wording is settled HERE, above |
| 4 | docs-site quickstart neither IN nor OUT | **OUT, explicitly.** It is a live copy-paste surface and should be fixed, but it is a docs-site build with its own review; recorded as a follow-up rather than smuggled in |
| 5 | Freeze-train rules belong in a new §2.8, not §2.7 | **Accepted.** §2.7 is a 3-line published-artifact contract; the GO-report rules are a different shelf |
| 6 | Draft the `skill-ownership.md` row; name `N` for FLAKE-STABILITY | **Accepted.** Row drafted in 030; `N` is "declared in the GO report, minimum 3" — opencodex's own number, not invented |
| 7 | Test 6 must bind to the attest table rows, not a repo-wide `rg` | **Accepted.** A 37k-character file will contain any key name somewhere |
| 8 | Accept-criteria paths need the `plugins/codexclaw/` prefix | **Accepted** |
| 9 | `scan-cli.ts:146` teaches `{"override":true,...}` without from/to | **IN.** Same cascade, one line, and it is a runtime error handing the agent a command |

## Citation corrections to 001

The auditor found four sloppy citations. All are in §G (the suite-health section)
or §B, none load-bearing for the diagnosis, and all are corrected here rather
than left to rot:

- `orchestrate-cli.ts:257` emits `attest file <path> is missing valid from/to`,
  not the `:227` wording.
- The `testReceiptPath` refusal is `check-gate.ts:37`, not `:34`.
- `session-split.test.ts:70` uses `Date.now()` to mint a directory name, not as
  an mtime dependency. It is NOT timing-sensitive; remove it from the watch list.
- The concurrent-spawn flake comment is near `orchestrate-cli.ts:486` in the test
  file, not within `:498-525`.

## What the audit did NOT change

- The core diagnosis. Every load-bearing citation in §A and §B was verified
  correct: the table at `pabcd/SKILL.md:91-98`, the `:227` wording, the
  `evidence`-instead-of-`did` bug at `hook.ts:1163`, the invalid-JSON doctrine
  line, the `:218` vs `:77` flaky contradiction, and the `ci-pipeline.md:96-102`
  duplication.
- The dist/build note: `plugins/codexclaw/test/dist-freshness.test.mjs` exists,
  compares compiled src against tracked dist, and pabcd-state's `dist/*.js` IS
  tracked despite the root `.gitignore` entry. `npm run build` stays in wp1.
- The 11 DEVOPS-* rules: no overlap with the three existing ids.
- The four TEST-FLAKE-* rules: no contradiction with `TEST-ANTI-FLAKE-01` or
  `TEST-CI-GREEN-01`, provided quarantine stays an exception-with-cost.

## One weakening the audit forced on the premise

001 §A implied agents have nowhere to learn the attest shape. For `from`/`to`
specifically that overstates it: CLI help, the Stop-hook examples,
`interview/SKILL.md:180-181`, `scan-cli.ts`, and the docs-site quickstart all
show them. The honest claim is narrower and still sufficient: **the skill the
agent is instructed to load is wrong, and it is the surface most likely to be
copied.** For `planUnit`, `workPhaseId` and `testReceiptPath` the original claim
stands unweakened — zero skill mentions, anywhere.

## Verdict recorded

```
VERDICT: GO-WITH-FIXES
```

Four blockers, all folded into the plan above rather than rebutted. Nine nits,
seven accepted, one scoped OUT with a reason (nit 4), one folded (nit 2).
