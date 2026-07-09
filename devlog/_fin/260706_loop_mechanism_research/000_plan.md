# 260706 loop mechanism research — journal

## Objective

Broaden the NEXT NATION-grounded rules (LOOP-MECHANISM-PROOF-01,
LOOP-RESIDUAL-TRACE-01, LOOP-PEER-CONTRAST-01, commit d3c4c9c) with external
evidence, and fold the findings back across pabcd/loop/dev-testing skills.

## Wave 1 (4 explorers, gpt-5.5, dispatched)

- Lane 1: LLM-agent optimization loops (Reflexion/FunSearch/AlphaEvolve/Eureka)
- Lane 2: SWE activation-evidence practice (feature flags, canary, diff coverage)
- Lane 3: proxy-metric validity (Goodhart, off-policy eval, leaderboard overfit)
- Lane 4: game-AI competition discipline (replay diffs, fishtest SPRT, specialization)

## Target sections

- pabcd/SKILL.md §Optimization-Loop Meta-Rules (rule refinement + provenance)
- pabcd/references/loop-engineering.md §11.4b (case + external grounding)
- loop/SKILL.md §Optimization-loop discipline (pointers)
- dev-testing/SKILL.md §Limited-Oracle (gate-validity extensions from lane 3)

## Journal

- [w1 dispatched] 4 lanes, awaiting returns.

## Wave 1 returns

### Lane 4 (game-AI) — returned, 13 Tier-2 claims

Key: Halite III TheDuck314 loss-triage workflow (categorize by mode/opponent/map,
sort by severity); Battlecode 2020 "copy stronger bot's replay first"; Battlecode
postmortems name dead-mechanism class ("Elixir Bot did not use elixir"); Steamhammer
per-opponent model (unit-mix records, NN matching); fishtest SPRT bounds (STC [0,2],
LTC [0.5,2.5], non-regress [-1.75,0.25]); Libratus overnight branch-patching kept
universal (not opponent-specific); AlphaStar exploiter roles = adversarial gap
finding. Proposed: PEER-CONTRAST-02 (first-divergence-turn), SPRT-GATE-01,
SPECIALIZE-01 (specialization ledger + generality check).

### Lane 2 (SWE activation evidence) — returned, 9 Tier-2 claims

Key: OpenTelemetry feature_flag.evaluation event (activation telemetry standard);
Honeycomb ODD "How will I know it works?" (design evidence BEFORE the feature);
Netflix Kayenta canary judge (statistical continue/rollback score); Harness/Statsig
guardrail-metric alerts; SonarQube new-code >=80% / Codecov patch coverage (diff
coverage proves tests exercise changed lines, NOT runtime activation); Stryker
mutation break threshold; Meta SCARF dynamic dead-code detection (runtime logs over
static reachability); Harbor arXiv 2604.20938 case: two feature-gated mechanisms
with hard-zero counters (reflections written but never retrieved) - EXACT match to
our hp-race incident; Knight Capital SEC order as inverse failure (dormant path
fired). Proposed: activation evidence gate, opportunity/activation/effect
counter-pair rule, acceptance evidence hierarchy.

### Lane 1 (LLM optimization loops) — returned, 18 Tier-2 claims

Key: Reflexion stagnation triggers (same action >3 cycles, 3 consecutive fails);
Self-Refine leaves stop policy open; FunSearch island evolution + periodic weak-island
reset from strong islands; AlphaEvolve cascaded evaluation (cheap tests first, hard
stages for promising only) + MAP-Elites archive; Eureka 5 random restarts x 5 iters
x K=16 + reward COMPONENT tracking across checkpoints (closest to activation
evidence); RDA critique: coarse component stats make distinct behavioral failures
look identical -> trajectory-level diagnostics needed; OpenAI evals: sample-by-sample
inspection over aggregate; Prime Intellect reward hacking: combined score can rise
while intended behavior degrades. Proposed: mechanism activation proof (matches
ours), island/archive plateau discipline, combo-score veto.
