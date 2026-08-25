# 001 — current-state inventory

Four read-only `xai/grok-4.6` lanes produced this, dispatched in parallel from
the P phase of wp0. Every row below was re-checked against the tree before
being written down; claims the lanes could not evidence are marked as such.

## A. Where the attest contract is documented, and whether it is true

| Surface | file:line | from/to? | planUnit / workPhaseId? |
|---|---|---|---|
| **Required attest keys table** | `skills/pabcd/SKILL.md:91-98` | **No** | **No** |
| chat grammar | `skills/pabcd/SKILL.md:49` | no JSON | — |
| Windows recipe | `skills/pabcd/SKILL.md:56-58` | placeholder `'<json>'` | — |
| per-phase artifact prose | `skills/pabcd/SKILL.md:76-82,108-112` | no JSON | — |
| loop mandate | `skills/loop/SKILL.md:27-32,101` | no example object | — |
| interview override | `skills/interview/SKILL.md:64` | **No** (`{"override":true,...}`) | — |
| interview override | `skills/interview/SKILL.md:144` | **No** (`{"override":true}`) | — |
| interview override | `skills/interview/SKILL.md:180-181` | Yes | — |
| doctrine | `structure/20_pabcd_dispatch_doctrine.md:72` | names keys as `{"from","to","did"}` — **not valid JSON** | — |
| CLI help, posix | `orchestrate-cli.ts:166-168` | **Yes** | **Yes** |
| CLI help, win32 | `orchestrate-cli.ts:161` | Yes | Yes |
| Stop-block commands | `hook.ts:1036-1040` | Yes | no workPhaseId |
| goal-idle block | `hook.ts:1163-1164` | Yes, but key is `evidence` not `did` | — |
| loop-arm directive | `hook.ts:471-478,493` | **no object at all** | — |
| docs-site quickstart | `docs-site/.../quickstart.md:22,30,38,46,56` | Yes | A→B missing `auditVerdict`; P→A missing `planUnit` |

The best attest documentation in the tree is `cxc orchestrate --help`. The worst
is the table in the skill the agent is instructed to load. `rg` over
pabcd/loop/interview SKILL.md returns **zero** hits for `planUnit`,
`workPhaseId`, and `testReceiptPath`.

`hook.ts:1163` deserves its own line: the goal-idle block hands the agent
`{"from":"IDLE","to":"P","evidence":"<diff-level plan...>"}`. `evidence` is not
a field `coerceAttest` reads. IDLE→P is ungated so it advances anyway, which is
worse than failing — it teaches a wrong field name that fails silently.

## B. Validation order (why fixing one key is not enough)

From `parseOrchestrateCliArgs` → `runOrchestrateCli`:

```
parse:  JSON.parse → coerceAttest (from/to must be strings)     [1]
run:    attestError short-circuit                    (:345)
        --session guards                             (:373-395)
        P>A: validatePlanArtifacts → planUnit        [2] (:418-421)
        gated + bound slug: validateWorkPhaseBinding [3] (:428-438)
        I>P override: did, then from/to must be I/P  (:455-459)
        transition() → validateAttest:
            attest null                              (attest.ts:173)
            from/to mismatch                         (attest.ts:176-178)
            did / A>B extras / C>D extras            (attest.ts:182-230)
        review-binding, SOURCE-DELTA, C>D receipt
```

Worked cascade for the literal skill-table copy on a bound P>A
(`--attest '{"did":"wrote the plan"}'`):

1. `attest JSON missing valid from/to`
2. `P -> A requires "planUnit": ...`
3. `A goalplan is bound ... pass "workPhaseId" in the attest`
4. only then mismatch / empty-did / edge extras

Three round trips, each one a full turn, all caused by one incomplete table.

Note on `coerceAttest`: its comment at `attest.ts:88` claims it returns null
when from/to "are not valid phases". It does not check Phase membership — only
`typeof === "string"`. `{"from":"plan"}` coerces fine and dies later at
`attest.ts:178`. The comment is wrong; the behavior is defensible (the mismatch
error is more specific). Recorded, not a defect to fix.

## C. The runtime error text

`orchestrate-cli.ts:227`, `:257` and `orchestrate-grammar.ts:88` each emit a
bare string with no example, no phase context, no next command. Note `:227` and
`:257` are NOT the same literal — the file path emits
`attest file <path> is missing valid from/to` — which matters for test coverage.
Compare `attest.ts:173`, which for a MISSING attest already prints:

```
P -> A requires an attestation with a non-empty "did". Pass --attest-file <path>
(required on Windows) or --attest '{"from":"P","to":"A","did":"..."}'.
```

So the codebase already knows how to write this message. The malformed-attest
path just never got the same treatment. An agent whose attest is EMPTY gets
useful help; an agent whose attest is INCOMPLETE gets nothing.

## D. opencodex lessons, with citations

