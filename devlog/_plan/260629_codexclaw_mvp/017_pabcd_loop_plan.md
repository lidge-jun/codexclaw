# 017 — Phase 1 PABCD Loop Plan (multi-pass, small per implementation unit)

Status: PLAN (loop map)  ·  Phase 1
Decision (jun, 2026-06-29): run PABCD MANY times — one small cycle per implementation unit.
Plan all passes up front, then enter the FIRST P.

## Loop principle
- Each pass = one atomic implementation unit = a full small P→A→B→C→D.
- Passes ordered by dependency: state engine → hooks → gates → skills → roles → install → build/verify.
- A pass only starts when its upstream pass reached D (or is stubbed enough to unblock).
- Keep each pass tiny: 1 component or 1 skill family, with its own accept criteria.

## Pass map (Phase 1)
| Pass | Unit | Tasks | Depends on | Done = |
|------|------|-------|-----------|--------|
| 1 | IPABCD state engine | T-022a state.ts + T-022b fsm.ts | — | state roundtrip + FSM transition tests green |
| 2 | Directive hook | T-022c directives.ts + codex-hook.ts (UserPromptSubmit) | Pass 1 | explicit-trigger injects once; idempotent; no goal-branch |
| 3 | Goal budget gate | T-023 goal-gate (PreToolUse ^create_goal$) | — (parallel-ok) | token_budget deny + passthrough unit tests |
| 4 | dev-* router skills | T-024 (debugging recipe anchor → bulk 12) | — (parallel-ok) | all 13 validate + route; zero cli-jaw paths |
| 5 | Subagent roles | T-025 B-opt2 inline (explorer/reviewer/executor) | Pass 4 | spawn runs role w/ inline instr referencing dev-* router |
| 6 | Install / activation | T-028.1 + 027 guard | Passes 1-5 artifacts exist | enable flips only declared flags; backup; uninstall reverts |
| 7 | Build + verify | T-070 aggregation + 029 gate S1-S5 | Passes 1-6 | reproducible build; validator clean (known hooks FP); 029 green |

## Notes
- Passes 3 and 4 have no upstream dependency → may run anytime; sequenced after 1-2 only for focus.
- Q-DEV-2 (dev-pabcd vs ipabcd): RECOMMENDATION = fold dev-pabcd discipline into `ipabcd`, ship one
  workflow authority (no separate dev-pabcd router). Confirm at Pass 4 P. Non-blocking.
- Deferred items (A3 hard deny, B-opt1 role files) are explicitly OUT of this loop (post-Phase1).

## Entry
- First P = Pass 1 (IPABCD state engine). See the per-pass P notes appended as work starts.
