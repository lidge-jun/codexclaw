# codexclaw MVP — Status

Numbering: cli-jaw devlog convention. `0X0_` per phase-group; sub-steps `0X1..0X9`;
fine increments (`022.1`) allowed. IPABCD steps appear as suffixes when work starts.

## Phase 1 (MVP core) — state mgmt + dev-skill injection, config untouched
| Step | File | Status |
|------|------|--------|
| 016 | 016_session_scope_finding.md | RESEARCH (Finding C: per-session) |
| 017 | 017_pabcd_loop_plan.md | LOOP PLAN (7 passes) |
| 018 | 018_pass1_P_plan.md | DONE (Pass 1 P→D, 16/16 tests) |
| 018.2 | 018.2_pass2_P_plan.md | DONE (Pass 2 P→D, 34/34 tests) |
| 019 | 019_phase1_implementation_plan.md | mini-P (impl-grade) |
| 019.1 | 019.1_mini_a_audit.md | mini-A AUDIT |
| 019.2 | 019.2_mini_a_round2.md | mini-A AUDIT (Finding A/B resolved) |
| 020 | 020_phase1_overview.md | PLANNING |
| 021 | 021_codex_skill_injection.md | TODO |
| 021.1 | 021.1_codex_rs_skill_mechanism.md | RESEARCH (source-verified) |
| 022 | 022_pabcd_skill_native.md | TODO |
| 022.1 | 022.1_pabcd_state_files.md | DONE (state.ts/fsm.ts impl, Pass 1) |
| 022.2 | 022.2_ipabcd_and_feature_flags.md | RESEARCH+DESIGN |
| 022.3 | 022.3_interview_goalmode_rules.md | DESIGN (A3 hybrid resolved) |
| 023 | 023_goal_convention_port.md | DONE-budget (Pass 3: budget gate shipped; interview-deny deferred) |
| 023.1 | 023.1_interview_ipabcd_prompts.md | TODO |
| 024 | 024_dev_skills_conversion.md | DONE (Pass 4: all 13 skills converted to Codex; gate empty) |
| 024.1 | 024.1_dev_skill_pilot.md | DONE (recipe anchor dev-debugging locked + applied to all 13) |
| 024.2 | 024.2_cli_jaw_conflict_analysis.md | RESEARCH (source-verified) |
| 025 | 025_subagent_as_employee.md | DONE (Pass 5: 3 roles enriched B-opt2 inline) |
| 026 | 026_minimal_system_prompt.md | TODO |
| 027 | 027_config_untouched_guard.md | DONE (Pass 6 — config-guard backup+revert+drift) |
| 028 | 028_phase1_integration.md | DONE (Pass 6 — activation integrated via config-guard) |
| 028.1 | 028.1_install_activation.md | DONE (Pass 6 — codex features enable wrapper) |
| 029 | 029_phase1_verification.md | TODO |

## Phase 2 — opencodex + GUI (multi-model subagents)
| Step | File | Status |
|------|------|--------|
| 030 | 030_phase2_overview.md | PLANNING |
| 031 | 031_provider_bridge.md | TODO |
| 032 | 032_subagent_config_store.md | TODO |
| 033 | 033_model_catalog.md | TODO |
| 034 | 034_gui_scaffold.md | TODO |
| 035 | 035_gui_subagent_page.md | TODO |
| 036 | 036_phase2_verification.md | TODO |

## Phase 3 — periodic/scheduled work (feasibility confirmed)
| Step | File | Status |
|------|------|--------|
| 040 | 040_phase3_overview.md | PLANNING (feasibility) |