Existing dev-devops rule ids are only `DEVOPS-AUTH-01`,
`DEVOPS-RELEASE-PROOF-01`, `DEVOPS-AGENT-SAFETY-01`. None of the below is
already stated. `DEVOPS-RELEASE-PROOF-01` is adjacent — it governs a published
artifact's proof bundle — but it does not pin a readiness REPORT to a code SHA
and does not forbid rewriting a red gate.

| Proposed id | Severity | Statement | Source |
|---|---|---|---|
| `DEVOPS-FREEZE-SHA-01` | STRICT | Pin a readiness/GO report to the code SHA its gates describe; if later commits exist, prove they are docs-only | `260824_v2_32_1_hotfix_train/900_go_nogo_readiness_report.md:3-7` |
| `DEVOPS-SUITE-PARTITION-01` | STRICT | A local one-process full suite is not the CI suite gate; replay CI's real partition and record both forms | `900:54-58`, `run-bun-test-batches.sh:50`, `ci.yml:234-244,301-338` |
| `DEVOPS-GATE-WEAKEN-01` | STRICT | A red named gate is not excused by rewriting the report; make it green or replace it with a pre-declared equivalent BEFORE the verdict | `900:47-49`, first freeze at `02c302a54` rejected on this count |
| `DEVOPS-REVIEW-THREADS-01` | STRICT | Unresolved review threads on merged PRs are a GO blocker; count after merge | `900:40-46`, pre-declared at `080_wp8:47` |
| `DEVOPS-BASELINE-DEFECT-01` | STRICT | A local red test is a candidate defect until all three hold: identical failure on the untouched baseline SHA, no merged unit touching that code, CI's matching job green at the freeze SHA | `900:69-72`, `010_wp1:179-181` |
| `DEVOPS-VERIFY-INSTRUMENT-01` | STRICT | Do not change the verification instrument while using it to certify a freeze | `070_wp2:44-45,117-121`, `000_baseline:140-145` |
| `DEVOPS-EXACT-HEAD-01` | STRICT | Re-read the PR/branch head immediately before claiming exact-head evidence; a remembered pass is not evidence | `070_wp2:136-139,87-98`; `260825_operator_visibility_train/000:63-65` |
| `DEVOPS-FLAKE-STABILITY-01` | DEFAULT | A flaky-capable suite is stable only after N consecutive greens at ONE head plus the required matrix; one green run is not a land signal | `070_wp2:94-98,125-126` |
| `DEVOPS-GATE-OWNER-01` | STRICT | A mandatory GO gate needs an implementing work-phase and a terminal recorded outcome | `090_wp9:6-8`, `000_baseline:243-245` |
| `DEVOPS-STALE-PROCESS-01` | STRICT | A live long-running process is not candidate evidence until its start time, binary and config are proven to match the freeze SHA | `090_wp9:21-23` (PID 922 from the bug report, measured as if it were the fix) |
| `DEVOPS-OBS-SIGNAL-01` | DEFAULT | When an operator surface lacks a signal, add the missing signal; never flip an already-true status bit to compensate | `260825_operator_visibility_train/020_wp3:16-22`, `001:97-118`, `030:75-87` |

Read and deliberately NOT proposed as devops rules (they belong to product,
testing, or git-train surfaces): the sidecar backend ternary, the two-null-policy
warning, version-manager shim adoption, "reproduce from the reported observable",
and the `--ff-only`-vs-rebase decision.

## E. Flaky policy: the repo currently contradicts itself

**CONTRADICTS** (quarantine/retry/timeout as default or acceptable):

| file:line | text |
|---|---|
| `dev-testing/SKILL.md:218` | `Protocol: detect → quarantine if blocking → assign owner → reinstate after repeated green runs.` |
| `dev-testing/references/ci-pipeline.md:96-102` | `## 5. Flaky Test Quarantine Strategy` — `2. move it to a quarantine tag or job` |
| `structure/30_contradiction_register.md:85` | C10 flake: "candidate for an explicit timeout or build/test serialization" |

**ALIGNED** (already elimination-first) — the majority, which is why the
contradiction is so sharp:

- `dev-testing/SKILL.md:77` `TEST-ANTI-FLAKE-01`: "A time-based flake is a bug.
  Do not use sleep-based synchronization, retry-as-fix, or green-on-retry
  acceptance without a deterministic cause and harness correction."
- `dev-testing/SKILL.md:220-224` `TEST-CI-GREEN-01`: "never blind-retry a failed
  job"
- `dev-testing/SKILL.md:380` "Flakes are diagnosed, not accepted through retry."
- `dev-testing/SKILL.md:482,491` `.skip()` on a failing test is an escalation red flag
- `dev-testing/references/ci-pipeline.md:104-109` first-fix table
- `dev-debugging/SKILL.md:78` "Add retry/skip annotation" is the WRONG-patch column
- `dev-debugging/SKILL.md:309-311` Scenario D: fix isolation, then hunt siblings

### The six contradictions

