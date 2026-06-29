# L10 Question Generator + Auto-Mode + Freeze Code Review

Review target: `/Users/jun/Developer/new/700_projects/codexclaw` at HEAD `0034850c2346f1573ca80870b8e756bf197a9d33`.

Verdict: REQUEST_CHANGES

codeQualityStatus: BLOCK
recommendation: REQUEST_CHANGES
reportPath: `.omo/evidence/l10-question-gen-automode-freeze-code-review.md`

## Evidence

- Specs read:
  - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/100_L10_question_gen_automode_freeze.md`
  - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/101_L10.1_question_generator_m1.md`
  - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/102_L10.2_auto_mode_assumptions.md`
  - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/103_L10.3_freeze_to_goal.md`
- Implementation inspected:
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/triage.ts`
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/freeze.ts`
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts`
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/cli.ts`
  - tests under `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/`
- Verification run: `npm test` from `/Users/jun/Developer/new/700_projects/codexclaw`
  - Result: 132 tests, 132 pass, 0 fail.
- Focused probe:
  - `triageContradiction("high", "manual", n)` returned `ask_user` for counters -1, 0, 1, 2, 3, 4, 5.
  - `triageContradiction("low", "manual", n)` escalated at counter 3.

## Skill-Perspective Check

- Ran/consulted `dev`, `dev-code-reviewer`, and `dev-testing`.
- `remove-ai-slops` was available at `/Users/jun/Developer/codex/161_lazycodex/plugins/omo/skills/remove-ai-slops/SKILL.md` and was consulted.
- `programming` was available at `/Users/jun/Developer/codex/161_lazycodex/plugins/omo/skills/programming/SKILL.md`; TypeScript README and type-pattern references were consulted.
- Violations found:
  - `remove-ai-slops`: test false-confidence/tautology in freeze coverage; shipped helpers are effectively dead code without production wiring.
  - `programming`: implementation-mirroring tests; prompt/directive tests assert fragments rather than behavior; `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/hook.test.ts` is 304 pure LOC, over the 250 LOC ceiling.

## CRITICAL

None.

## HIGH

1. L10 is not wired into the runtime path, so the shipped behavior is mostly exported helpers plus tests, not the frozen interview loop.

   The only production CLI dispatch in `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/cli.ts:44` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/cli.ts:53` handles `user-prompt-submit`, `stop`, and `pre-tool-use`; it never calls `triageContradiction`, `autoResolveToAssumption`, `buildFreezeManifest`, `checkStale`, `QUESTION_SHAPE_DIRECTIVE`, or `GOAL_ACTIVATION_DIRECTIVE`. `rg` found those new L10 exports only in their definition files and tests. This does not satisfy 102's "Main triages each contradiction before asking or editing" or 103's "goal start recalculates the current plan hash and compares it to the manifest."

2. Freeze manifest shape does not match the exact 103 hardening pin.

   The spec pins `{ frozenAt, planFiles, planHash, objective, slug, evidenceBundle: { dimensions, openAssumptions[], contradictions[], acceptanceCriteria[], researchReportRef } }` at `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/103_L10.3_freeze_to_goal.md:65` to `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/103_L10.3_freeze_to_goal.md:75`. The implementation returns `{ version, slug, frozenAt, freezeId, files, evidence }` at `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/freeze.ts:37` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/freeze.ts:44`. It omits `objective`, `planHash`, `planFiles`, and the pinned `evidenceBundle`/`acceptanceCriteria` names, and `computeFreezeId` truncates to 16 hex chars instead of exposing the pinned plan hash.

3. `OPEN ASSUMPTIONS` is not proven hash-covered; the related test is tautological.

   `computeFreezeId` hashes only sorted `path:sha256` file hash pairs at `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/freeze.ts:50` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/freeze.ts:57`, while `openAssumptions` is carried separately in `evidence` at `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/freeze.ts:29` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/freeze.ts:35`. Changing `evidence.openAssumptions` without changing `files` leaves `freezeId` unchanged. The test named "OPEN ASSUMPTIONS content is part of the hash surface" at `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/freeze.test.ts:49` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/freeze.test.ts:54` only asserts that the evidence field exists; it never compares hashes.

4. Stale execution can still slip through because stale detection is pure and uncalled, with no re-freeze path.

   `checkStale` returns a boolean and message at `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/freeze.ts:90` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/freeze.ts:107`, but no production code calls it. There is also no implementation of the 103 acceptance CLI/dry-run or re-freeze behavior required at `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/103_L10.3_freeze_to_goal.md:49` to `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/103_L10.3_freeze_to_goal.md:57`.