## Expansion (090–150) — cli-jaw cmd/skill + omo component porting
Decision ledger + decade map: 090_expansion_moc.md (jun 확정 2026-06-30).
| Step | File | Status |
|------|------|--------|
| 090 | 090_expansion_moc.md | DECISION LEDGER (decade map) |
| 090 | 090_clijaw_command_mapping.md | ANALYZED (J1, codex-rs source-verified) |
| 100 | 100_skill_hub.md | ANALYZED (J2, codex-rs + OpenClaw/ClawHub) |
| 110 | 110_dev_skills_porting.md | ANALYZED (J3, dev13 + omo12 absorb map) |
| 120 | 120_unified_search_hub.md | ANALYZED (J4, 4-tier + codex browser/computer) |
| 130 | 130_code_intelligence.md | ANALYZED (J5, lsp/codegraph/ast-grep) |
| 140 | 140_subagent_roles_ops.md | ANALYZED (J6, .toml roles + ops) |
| 150 | 150_channel_delivery.md | TODO (deferred: telegram/discord) |
| 017.1 | 017.1_loop_continuation_augment.md | ANALYZED (J7, ulw-loop/start-work-continuation augment for 017/080) |

## Cross-phase
| Step | File | Status |
|------|------|--------|
| 000 | 000_research.md | REFERENCE (read first) |
| 005 | 005_overview.md | REFERENCE |
| 010 | 010_repo_skeleton.md | DONE (2026-06-29) |
| 015 | 015_decisions.md | CONFIRMED |
| 015.1 | 015.1_porting_map.md | CONFIRMED (port-not-strip) |
| 070 | 070_packaging.md | TODO |

## Expansion work-phases (090+) — cli-jaw command/skill + omo component porting
Decision ledger + decade map: 090_expansion_moc.md (jun 확정 2026-06-30). Analysis filled by parallel gpt-5.5 subagents (J1–J6).
| Step | File | Status |
|------|------|--------|
| 090 | 090_expansion_moc.md | DECISION LEDGER + decade map |
| 090 | 090_clijaw_command_mapping.md | RESEARCH (J1 codex-rs system-prompt 실측) |
| 100 | 100_skill_hub.md | RESEARCHED (J2 + web cross-check: dynamic skill loading confirmed) |
| 110 | 110_dev_skills_porting.md | RESEARCH COMPLETE (J3: dev 13종 + omo skill 흡수) |
| 120 | 120_unified_search_hub.md | RESEARCH COMPLETE (J4: 4-tier + omo + codex browser/CU + KO guard) |
| 130 | 130_code_intelligence.md | RESEARCH COMPLETE (J5: lsp/codegraph defer, ast-grep P2 candidate) |
| 140 | 140_subagent_roles_ops.md | RESEARCH COMPLETE (J6: .toml roles, teammode, diag/ops) |
| 150 | 150_channel_delivery.md | TODO (후순위: telegram/discord, 040 결과배달 연동) |

## Notes
- mini-P/mini-A loop active: 019 → 019.1 (audit) → 019.2 (round 2). BLOCKERS RESOLVED: Finding A = A3 hybrid (advisory+native now, hard deny deferred); Finding B = B-opt2 (inline subagent roles in spawn_agent, no plugin role-discovery dependency).
- Interview HARD-depends on request_user_input; FORBIDDEN in goal mode (022.3) — Phase 1 enforcement = advisory ipabcd text + codex-native goals.rs suppression; true hard PreToolUse deny DEFERRED (Q-GM-1-followup).
- WORKFLOW = IPABCD (Interview + IPABCD). Interview uses feature `default_mode_request_user_input` / `request_user_input`.
- ACTIVATION: codexclaw enables codex feature flags (multi_agent/goals/hooks/default_mode_request_user_input) via `codex features enable` at install (027 revised: controlled flag flip, backup+revert, not silent).
- 2026-06-29: Plan restructured into 3 phases. opencodex confirmed = provider proxy, not harness.
- Phase 3 scheduling feasible via `codex exec` + OS scheduler (launchd/cron). No built-in cron.
- References: `devlog/.lazycodex` (gitignored); codex-rs sources at
  `/Users/jun/Developer/codex/121_openai-codex/codex-rs` (core-skills/loader.rs, config/skills_config.rs).
