# Codexclaw Cluster-1 Plan Audit Code Review

Overall verdict: FAIL

codeQualityStatus: BLOCK
recommendation: REQUEST_CHANGES

Review scope: current on-disk docs under `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/` after a concurrent edit changed L9/L11 status lines from `RESOLVED` to `FROZEN`. No source or plan docs were modified by this audit other than this report artifact.

Skill-perspective check: `dev` and `dev-code-reviewer` were loaded. `remove-ai-slops` and `programming` skill files were not available under `/Users/jun/.cli-jaw-3459/skills` or `/Users/jun/.codex/skills`, so I applied the prompt's documented criteria. The diff violates that perspective through brittle prompt/string acceptance tests, optional/undefined implementation surfaces, and several tests that would prove wording rather than runtime behavior. No deletion-only tests were present.

## Findings By Severity

### CRITICAL

1. L11's hard-deny loop is not implementable with zero questions because the PreToolUse matcher path is explicitly unresolved.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/110_L11_goalmode_interview_hard_deny.md:47` says the exact path is still "to be filled".
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/112_L11.2_pretooluse_hard_deny_q_gm_1_f.md:19` repeats "PreToolUse matcher configuration owned by the codexclaw plugin" without naming the file.
   - Existing implementation evidence shows the current matcher file is `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/hooks/pre-tool-use-guarding-goal-budget.json:1`, registered from `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/.codex-plugin/plugin.json:20`.
   - This is a blocker because an executor could either mutate the existing goal-budget matcher, add a second hook, or only change TS code. Those are different behaviors for the safety-critical `request_user_input` deny.

### HIGH

1. L8/L8.3 do not define bounded-state constants or replay identifiers.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/080_L8_interview_state_schema.md:35` requires caps but gives no numeric cap per array.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/083_L8.3_bound_ledger_t2_t3_t6.md:15` repeats the cap requirement; `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/083_L8.3_bound_ledger_t2_t3_t6.md:34` accepts deterministic capping without specifying the cap.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/083_L8.3_bound_ledger_t2_t3_t6.md:22` makes operation-level identifiers conditional and lists alternatives instead of exact field names.

2. L8.1 does not define the actual `InterviewTracker`, `Contradiction`, and `Assumption` schemas.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/081_L8.1_state_schema_fields.md:19` names the types but not all fields.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/081_L8.1_state_schema_fields.md:34` expects `rounds: 0` and `ready: false`, but those fields are not specified in the scope.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/082_L8.2_readiness_fsm_is_interview_ready.md:27` says not to trust `tracker.ready`, which leaves the persisted `ready` field's semantics unclear.

3. L9 dispatch is not decision-complete.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/090_L9_five_mind_contradiction_dispatcher.md:45` says to add fixed prompt specs, but the docs never provide exact prompt text.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/090_L9_five_mind_contradiction_dispatcher.md:55` through `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/090_L9_five_mind_contradiction_dispatcher.md:59` leave adaptive routing thresholds undefined.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/092_L9.2_contradiction_only_dispatch_protocol.md:15` and `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/092_L9.2_contradiction_only_dispatch_protocol.md:35` require a correlation key but do not name the field or schema.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/094_L9.4_mind_exec_boundary_t7.md:16` lists several possible nested-session detection sources instead of one required source and fallback order.

4. L10 auto-mode/freeze is not decision-complete.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/100_L10_question_gen_automode_freeze.md:49` through `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/100_L10_question_gen_automode_freeze.md:52` define closure names but no max round number, safe/default criteria, or ledger path.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/100_L10_question_gen_automode_freeze.md:59` through `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/100_L10_question_gen_automode_freeze.md:71` are still checklists, not resolved implementation decisions.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/102_L10.2_auto_mode_assumptions.md:20` requires "three consecutive auto-resolves" but does not define the persisted counter field or reset behavior.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/103_L10.3_freeze_to_goal.md:24` and `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/103_L10.3_freeze_to_goal.md:41` require a manifest but do not define exact path, file name, JSON schema, or slug derivation.

5. Several acceptance criteria are brittle prompt/string tests that can pass without implementing the workflow.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/091_L9.1_five_mind_role_definitions.md:34` through `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/091_L9.1_five_mind_role_definitions.md:36` only verify directive text.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/101_L10.1_question_generator_m1.md:34` through `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/101_L10.1_question_generator_m1.md:36` only verify that rules mention concepts.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/090_L9_five_mind_contradiction_dispatcher.md:95` makes the CLI dry-run conditional "if introduced", so the acceptance surface can disappear.