5. Auto-mode counters required by 102 hardening are not persisted in state.

   The 102 hardening pin requires `tracker.autoResolveCount` and `tracker.consecutiveAutoResolves` persisted in `state.interview`, with specific reset semantics, at `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/102_L10.2_auto_mode_assumptions.md:47` to `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/102_L10.2_auto_mode_assumptions.md:55`. `InterviewTracker` still contains only `roundId`, `dimensions`, `contradictions`, and `assumptions` at `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:52` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:57`. `autoResolveToAssumption` returns an incremented counter at `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/triage.ts:94` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/triage.ts:98`, but no state schema or write path can preserve it across rounds.

6. Recorded assumptions can be marked `recorded:true` without any proof they were written to `## OPEN ASSUMPTIONS`.

   The 102 spec requires auto-resolved contradictions to move to `assumptions[]` with `recorded:true` only after they are written into `## OPEN ASSUMPTIONS` at `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/102_L10.2_auto_mode_assumptions.md:17` to `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/102_L10.2_auto_mode_assumptions.md:22`. `autoResolveToAssumption` has no plan/open-assumptions input or write proof; it unconditionally sets `recorded: true` at `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/triage.ts:89` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/triage.ts:93`. This permits the Must-NOT-Have "hidden assumptions outside OPEN ASSUMPTIONS" failure mode.

## MEDIUM

1. Goal-backfill high severity loses structured review metadata after triage.

   `triageContradiction` returns `assumptionSeverity: "high"` for goal backfill at `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/triage.ts:53` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/triage.ts:58`, but `Assumption` has only `id`, `text`, and `recorded` at `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:45` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts:50`. Once converted by `autoResolveToAssumption`, there is no structured "high severity" or "requires user review" flag for later goal consumption.

2. Question directive exists but is not part of the injected interview directive.

   `interviewDirective()` returns only `PHASE_DIRECTIVES.I` at `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts:101` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts:103`, and the trigger path injects that directive at `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts:181` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts:191`. `QUESTION_SHAPE_DIRECTIVE` is defined at `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts:112` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts:121`, but no production path injects it.

## LOW

1. Tests miss adversarial cases requested by the acceptance review.

   `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/triage.test.ts:16` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/triage.test.ts:20` checks high/manual only at counter 0, not across rhythm values. `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/triage.test.ts:35` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/triage.test.ts:42` does not assert input immutability. `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/freeze.test.ts:34` to `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/freeze.test.ts:47` covers changed and new files but not a missing frozen file, even though that is explicitly requested.

2. Oversized test file increases maintenance cost.

   `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/hook.test.ts:1` is 304 pure LOC. This violates the consulted `programming` and `remove-ai-slops` perspectives' 250 pure LOC ceiling. Most of this predates L10, so this is not the primary blocker, but appending L10 prompt tests to the oversized file continues the smell.

## Positive Checks

- In the pure decision helper, high severity in manual interview does return `ask_user` for all probed counter values, so I did not find a direct high/manual safe-default bug in `triageContradiction`.
- The rhythm guard comparison is correct for the isolated function: counter 2 records, counter 3 asks.
- `autoResolveToAssumption` creates new arrays and removes the target by `contradictionId`, so the basic non-mutating transition shape is reasonable.
- `checkStale` itself detects changed, missing, and new files if a correct caller supplies current file hashes.
- `GOAL_ACTIVATION_DIRECTIVE` correctly says `get_goal`, objective-only `create_goal`, no `token_budget`, and verify a goal row; I did not find an overclaim that codexclaw creates the goal itself.

## Blockers

- Wire L10 triage/question/freeze/goal-start behavior into the actual hook/CLI/skill path, or narrow the claimed shipped scope to pure helper APIs and update acceptance accordingly.
- Implement the exact 103 freeze manifest path/schema, including objective, planFiles, planHash, and evidenceBundle field names.
- Make `OPEN ASSUMPTIONS` hash coverage real and test it by changing assumptions content and observing hash mismatch.
- Persist `autoResolveCount` and `consecutiveAutoResolves` in `state.interview` with the pinned reset semantics.
- Prevent `recorded:true` assumptions unless the visible `## OPEN ASSUMPTIONS` write has occurred or is represented by a typed proof.
- Add goal-start stale checking/re-freeze refusal in a production path, not only a pure helper.
