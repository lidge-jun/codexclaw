# 020 — wp2: the freeze-train lessons, as rules dev-devops can cite

Phase: wp2. Depends on: wp0. Independent of wp1 and wp3 (disjoint files).

## Problem

opencodex ran a release train (v2.32.1) and an operator-visibility train back to
back, and both produced failures whose common shape is: **a gate that could not
be satisfied honestly got satisfied narratively.** The first GO report argued a
red suite into an exception. A mandatory gate had no implementing phase. A live
process from the original bug report was measured as if it were the candidate
build.

`cxc-dev-devops` today has three rule ids: `DEVOPS-AUTH-01`,
`DEVOPS-RELEASE-PROOF-01`, `DEVOPS-AGENT-SAFETY-01`. None of these lessons is
stated. `DEVOPS-RELEASE-PROOF-01` is the nearest neighbour and is genuinely
different: it governs the proof bundle for a PUBLISHED artifact (digest, builder
identity, deploy target, smoke, rollback). It says nothing about a readiness
REPORT, nothing about which command counts as "the suite", and nothing about
rewriting a gate after it fails.

## MODIFY map

Placement follows the existing router/reference split: STRICT release-gate rules
go in `SKILL.md` §2.7 next to `DEVOPS-RELEASE-PROOF-01`; the operational
mechanics go in the reference file that already owns that surface.

### `skills/dev-devops/SKILL.md` §2.7 (Release Proof Contract)

| id | severity | statement | source |
|---|---|---|---|
| `DEVOPS-FREEZE-SHA-01` | STRICT | Pin a readiness/GO report to the code SHA its gates describe. If the report head moved, prove the delta is docs-only with `git diff --name-only <freeze> <head>` and keep every gate receipt on the freeze SHA. | `900_go_nogo_readiness_report.md:3-7`; the follow-up commit `bb89eafbe` exists precisely because the first version did not do this |
| `DEVOPS-GATE-WEAKEN-01` | STRICT | A red named gate is never excused inside the report that gate failed. Make the original command green, or replace it with a pre-declared equivalent CI actually runs, and declare the swap before the verdict. | `900:47-49`; the `02c302a54` freeze was audit-rejected on this count |
| `DEVOPS-REVIEW-THREADS-01` | STRICT | Unresolved review threads on merged PRs are a GO blocker. Count them after merge, not at merge time. | `900:40-46`; pre-declared at `080_wp8:47` |
| `DEVOPS-GATE-OWNER-01` | STRICT | A mandatory GO gate needs an implementing work-phase and a recorded terminal outcome (pass / not-reproduced / explicitly deregistered). | `090_wp9:6-8`, `000_baseline_scope_and_roadmap.md:243-245` |

`DEVOPS-GATE-OWNER-01`'s source line is worth quoting in the skill verbatim
because it is the whole rule in seven words: "a gate nobody implements is not a
gate."

### `skills/dev-devops/references/ci-cd-deploy.md`

| id | severity | statement | source |
|---|---|---|---|
| `DEVOPS-SUITE-PARTITION-01` | STRICT | A local one-process full-suite run is not the CI suite gate. Replay CI's real partition — general shards plus each segregated job's exact command — and record both forms. | `900:54-58`; `run-bun-test-batches.sh:50` excludes three load-sensitive files that `ci.yml:301-338,340-370` runs as their own jobs |
| `DEVOPS-BASELINE-DEFECT-01` | STRICT | A local red test is a candidate defect until ALL THREE hold: identical failure on the untouched baseline SHA, no merged unit touching that code, and CI's matching job green at the freeze SHA. Two out of three is not evidence. | `900:69-72`, `010_wp1:179-181` |
| `DEVOPS-VERIFY-INSTRUMENT-01` | STRICT | Do not change the verification instrument (runner flags, parallelism, shard layout, timeouts, retry policy) while using it to certify a freeze. Change it against a known-good baseline, or defer it. | `070_wp2:44-45,117-121` |
| `DEVOPS-EXACT-HEAD-01` | STRICT | Re-read the PR/branch head immediately before claiming exact-head evidence. A remembered pass is not evidence; a contributor push mid-verification makes the recorded SHA stale. | `070_wp2:136-139,87-98`; `260825_operator_visibility_train/000:63-65` |
| `DEVOPS-FLAKE-STABILITY-01` | DEFAULT | A flaky-capable suite is stable only after N consecutive greens at ONE head plus the required matrix. One green run is not a land signal. | `070_wp2:94-98,125-126` (opencodex used three) |