6. pass1 is not sufficient to close the real gaps.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/pass1_P_cluster1_hardening.md:24` proposes adding `RESOLVED` to the legend, directly conflicting with `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md:49` and `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md:57`, which say never to use `RESOLVED` as doc status.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/pass1_P_cluster1_hardening.md:18` says L8.3 commits to an append-only ledger, but current `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/083_L8.3_bound_ledger_t2_t3_t6.md:16` defers detailed-history ledger work outside the sub-pass.
   - The pass1 plan does not list the missing tracker schemas, cap values, correlation schema, routing thresholds, freeze manifest schema, PreToolUse path, or brittle acceptance problems.

### MEDIUM

1. Status vocabulary is still inconsistent, although the specific L9/L11 `Status: RESOLVED` issue was fixed concurrently.
   - Current `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/090_L9_five_mind_contradiction_dispatcher.md:3` and `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/110_L11_goalmode_interview_hard_deny.md:3` now use `FROZEN`.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md:95` still uses `RESOLVED` as a loop status despite the legend forbidding it.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md:116` uses undefined `PLANNED defer`.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md:161` omits `DEFERRED` from the required status template even though the legend defines it at `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md:54`.

2. L9.3 and L9.4 remain `ANALYZED` even though T4/T7 are resolved and their Blocked-on sections say None.
   - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/093_L9.3_loop_coordinator_t4.md:3` and `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/094_L9.4_mind_exec_boundary_t7.md:3` conflict with the INDEX rule at `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md:56` for resolved-but-unimplemented work.

### LOW

1. The prompt's descriptive names for 091-094, 101-103, and 111-112 do not match the on-disk filenames, but the numbered files do exist and were audited.

## Per-Doc Decision-Completeness Table

| Doc | Decision-complete? | Concrete gaps |
|---|---:|---|
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md` | N | L22 status uses forbidden `RESOLVED` at line 95; L31 uses undefined `PLANNED defer` at line 116; template omits `DEFERRED` at line 161; missing `000_BUILD_LOG.md` reference at line 191. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/080_L8_interview_state_schema.md` | N | Array caps and ledger follow-up are not exact at lines 35-36; idempotency mechanism is only negative guidance at lines 41-42. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/081_L8.1_state_schema_fields.md` | N | Type names are listed without full field schemas at line 19; `rounds` and `ready` are accepted at line 34 without scope definitions. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/082_L8.2_readiness_fsm_is_interview_ready.md` | Y | Readiness predicate and acceptance are testable; depends on L8.1 fixing tracker shape. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/083_L8.3_bound_ledger_t2_t3_t6.md` | N | No numeric caps at lines 15, 27, 34; ledger is deferred at line 16 while other docs use `ledger_only`; operation IDs are conditional/alternative at line 22. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/090_L9_five_mind_contradiction_dispatcher.md` | N | Prompt specs not exact at line 45; adaptive routing vague at lines 55-59; correlation key unnamed at line 63; CLI check conditional at lines 95-96. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/091_L9.1_five_mind_role_definitions.md` | N | Fixed prompts are summarized, not specified, at lines 16-22; acceptance only checks text presence at lines 34-36. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/092_L9.2_contradiction_only_dispatch_protocol.md` | N | Dispatch input and correlation schema are incomplete at line 15; accepted contradiction bounds are not numeric at line 30; correlation key name is absent at line 35. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/093_L9.3_loop_coordinator_t4.md` | N | `.codexclaw/` and `.codexclaw/plan/` surfaces lack exact filenames at lines 14 and 17; acceptance line 34 only names a surface. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/094_L9.4_mind_exec_boundary_t7.md` | N | Nested-session detection is a menu of possible signals at line 16; routing thresholds are vague at line 20; dry-run is optional at line 39. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/100_L10_question_gen_automode_freeze.md` | N | Plan docs path conditional at line 29; auto-mode/closure criteria vague at lines 44-52; T5/T8/T9/T10/T11 are checklists at lines 59-71; freeze path/schema is not exact at lines 54-58. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/101_L10.1_question_generator_m1.md` | N | Pending-question behavior is unresolved and offers alternatives at line 22; acceptance checks directive wording rather than generated request schema at lines 34-36. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/102_L10.2_auto_mode_assumptions.md` | N | "Conservative recorded assumption" lacks exact structure/content at lines 15-19; auto-resolve counter field/reset is undefined at line 20; max-round closure has no max or ledger path at line 21. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/103_L10.3_freeze_to_goal.md` | N | Manifest path/name/schema and slug derivation are incomplete at lines 23-24 and 41; goal-start integration point is not named at lines 26-27 and 42. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/110_L11_goalmode_interview_hard_deny.md` | N | PreToolUse matcher path is a placeholder at lines 47-48; fail-open vs hard-deny remains a checklist at lines 57-62; source reference missing at line 112. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/111_L11.1_goal_mode_detection.md` | N | Behavior is mostly implementable, but reference `023_goal_creation_gate.md` is dangling at line 55, so the references are not grounded. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/112_L11.2_pretooluse_hard_deny_q_gm_1_f.md` | N | PreToolUse matcher configuration path is not exact at line 19; reference `023_goal_creation_gate.md` is dangling at line 56. |
| `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/pass1_P_cluster1_hardening.md` | N | Proposed status fix conflicts with INDEX at lines 24-25; ledger gap statement is inaccurate at lines 18-19; plan misses most decision-completeness gaps. |

## Dangling References

- `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_BUILD_LOG.md` is referenced from `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md:191` and pass1 lines 15, 22, 38, 43, but does not exist.
- `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/260629_codexclaw_mvp/023_goal_creation_gate.md` is referenced from `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/110_L11_goalmode_interview_hard_deny.md:112`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/111_L11.1_goal_mode_detection.md:55`, and `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/112_L11.2_pretooluse_hard_deny_q_gm_1_f.md:56`. The existing nearby file is `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/260629_codexclaw_mvp/023_goal_convention_port.md`.
- The named codex-rs files under `/Users/jun/Developer/codex/121_openai-codex/codex-rs` exist for the sampled references.

