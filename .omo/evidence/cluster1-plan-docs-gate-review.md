# Cluster-1 Plan Docs C-Gate Review

recommendation: REJECT

## originalIntent

Independently re-audit the current on-disk codexclaw Cluster-1 plan/spec markdown docs after commit `ba01545` and verify that the prior gpt-5.5 audit blockers are closed, the docs are decision-complete, and no new/residual consistency issue remains.

## desiredOutcome

PASS only if every listed blocker is closed with line-anchored evidence, the `007`/INDEX/L1 native-goal reconciliation does not contradict L8.3 no-ledger scope, acceptance criteria are behavior-testable rather than wording-only, and anti-slop/programming review criteria are satisfied by the docs and evidence artifacts.

## checked artifact paths

- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_BUILD_LOG.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/010_L1_ipabcd_state_engine.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/080_L8_interview_state_schema.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/081_L8.1_state_schema_fields.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/082_L8.2_readiness_fsm_is_interview_ready.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/083_L8.3_bound_ledger_t2_t3_t6.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/090_L9_five_mind_contradiction_dispatcher.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/091_L9.1_five_mind_role_definitions.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/092_L9.2_contradiction_only_dispatch_protocol.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/093_L9.3_loop_coordinator_t4.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/094_L9.4_mind_exec_boundary_t7.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/100_L10_question_gen_automode_freeze.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/101_L10.1_question_generator_m1.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/102_L10.2_auto_mode_assumptions.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/103_L10.3_freeze_to_goal.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/110_L11_goalmode_interview_hard_deny.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/111_L11.1_goal_mode_detection.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/112_L11.2_pretooluse_hard_deny_q_gm_1_f.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/pass1_P_cluster1_hardening.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_research_src/007_impl_reality_findings.md
- /Users/jun/Developer/new/700_projects/codexclaw/.omo/evidence/cluster1-plan-audit-code-review.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/remove-ai-slops/SKILL.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/programming/SKILL.md

## skills and criteria applied

Loaded local reviewer guidance from /Users/jun/.cli-jaw-3459/skills/dev/SKILL.md and /Users/jun/.cli-jaw-3459/skills/dev-code-reviewer/SKILL.md.

Loaded repository-embedded OMO skills:
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/remove-ai-slops/SKILL.md
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/programming/SKILL.md

Direct anti-slop/programming pass result: reject. The diff appends "Hardening pins" but leaves stale or contradictory primary-scope text in place, which creates false confidence. The programming skill rejects brittle prompt tests that assert exact wording rather than parsed structure/decisions/rule data; L9.1 and L10.1 still rely on directive wording acceptance.

The existing code-review report at /Users/jun/Developer/new/700_projects/codexclaw/.omo/evidence/cluster1-plan-audit-code-review.md contains a skill-perspective/slop note at line 10, but it is the prior FAIL report, not a post-fix review artifact for `ba01545`. It does not replace this direct C-gate pass.

## userOutcomeReview

The user's expected outcome is a decision-complete Cluster-1 implementation plan that can be handed to an executor without guessing. The docs now close several concrete prior blockers, but they still do not deliver that user-visible outcome because the ledger model is internally inconsistent, some primary sections still carry stale placeholders/menus, and some acceptance criteria prove prompt wording rather than runtime behavior.

## per-blocker audit

1. 000_BUILD_LOG exists and INDEX provenance reference resolves: CLOSED = Y.
   Evidence: /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_BUILD_LOG.md:1-5 exists and states its provenance purpose; /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md:208-210 points to `000_BUILD_LOG.md`.

2. No dangling `023_goal_creation_gate.md` refs in L11 docs: CLOSED = Y.
   Evidence: L11 refs now point to `023_goal_convention_port.md` at /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/110_L11_goalmode_interview_hard_deny.md:125-128, /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/111_L11.1_goal_mode_detection.md:53-56, and /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/112_L11.2_pretooluse_hard_deny_q_gm_1_f.md:67-70. Historical mentions in pass1 are not live L11 references.

3. No `RESOLVED` status and INDEX legend covers every label in use: CLOSED = N.
   Evidence: no uppercase `RESOLVED` was found in a `Status:` line, but the legend in /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md:49-57 only covers DONE, FROZEN, PLANNED, ANALYZED, DEFERRED, and BLOCKED. It does not cover actual status labels such as PROVENANCE at /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_BUILD_LOG.md:3, P at /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/pass1_P_cluster1_hardening.md:3, or CANONICAL INDEX at /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md:3. If the intended legend scope is "loop docs only", the docs must say that explicitly.

4. L8.3 exact numeric caps and replay id fields: CLOSED = Y.
   Evidence: /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/083_L8.3_bound_ledger_t2_t3_t6.md:48-55 pins `MAX_TRACKER_ARRAY = 50`, DROP-OLDEST, and `roundId`, `contradictionId`, `planEditId`, `freezeId`.

5. L9.2 exact correlation field and format: CLOSED = Y, with residual inconsistency.
   Evidence: /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/092_L9.2_contradiction_only_dispatch_protocol.md:47-50 pins `correlationId: string` and format `<roundId>-<mindId>`. Residual: the example `3-skeptic` at line 49 conflicts with the fixed Mind IDs in /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/091_L9.1_five_mind_role_definitions.md:15-21.

6. L10.3 exact freeze manifest path, schema, and slug rule: CLOSED = Y.
   Evidence: /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/103_L10.3_freeze_to_goal.md:65-75 pins `.codexclaw/interview/freeze.json`, schema, slug derivation, and goal-start integration behavior.