| # | Conflict |
|---|---|
| C1 | `TEST-ANTI-FLAKE-01` (a flake is a bug) vs `:218` (quarantine if blocking) — same file |
| C2 | `TEST-CI-GREEN-01` (never blind-retry, fix on latest HEAD) vs `:218` (green without a fix) — same file |
| C3 | `SKILL.md:218` vs `ci-pipeline.md:96-102` — duplicated canonical text, and the router's version is WEAKER (no removal deadline) |
| C4 | `dev-testing` quarantine vs `dev-debugging:78` which lists skip as the anti-pattern |
| C5 | `dev-testing:491` (`.skip()` = red flag) vs quarantine tags, which are skip renamed |
| C6 | `dev-debugging:74` (raising a timeout is the wrong patch) vs `structure/30:85` (timeout as a candidate) |

`dev-devops` carries NO flaky policy of its own — it defers at `SKILL.md:328`
to `dev-testing §5`. So it inherits whatever §5 says, and needs a pointer, not a
copy.

### Canonical-owner precedent

`DEV-STACK-*` is the model: canonical text in
`skills/dev/references/stacked-prs.md`, declared in
`skills/dev/references/skill-ownership.md` ("Each rule area has exactly one
canonical owner. Other skills may contain stubs but MUST NOT duplicate canonical
content."), and one-line pointer stubs in `pabcd`, `loop`,
`dev-code-reviewer`, `dev-devops`.

The flaky family has **no row** in `skill-ownership.md`. That missing row is why
the policy drifted into two files with different strength.

## F. Other defects found (recorded, mostly out of scope)

The error-hunt lane swept every agent-facing error string and the shipped-vs-
documented CLI surface. Findings, ranked by how often they bite mid-loop:

1. **I→P can never become ready honestly.** `isInterviewReady` requires all four
   dimensions at `"max"` (`interview.ts:253-270`), `scan record --dim x=max` is
   rejected (`scan-cli.ts:143-151`), and `deriveLevel` never emits `max`
   (`scan-cli.ts:269-271`) — while `interview/SKILL.md:52` tells agents scan-record
   is the path. Every HITL interview either dead-ends or forges `override:true`.
   **Own unit. Not this one.**
2. **The attest table vs the gates.** This unit's wp1.
3. **`--help` is not a contract on the verbs used at P and A.**
   `cxc review-round --help` and `cxc plan --help` exit 1 as unknown verbs
   (`review-round-cli.ts:99`, `plan-cli.ts:75`); `cxc doctor --help`,
   `cxc metric --help`, `cxc divergence --help` also fail. `help-verbs.test.ts`
   covers only loop/receipt/scan — the #47 fix stopped halfway. Checkout
   `bin/codexclaw.mjs:249-286` omits `receipt`, `review-round`, `scan`,
   `release` from top-level help while telling agents to try `<cmd> --help`.
4. **`illegal transition X->Y`** (`fsm.ts:43`) names no legal edges and no
   `cxc orchestrate status`.
5. **`cxc freeze --help` MUTATES the workspace.** It ignores `--help` and runs
   the freeze, writing `.codexclaw/interview/freeze.json` — observed live at
   2026-08-25T02:43:37Z during this inventory. Exit 0, so nothing signals it.
   `.codexclaw/` is gitignored, so the worktree stayed clean; the behavior is
   still wrong.
6. `cxc loop --help` documents `--slug` on `steer`/`add-work-phase`/
   `add-criterion`; the runtime ignores it and binds by session
   (`goalplan-cli.ts:306` vs `:184`). Passing the documented flag is a no-op.
   `loop/SKILL.md:255-261` omits those three shipped verbs entirely.

Items 3, 4, 5, 6 are the same family as the attest bug — a surface that refuses
or misleads an agent following the docs — and are cheap. They are folded into
this unit as wp1 scope where they touch the same files, and recorded as
follow-ups where they do not. Item 1 is a design decision, not a text fix, and
is explicitly deferred.

## G. Suite health (baseline, no repair needed)

`npm test`: 1961 pass / 0 fail / exit 0 / 36.3s.
pabcd-state alone, twice: 865 pass / 0 fail both runs, identical test-name sets.

Contention-sensitive but currently green: `cli-bounds.test.ts` and the dist-CLI
spawn cases in `orchestrate-cli.test.ts` (which carry an in-file comment near
`:486` that concurrent spawn is flaky); `orchestrate-cli.test.ts:478` depends on
`utimesSync` + `Date.now`; nearly every IO test shares the `os.tmpdir()` pool via
unique `mkdtempSync` dirs. No `setTimeout`, no port binding.
`--test-concurrency=1` in the declared command is load-bearing.

Removed from this watch list after audit: `session-split.test.ts:70` uses
`Date.now()` only to mint a name for a directory that must not exist. It has no
timing dependency and listing it here was wrong (002, citation corrections).

**Conclusion for scope:** there is no flaky test to eliminate in this repo today.
The flaky work is policy text, and the policy must not be written as if the
repo's own suite were the problem.
