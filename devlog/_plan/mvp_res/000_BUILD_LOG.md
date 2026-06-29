# mvp_res Build Log — subagent authoring provenance

Status: PROVENANCE · 2026-06-30 · cxc
Purpose: record how the loop-ordered `mvp_res/` docs were produced, so the `000_INDEX.md`
"Subagent build provenance" reference resolves and future readers can audit grounding.

## Authoring model
- L-docs (010–310) authored by parallel **gpt-5.5** subagents over disjoint decade ranges, each
  grounded in the decade-themed source-of-record under `../260629_codexclaw_mvp/` plus live
  `codex-rs` / omo sources where cited.
- Research carried verbatim into `000_research_src/` (copies of 000/005/006/015/016/021.1/024.2/
  024.3/160 source docs).

## Decade range → source-of-record map
- 010–070 (L1–L7, DONE): 018*, 022.1, 023*, 024*, 025*, 027, 028*, 029*, 070*.
- 080–110 (L8–L11, Cluster 1): 080*, 022.2, 022.3, 023, 080.1.
- 120–190 (L12–L19, Cluster 2): 110_dev_skills_porting, 024.3.
- 200–220 (L20–L22, Cluster 3): 120_clijaw_command_mapping, 130_code_intelligence.
- 230–280 (L23–L28, Cluster 4): 030_phase2_overview, 031–035, 036_phase2_verification.
- 290–310 (L29–L31, Phase 3/defer): 040–044, 150_channel_delivery.

## Hardening passes (this goal: 45ab94c7-ba6)
- Pass 1 (Cluster 1, L8–L11): plan `pass1_P_cluster1_hardening.md`; A-gate audit by gpt-5.5
  reviewer (`.omo/evidence/cluster1-plan-audit-code-review.md`, verdict FAIL→fixed).
- Concurrent commit `4e6539f` (parallel session): status-legend expansion + search on-demand flip.

## Verification convention
- Component code: `node --test` (Node v24 native TS, no build toolchain); build via
  `node:module.stripTypeScriptTypes` aggregation. Phase-1 gate: 73/73 tests green.
