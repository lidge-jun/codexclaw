# codexclaw MVP — Status

Numbering: cli-jaw devlog convention. `0X0_` per phase-group; sub-steps `0X1..0X9`;
fine increments (`022.1`) allowed. IPABCD steps appear as suffixes when work starts.

## Phase 1 (MVP core) — state mgmt + dev-skill injection, config untouched
| Step | File | Status |
|------|------|--------|
| 016 | 016_session_scope_finding.md | RESEARCH (Finding C: per-session) |
| 017 | 017_pabcd_loop_plan.md | LOOP PLAN (7 passes) |
| 018 | 018_pass1_P_plan.md | P (Pass 1: state engine) |
| 019 | 019_phase1_implementation_plan.md | mini-P (impl-grade) |
| 019.1 | 019.1_mini_a_audit.md | mini-A AUDIT |
| 019.2 | 019.2_mini_a_round2.md | mini-A AUDIT (Finding A/B resolved) |
| 020 | 020_phase1_overview.md | PLANNING |
| 021 | 021_codex_skill_injection.md | TODO |
| 021.1 | 021.1_codex_rs_skill_mechanism.md | RESEARCH (source-verified) |
| 022 | 022_pabcd_skill_native.md | TODO |
| 022.1 | 022.1_pabcd_state_files.md | TODO (session-scoped) |
| 022.2 | 022.2_ipabcd_and_feature_flags.md | RESEARCH+DESIGN |
| 022.3 | 022.3_interview_goalmode_rules.md | DESIGN (A3 hybrid resolved) |
| 023 | 023_goal_convention_port.md | TODO (gate SPLIT: budget ships / interview-deny deferred) |
| 023.1 | 023.1_interview_ipabcd_prompts.md | TODO |
| 024 | 024_dev_skills_conversion.md | TODO (ALL 13 router skills) |
| 024.1 | 024.1_dev_skill_pilot.md | TODO (recipe anchor; all 13 ship) |
| 024.2 | 024.2_cli_jaw_conflict_analysis.md | RESEARCH (source-verified) |
| 025 | 025_subagent_as_employee.md | TODO (B-opt2 inline roles) |
| 026 | 026_minimal_system_prompt.md | TODO |
| 027 | 027_config_untouched_guard.md | TODO |
| 028 | 028_phase1_integration.md | TODO |
| 028.1 | 028.1_install_activation.md | TODO |
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

## Cross-phase
| Step | File | Status |
|------|------|--------|
| 000 | 000_research.md | REFERENCE (read first) |
| 005 | 005_overview.md | REFERENCE |
| 010 | 010_repo_skeleton.md | DONE (2026-06-29) |
| 015 | 015_decisions.md | CONFIRMED |
| 015.1 | 015.1_porting_map.md | CONFIRMED (port-not-strip) |
| 070 | 070_packaging.md | TODO |

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
