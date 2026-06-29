# codexclaw MVP — Status

Numbering: cli-jaw devlog convention. `0X0_` per phase-group; sub-steps `0X1..0X9`;
fine increments (`022.1`) allowed. PABCD steps appear as suffixes when work starts.

## Phase 1 (MVP core) — state mgmt + dev-skill injection, config untouched
| Step | File | Status |
|------|------|--------|
| 020 | 020_phase1_overview.md | PLANNING |
| 021 | 021_codex_skill_injection.md | TODO |
| 022 | 022_pabcd_skill_native.md | TODO |
| 022.1 | 022.1_pabcd_state_files.md | TODO |
| 023 | 023_goal_convention_port.md | TODO |
| 024 | 024_dev_skills_conversion.md | TODO |
| 024.1 | 024.1_dev_skill_pilot.md | TODO |
| 025 | 025_subagent_as_employee.md | TODO |
| 026 | 026_minimal_system_prompt.md | TODO |
| 027 | 027_config_untouched_guard.md | TODO |
| 028 | 028_phase1_integration.md | TODO |
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
| 070 | 070_packaging.md | TODO |

## Notes
- 2026-06-29: Plan restructured into 3 phases. opencodex confirmed = provider proxy, not harness.
- Phase 3 scheduling feasible via `codex exec` + OS scheduler (launchd/cron). No built-in cron.
- Reference: `devlog/.lazycodex` (gitignored).
- Decisions confirmed (015): all-13 dev skills, omo goal gate, 3 shippable MVP units.
- Remaining open: Q-P2-1/2 (GUI reuse, ocx-absent multi-model), Q-P3-2 (result delivery).
