# 030 — wp3: one flaky policy, elimination-first, one owner

Phase: wp3. Depends on: wp0. Independent of wp1/wp2 (disjoint files), except that
wp2's `DEVOPS-FLAKE-STABILITY-01` points here.

## Problem

The repo already believes the right thing in seven places and the wrong thing in
three. 001 §E has the full inventory; the summary is that
`dev-testing/SKILL.md:218` says

> Protocol: detect → quarantine if blocking → assign owner → reinstate after
> repeated green runs.

while `dev-testing/SKILL.md:77` says a flake is a bug and green-on-retry is not
acceptable, and `:220-224` says never blind-retry a failed job. An agent cannot
follow both. `ci-pipeline.md:96-102` then repeats the quarantine protocol as its
own §5 heading — "Flaky Test Quarantine Strategy" — so the deep reference and the
router both claim to own it, with different strength.

Meanwhile `dev-debugging:78` lists "add retry/skip annotation" as the WRONG
patch, and `dev-testing:491` treats `.skip()` on a failing test as an escalation
red flag. A quarantine tag is a skip with a nicer name. Six contradictions, C1–C6
in 001 §E.

## The policy

Elimination is the only resolution. Quarantine is an exception that must cost
something to take, and blind re-run is banned outright.

Proposed rule ids, in the existing `TEST-*` family:

**`TEST-FLAKE-ELIMINATE-01` (STRICT)** — A flaky test is a defect in the test or
the code under test. Diagnose the nondeterminism and remove it: replace timing
assumptions with deterministic waits or a fake clock, reset shared state in
fixtures, remove live network dependencies, pin fonts/time/locale for snapshots.
A flake is closed when the cause is named, not when the suite is green.

**`TEST-FLAKE-RERUN-01` (STRICT)** — Re-running a failed job or test to obtain
green is not a resolution and is never recorded as one. A re-run is permitted
only as a diagnostic to measure failure RATE, and the measurement is written down.
Raising a timeout to make a test pass is the same violation wearing a config
change. (Merges the intent already present at `dev-testing:77,220-224,380` and
`dev-debugging:74,78`.)

**`TEST-FLAKE-QUARANTINE-01` (DEFAULT, exception path)** — Quarantine is allowed
only when the flake blocks unrelated delivery AND all four are recorded in the
same change: the exact test name, the named owner, a removal deadline, and the
suspected cause. A quarantine without a deadline is a deletion. Quarantine never
closes the defect; it defers it, and the deadline is the receipt.

**`TEST-FLAKE-ATTRIBUTION-01` (DEFAULT)** — Before calling a failure
environmental, prove it: identical failure on the untouched baseline, no change
touching that code, and the matching CI job green at the same SHA. This is the
test-side mirror of `DEVOPS-BASELINE-DEFECT-01` and exists because "it's flaky"
is the most common way a real defect gets waved through.

That last rule is the one this repo did not have. Every existing line says do not
HIDE a flake; none says how to PROVE something is not your defect. Without it,
"environmental" is an assertion.

## Ownership

Follow the `DEV-STACK-*` precedent exactly, since
`skills/dev/references/skill-ownership.md:3` already states the doctrine: "Each
rule area has exactly one canonical owner. Other skills may contain stubs but
MUST NOT duplicate canonical content."

| File | Role after this phase |
|---|---|
| `dev-testing/references/ci-pipeline.md` §5 | **CANONICAL.** Rewritten as "Flaky Test Policy (canonical — `TEST-FLAKE-*`)". Full rules, the first-fix table, and the quarantine exception form. |
| `dev-testing/SKILL.md` §5.4 | Pointer stub: rule ids + one line each + path. Delete the quarantine protocol sentence at :218 and stop duplicating the first-fix table. |
| `dev-testing/SKILL.md` §1.5 (:77) | `TEST-ANTI-FLAKE-01` stays as the one-line STRICT rule, with a pointer. It is already correct; do not restate the protocol beneath it. |
| `dev-debugging/SKILL.md` Scenario D + row :78 | Keep the RCA method (shared mutable state, isolation, hunt siblings). Add "policy: `dev-testing` `references/ci-pipeline.md` §5". No quarantine or retry rules here. |
| `dev-devops/SKILL.md` §6 | Already a pointer to `dev-testing` §5. Leave it. `DEVOPS-FLAKE-STABILITY-01` (wp2) cites the canonical file rather than restating. |
| `dev/references/skill-ownership.md` | **Add the missing row.** Its absence is why the policy drifted into two files. |
| `structure/30_contradiction_register.md:85` | C10 lists "candidate for an explicit timeout" for a flake. Update the disposition to name the new rule; do not silently delete a register entry. |

Choosing `ci-pipeline.md` over a new `flaky-tests.md`: the router already points
at it for the full §5 template (`dev-testing/SKILL.md:204-205`), which is the
same shape as `dev` §5 → `stacked-prs.md`. A new sibling file would also be
defensible; rewriting the section that already holds the only multi-step protocol
is the smaller ownership move and leaves no orphan heading.

## What this policy must NOT become

A rule that makes an honest agent lie. If a flake genuinely blocks delivery and
cannot be root-caused in the current cycle, the exception path must exist and be
usable — otherwise the pressure that produced "quarantine if blocking" simply
reappears as an undocumented skip. The four required fields are the cost;
forbidding the exception entirely would be theater.

This is also why `TEST-FLAKE-ATTRIBUTION-01` is DEFAULT and not STRICT: proving
the negative sometimes requires CI access an agent does not have. It must be a
recorded gap, not a blocked turn.

## Note on this repo's own suite

There is no flaky test here to eliminate. `npm test` is 1961/1961 green and the
pabcd-state slice ran twice with identical results (001 §G). The policy is
written for the repos this skill governs, and the contention-sensitive tests
listed in 001 §G are the local watch list, not a defect list. Do not "fix" a
green test to demonstrate the policy.

## Accept criteria

| # | Criterion | Proof |
|---|---|---|
| 1 | `ci-pipeline.md` §5 is the single canonical policy, carrying all four `TEST-FLAKE-*` rules | file diff |
| 2 | `dev-testing/SKILL.md:218` no longer prescribes quarantine as the protocol | `rg -n -e quarantine skills/dev-testing/SKILL.md` |
| 3 | No surviving text in dev-testing, dev-debugging, or dev-devops recommends re-run or timeout-raise as a resolution | `rg -i` across the three, read in context |
| 4 | `skill-ownership.md` has the flaky row in DEV-STACK format | diff |
| 5 | C1–C6 from 001 §E are each individually resolved | one line per contradiction in the closeout |
| 6 | `structure/30_contradiction_register.md:85` disposition updated, not deleted | diff |

## Scope boundary

IN: the seven files above.
OUT: editing any test file; changing `--test-concurrency=1`; touching
`dev-data`'s ETL quarantine (a different meaning of the word); `qa`/`loop`/
`pabcd` retry language, which is repair-loop discipline, not CI flakes.