7. L10.2/L10/L8 no live `ledger_only` closure mode and Cluster-1 no-ledger scope consistent: CLOSED = N.
   Evidence for closure-mode removal: /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/100_L10_question_gen_automode_freeze.md:49-52 and /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/102_L10.2_auto_mode_assumptions.md:53-55 remove `ledger_only`. But the broader no-ledger scope is not consistent; see blocker R1 below.

8. L11/L11.2 exact PreToolUse matcher path and fail-closed-on-unreadable rule: CLOSED = Y, with stale text.
   Evidence: /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/110_L11_goalmode_interview_hard_deny.md:110-123 and /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/112_L11.2_pretooluse_hard_deny_q_gm_1_f.md:61-65 pin `plugins/codexclaw/hooks/pre-tool-use-guarding-interview-in-goal.json`, separate registration after `pre-tool-use-guarding-goal-budget.json`, exact `request_user_input` matching, and fail-closed `unreadable`. Residual: primary scope still says the path is "to be filled" at /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/110_L11_goalmode_interview_hard_deny.md:47-48.

## blockers

R1. Ledger/no-ledger contradiction remains unresolved.

Evidence:
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_research_src/007_impl_reality_findings.md:9-14 says codexclaw must keep plan hash, checkpoints, assumptions, and phase evidence in a codexclaw-owned auxiliary ledger under `.codexclaw/`.
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md:137-141 repeats that codexclaw keeps audit tracking in an auxiliary `.codexclaw/` ledger.
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/010_L1_ipabcd_state_engine.md:19-20 and 35-41 say L1 ships an append-only audit ledger at `<cwd>/.codexclaw/ledger.jsonl`.
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/080_L8_interview_state_schema.md:35-37 and /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/083_L8.3_bound_ledger_t2_t3_t6.md:56-58 say no append-only ledger ships in Cluster 1 and bounded in-state arrays are the only durable surface.

Why this blocks approval: executors cannot tell whether Cluster 1 should use the existing L1 ledger for audit/phase evidence, avoid ledger writes entirely, or only forbid a new interview-history/closure ledger. The "only durable surface" wording also conflicts with L10.3's required freeze manifest at /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/103_L10.3_freeze_to_goal.md:65-75.

Minimal exact fix:
- Pick one model and update all affected docs consistently. The least disruptive fix is to narrow L8.3 to: "No new append-only interview-history or `ledger_only` closure ledger ships in L8-L10. The existing L1 `.codexclaw/ledger.jsonl` remains the generic PABCD audit ledger for phase evidence/checkpoints, while interview tracker closure uses bounded state arrays/recorded assumptions and freeze handoff uses `.codexclaw/interview/freeze.json`." Then update 080 and 102 to use the same wording.

R2. Hardening pins are appended without reconciling stale primary scope text.

Evidence:
- L11 primary scope still says the matcher path is "to be filled" at /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/110_L11_goalmode_interview_hard_deny.md:47-48, despite the later pin at lines 110-123.
- L9.2 example `3-skeptic` at /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/092_L9.2_contradiction_only_dispatch_protocol.md:49 conflicts with L9.1 fixed Mind IDs at /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/091_L9.1_five_mind_role_definitions.md:15-21.
- L9.4 nested-session detection remains a menu of possible signals at /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/094_L9.4_mind_exec_boundary_t7.md:15-18 rather than a single source plus fallback order.

Minimal exact fix:
- Replace stale scope text, not just append pins. Change L11:47-48 to the exact hook path. Change L9.2 example to a valid ID such as `3-contrarian`. Replace L9.4:16 with an ordered rule such as "source order: explicit subagent role metadata -> injected subagent instructions -> task-dispatch context -> spawn-capability absence; first positive signal wins; if none, treat as top-level."

R3. Acceptance criteria still include brittle wording/prose tests.

Evidence:
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/091_L9.1_five_mind_role_definitions.md:33-36 only checks that directive text includes names/descriptions and says "contradictions only".
- /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/101_L10.1_question_generator_m1.md:33-36 only checks that question rules mention background/options/recommendation/impact and reference `request_user_input`.
- The programming skill says prompt tests should assert parsed structure, decisions, or rule data, not exact prompt strings, at /Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/programming/SKILL.md:105-107.

Minimal exact fix:
- Convert these acceptance criteria to behavior/structure checks. Example: validate a parsed directive/rule object containing the five Mind IDs, allowed output schema, and denied action set; validate generated `request_user_input` payload shape with 2-3 options, recommended option first, and per-option impact fields.

R4. Status legend criterion is under-specified and not globally true.

Evidence:
- Legend at /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_INDEX.md:49-57 does not cover labels used by meta/research docs, including /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_BUILD_LOG.md:3, /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/pass1_P_cluster1_hardening.md:3, and /Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/000_research_src/007_impl_reality_findings.md:3.

Minimal exact fix:
- Either expand the legend to include meta/research/pass status labels, or rename it to "Loop doc status legend" and add a separate one-line note that meta/research docs may use descriptive provenance statuses.

## exact evidence gaps

- No post-fix code-review report artifact was found for `ba01545`; /Users/jun/Developer/new/700_projects/codexclaw/.omo/evidence/cluster1-plan-audit-code-review.md is the prior FAIL audit and cannot prove the fixes were independently accepted.
- No manual QA matrix artifact for the post-fix docs was provided or found.
- The direct slop/programming pass found unresolved doc slop: appended pins conflict with unreconciled primary sections, and wording-only acceptance remains.