`DEVOPS-VERIFY-INSTRUMENT-01` and `DEVOPS-FLAKE-STABILITY-01` stay separate ids
on purpose: one says do not swap the instrument, the other says how many greens
count. Merging them would lose whichever half the citing text did not need.

`DEVOPS-FLAKE-STABILITY-01` must POINT at the wp3 canonical flaky policy rather
than restate remediation. It is a release-gate counting rule, not a remediation
rule.

### `skills/dev-devops/references/sre-foundations.md`

| id | severity | statement | source |
|---|---|---|---|
| `DEVOPS-STALE-PROCESS-01` | STRICT | A live long-running process is not candidate evidence until its start time, binary, and config are proven to match the build under test. | `090_wp9:21-23` — a 100-call canary was run against PID 922, started two days earlier: the reporter's own pre-fix proxy |
| `DEVOPS-OBS-SIGNAL-01` | DEFAULT | When an operator surface is missing a signal, ADD the missing signal; never flip an already-true status bit to compensate. A degraded or ineligible verdict that reaches an operator command must carry a message. | `260825_operator_visibility_train/020_wp3:16-22`; the silent-ineligible half at `001:97-118` and `030:75-87` |

`DEVOPS-STALE-PROCESS-01` has a local precedent worth cross-referencing: this
repo's own memory records proving process-start-time against dist mtime during a
cli-jaw deployment. Same rule, independently learned.

## Explicitly NOT added

Read and rejected as devops rules because they belong elsewhere: the sidecar
backend-resolution ternary, the two-null-policy warning, version-manager shim
adoption, "reproduce from the reported observable, not from a mapper you chose to
call" (that is testing), and `--ff-only` versus rebase for an unpushed commit
(that is git-train). Recorded in 001 §D so the next pass does not re-derive them.

## Accept criteria

| # | Criterion | Proof |
|---|---|---|
| 1 | Each of the 11 rules exists once, with an id, a severity, and a devlog citation | `rg -e 'DEVOPS-'` across dev-devops |
| 2 | No rule duplicates `DEVOPS-RELEASE-PROOF-01`, `DEVOPS-AUTH-01`, or `DEVOPS-AGENT-SAFETY-01` | side-by-side read |
| 3 | Reference-file rules are not re-stated in SKILL.md (pointer only) | `rg` count per id is 1 outside its owner file |
| 4 | Every citation resolves to a real line in the opencodex devlog | spot-check 3 at random |

## Scope boundary

IN: the three dev-devops files.
OUT: the opencodex repo itself; `platform-engineering.md` and
`package-release.md` unless a rule genuinely lands there; any attempt to
backport these rules into cli-jaw or ima2-gen.

## Delivered, and what the audit changed

Landed in `3d5d0d34`, corrected in `836954db`. Placement moved from the planned
§2.7 to a **new §2.8**: §2.7 is a three-line published-artifact contract, and
GO/NO-GO decision rules are a different shelf. The auditor agreed this was the
right call rather than the deviation it looked like.

**Three claims in the first version were invented.** Not misread sources —
fabricated supporting detail wrapped around real lessons. An independent lane
checked each against the opencodex devlogs and the live CI scripts:

| Claimed | Actually |
|---|---|
| A train "ran a 100-call canary" whose numbers described the bug | The canary was a GO criterion, REJECTED as the wrong instrument before it ran, once PID 922 was identified as the reporter's pre-fix proxy (`090_wp9`:17, `080_wp8`:24). The measurement never happened. |
| "run 1 green, run 2 failed, run 3 produced the finding" | The recorded table is green, green, fail (`070`:87-98). |
| "OpenCodex used three" consecutive greens | Three was the bar they SET and never collected — which is why the PR was deferred (`070`:125-126). |
| "three load-sensitive files, each in its own job" | Three path PATTERNS covering seven files, run by TWO jobs: `storage policy` takes six together, `api usage` takes one (`run-bun-test-batches.sh`:50, `ci.yml`:304). |

The last one is the instructive failure. That loose wording came from the source
report itself; copying a report's paraphrase into a STRICT rule is what made it
load-bearing. The corrected text cites the shell script and the workflow
directly, not the report's summary of them.

The rules themselves survived unchanged. Only my evidence for them did not — and
a rule whose cited evidence is wrong is a rule the next reader is right to
distrust.

Also corrected: the router pointed at `ci-cd-deploy.md` §9 and
`sre-foundations.md` §6, neither of which exists (the rules are at §6 and §7),
so an agent following the pointer would have landed in Anti-Patterns. Per-rule
line citations attached, the cli-jaw start-time-vs-dist-mtime precedent
cross-referenced, `/health` corrected to `/healthz`, and four AI-tell sentences
removed.