## Internal Consistency

- L8 ledger scope: current L8.3 defers detailed append-only ledger work outside the sub-pass, but L10 introduces `ledger_only` closure without a ledger path or ownership. Cluster 1 therefore has no single answer for whether interview closure can write a ledger.
- L11 vs INDEX A-option: substantively consistent. Both say codexclaw owns FSM only, delegates goal lifecycle to native Codex `ThreadGoal`, detects active goals via read-only `goals_1.sqlite`, and does not create `.codexclaw/goal-active`.
- L9 T4/T7 vs INDEX: substantively consistent. INDEX says T4=A main-agent owns the prompt-only loop and T7=A top-level main-session-only Mind dispatch; L9 says the same. L9.3/L9.4 statuses remain weaker than the resolved decision state.
- Status vocabulary: L9/L11 head status lines are now corrected to `FROZEN`, but INDEX still contains forbidden or undefined statuses outside Cluster 1.

## Pass1 Plan Coverage

The pass1 plan does not cover all gaps. It must add explicit work items for:

- Exact `InterviewTracker`, `Contradiction`, and `Assumption` schemas.
- Numeric caps for assumptions, contradictions, dimension known/unknown arrays, plus deterministic truncation direction.
- Required operation ID field names and replay/idempotency rules.
- Exact Mind prompt text, dispatch input/output schema, correlation field, routing thresholds, and nested-session detection source/fallback order.
- Exact question/pending-answer state behavior.
- Exact auto-mode counter persistence/reset, max-round count, closure criteria, and ledger path or removal of `ledger_only`.
- Exact freeze artifact paths, manifest file name, manifest schema, slug derivation, and goal-start enforcement integration point.
- Exact PreToolUse matcher JSON path/registration strategy for L11.
- Replacement of brittle directive-text tests with runtime-behavior tests where possible.

## Blockers

- Resolve L11 PreToolUse matcher path and fail-closed behavior.
- Define L8 tracker schemas, caps, and replay IDs.
- Define L9 prompt/routing/correlation schemas.
- Define L10 auto-mode and freeze manifest semantics.
- Fix dangling references.
- Rewrite pass1 so it closes these exact gaps instead of adding `RESOLVED` to the status vocabulary.