- Conversion grounded: 021.1 (codex skill schema) + 024.2 (8 conflict classes) + 015.1 (porting map).
- DIRECTION: port cli-jaw mechanisms to codex equivalents (commands→native, worker→agent role); keep universal discipline always-on. codexclaw skills are original, fully independent of cli-jaw.
- codex subagent = agent role (role.rs), loaded like config.toml; per-role model override supported.
- dev-* skills (all 13) = subagent ROUTER roles: dev=always-on discipline; surface dev-* referenced by role via B-opt2 inline instructions. debugging is the recipe anchor, not a reduced deliverable.
- Decisions confirmed (015): all-13 dev skills, omo goal gate, 3 shippable MVP units.
- Remaining open: Q-P2-1/2 (GUI reuse, ocx-absent multi-model), Q-P3-2 (result delivery).
- 2026-06-29: Interview + IPABCD prompts decided to use codex request_user_input selector (flag `default_mode_request_user_input`, verified); MCP elicitation as stable fallback. See 260629_research_elicitation.

- 2026-06-29 mini-A (parallel, 2 codex subagents): IPABCD naming normalized across all phase docs (standalone PABCD→IPABCD; dev-pabcd/pabcd-state/filenames preserved). Session-scope (016) design PASS on consistency+omo-parity+agentId-exclusion; 2 low-sev hardening notes folded into 018 (phase-enum validation, ledger interleave caveat). Phases 2/3 reworded INCREMENTALLY-shippable-on-Phase-1-base.

- 2026-06-29 Pass-1 A (plan audit, codex subagent Avicenna): toolchain PASS (Node v24 native .ts + node:test, type:module set), session_id field PASS (codex-rs user_prompt_submit.rs:24/stop.rs:25), omo parity PASS. Blocker found+FIXED: state.ts ORDER ref → moved PHASES const into state.ts (owner of Phase), fsm.ts imports PHASES one-way (no runtime cycle). Plan A-clean.

- 2026-06-29 Pass-1 B+C: implemented state engine; node --test 16/16 PASS. C-gate adversarial audit (codex subagent Epicurus, codex-rs/omo refs): DONE, no concrete defect. Folded 3 low-risk fixes — strict-reconstruction readState (drop unknown keys, omo fidelity), orphan-.tmp cleanup on writeState failure, +2 hardening tests. FSM semantics + session_id consumption verified vs codex-rs user_prompt_submit.rs.

- 2026-06-29 Pass-1 D: IPABCD state engine COMPLETE (Loop Pass 1/7). Full small P→A→B→C→D with 2 parallel + 1 plan + 1 check subagent audits, all codex-rs/omo grounded. 16/16 node:test green. Orchestrator returned to IDLE. NEXT work-phase = Pass 2 (directive hook, T-022c) re-enters at P. Goal f215682e-a05 still active (6 passes remain).

- 2026-06-29 Pass-2 A (plan audit, subagent Arendt; Mill hit 429): payload/output/idempotency/cli-argv/no-cycle PASS vs codex-rs (turn_id always present, snake_case in/camelCase out). BLOCKER #3 ledger-spam (Stop appended every turn) → FIXED: Stop now fully PASSIVE in Pass 2 (no ledger/no phase write). #1 state literal trap flagged for B (must add injectedTurns to spread-less reconstruct literal). Plan A-clean.

- 2026-06-29 Pass-2 B+C+D: directive-injection hook COMPLETE (Loop Pass 2/7). NEW src/parse.ts (defensive snake_case parsers, null-on-corrupt) + src/hook.ts (detectTrigger EN+KO, phaseDirective table, buildContextOutput omo-envelope CRLF/trim/32k cap, handleUserPromptSubmit idempotent per session+turn via injectedTurns, handleStop PASSIVE no-op) + cli.ts stdin dispatch (try/catch exit-0 guard). C-gate: node:test + independent codex subagent (Galileo) adversarial audit vs codex-rs schema.rs + omo hook-output.ts. Verdict FAIL→FIXED 1 blocker: bare 감사 regex injected AUDIT on everyday "감사합니다" (thanks) → AUDIT trigger now requires strong action marker (해줘/해라/하자/좀/진행/부탁). Post-fix node:test 34/34 green. Commits bf7a5ba (B), 8c1d948 (C). Orchestrator IDLE. NEXT = Pass 3 (goal budget gate, T-023) re-enters at P. 5 passes remain.

- 2026-06-30 Pass-3 (P→A→B→C→D): goal budget gate + 018.3 hybrid injection COMPLETE (Loop Pass 3/7). NEW src/goal-gate.ts (parsePreToolUse + applyGoalBudgetGuard — denies budgeted create_goal, omo parity, output verified vs codex-rs PreToolUseHookSpecificOutputWire schema.rs:239-260). 018.3 hybrid injection folded into hook.ts: fail-closed orchestrationActive gate + mode1 explicit trigger / mode2 phase-diff full directive / mode3 short stage header (jwc M2 parity), handleStop still passive. state.ts +lastInjectedPhase +orchestrationActive (3 reconstruct places each), cli.ts +pre-tool-use branch. A-gate audit (subagent Wegener) FAIL→fixed 3 blockers (fail-open I-phase leak→orchestrationActive gate; unbounded injectedTurns→cap 50; Phase|null type). C-gate audit (subagent Bacon) PASS, all 3 fixes verified in code, no new bugs. node:test 52/52 green. Commits: 023.2 plan, Pass3 A, 1331097 (B). Orchestrator IDLE. NEXT = Pass 4 (dev-* skill conversion, see 024.3). 4 passes remain.

- 2026-06-30 Expansion analysis (090–150): jun 결정 원장 기록 + decade map 확정 (090_expansion_moc.md). 7 gpt-5.5 서브에이전트 병렬 파견(J1–J7)으로 7개 분석 문서 작성, 전부 codex-rs/omo 소스 실측 인용. KEY: task→update_plan, dispatch→spawn_agent, worker→list_agents/wait_agent, hooks inspect→codex debug prompt-input 모두 codex-native 매핑 확정; bgtask=exec_command+write_stdin 부분대체(durable 재호출은 자체구현); chat search=app-server thread/search 프로토콜 존재→CANDIDATE 유지(wrapper 필요); diagram/html·codexclaw doctor/reset=자체구현. 100=skill_hub(기본 트리거 dev만 활성, allow_implicit_invocation 기반). 110=dev13 포팅+omo12 흡수표. 120=통합 search(codex browser/computer-use 1차). 130=코드인텔(lsp/codegraph/ast-grep). 140=role.toml+ops. 150=채널배달 후순위. 017.1=ulw-loop/start-work-continuation 보강노트(017/080향). 미커밋(untracked devlog only). NEXT = Pass 4 또는 090+ 구현 진입은 jun 결정 대기.
- 2026-06-30 Pass-4 (P→A→B→C→D): dev-* SKILL CONVERSION COMPLETE (Loop Pass 4/7). All 13 skills now live under plugins/codexclaw/skills/: dev (hub, agents/openai.yaml allow_implicit_invocation:true) + 11 on-demand routers (architecture/backend/code-reviewer/data/debugging/devops/frontend/scaffolding/security/testing/uiux-design, policy false) + pabcd (folded dev-pabcd discipline: Depth-by-Class, work-phase vs PABCD-phase, anti-skip, subagent delegation; aligned with hook.ts PHASE_DIRECTIVES). Recipe locked on dev-debugging (e8cdec0), bulk via 4 parallel gpt-5.4 worker subagents (disjoint write scopes) + serial dev-hub/pabcd by main agent. Each: MUST-USE trigger frontmatter + metadata.short-description, whole source dirs ported (references/scripts/assets/examples), cli-jaw runtime stripped. A-gate audit (Descartes) FAIL→fixed 2 blockers (anchored grep gate, whole-dir copy) folded into 024.4 plan before build. C-gate audit (subagent Gibbs) PASS, zero blockers: repo-wide PRECISE gate empty, frontmatter valid vs loader.rs (name≤64/desc≤1024/short-description), framework APIs (createEventDispatcher/Dispatchers.IO) preserved, no dangling links. node:test 52/52 green (no .ts touched, regression guard). 6 atomic commits (4 router groups + pabcd/README + dev hub). NEXT = Pass 5 (subagent roles, 025). 3 passes remain.
- 2026-06-30 Pass-5 (P→A→B→C→D): SUBAGENT ROLES COMPLETE (Loop Pass 5/7). Enriched plugins/codexclaw/agents/{explorer,reviewer,executor}.toml into omo shape (name/description/nickname_candidates/model=default/developer_instructions) routing through the dev-* skills per surface; dropped invalid read_only key; added agents/README.md documenting B-opt2 inline-injection contract + role->agent_type map (explorer/reviewer->explorer read-only, executor->worker). A-gate audit (subagent Beauvoir) PASS: core conclusion source-verified robust (codex plugin manifest manifest.rs:13/48 has NO agents field → plugin roles not auto-registered → B-opt2 inline correct; built-ins role.rs:313/321/335), folded 3 citation/doc fixes. C-gate: LIGHT tier (3 toml + 1 md, no code) self-verified — all AC met (tomls parse w/ required fields, gate empty, README contract present), node:test 52/52 green (no .ts touched). Commits: 025.1 P plan, Pass5 A, Pass5 B. NEXT = Pass 6 (install/activation + config-untouched guard, 027/028.1). 2 passes remain.
- 2026-06-30 Pass-6 (P→A→B→C→D): INSTALL/ACTIVATION + CONFIG-UNTOUCHED GUARD COMPLETE (Loop Pass 6/7). NEW component plugins/codexclaw/components/config-guard/ wraps the OFFICIAL `codex features enable/disable/list` CLI (format-preserving toml_edit, edit.rs:1195) rather than hand-rolling a TOML editor: features.ts (DECLARED_FEATURES=4 flags multi_agent/goals/hooks/default_mode_request_user_input, SOFT_FEATURES, parseFeaturesList exact-first-field, readDeclaredState, featuresToEnable), activate.ts (snapshot + timestamped .bak + enable per not-already-true flag + .codexclaw-install.json manifest priorEnabled/enabledByCodexclaw/enableFailed/postActivateHash), deactivate.ts (manifest-driven revert, keeps pre-existing-true, sha256 drift guard + safe no-op on missing manifest), cli.ts (real codex runner + codexHome only here, no homedir() in lib). A-gate audit (subagent Lorentz) PASS→5 blockers folded into REV2 (PIVOT to official CLI wrapper; default_mode_request_user_input is UnderDevelopment/default-FALSE + soft dep; drift guard; injected codexHome/runner + real-path guard). C-gate audit (subagent Helmholtz) FAIL→FIXED 1 blocker: substring parse collision (multi_agent vs multi_agent_v2, hooks vs plugin_hooks) would have made deactivate disable stable user flags; rewrote to exact first-field column match + added 3 regression tests with sibling-row fixtures. node:test config-guard 15/15 green (was 12), pabcd-state regression 52/52 green, precise skills gate empty, real ~/.codex untouched (offline fake runner + mkdtemp). Commits: 028.2 P plan, fcf13a8 (A), 4a1c08f (B), ae49085 (B-fix). 027/028/028.1 DONE. NEXT = Pass 7 (build aggregation T-070 + 029 verification gate S1-S5). 1 pass remains.
