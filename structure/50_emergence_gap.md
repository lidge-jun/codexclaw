---
created: 2026-07-01
tags: [codexclaw, pabcd, emergence, exploration-exploitation, algorithm-tasks, diagnosis]
aliases: [PABCD emergence gap, why creativity did not emerge, exploration gap]
---

# 50 — The Emergence Gap: why PABCD is a convergence machine, not a divergence machine

> Diagnosis SOT. Why the PABCD loop, which is excellent for build/bug work, is
> structurally weak on emergent/algorithmic tasks (the NYPC "NEXT NATION" bot
> stalled at 3.5/8 on the official judge despite 96%+ local self-play winrate).
>
> Sourced from a 4-agent parallel diagnosis (structural code audit, wp1-15 history,
> skill audit, external GPT-Pro opinion) + a Contrarian re-scan + web methodology
> research (AtCoder heuristic-contest practice; novelty-search literature). The
> operator's framing was exact: "창의성이 발현이 안 되었다 — 현재 전략/버그에만 몰두."

## The one-sentence finding

PABCD enforces **convergence (exploitation)**: every phase narrows toward one
already-chosen target and proves the shape of the work. It has **no divergence
(exploration) surface** — no point where competing hypotheses are generated,
raced, and pruned — and no plateau sensor that injects diversity when the true
objective stops moving. For build/bug work the target is given, so convergence IS
correctness. For algorithmic/emergent work the target is unknown, so a
convergence-only loop locks onto the first approach and symptom-patches it forever.

## Where each phase fails an emergent task

| Phase | Current definition (pabcd/SKILL.md) | Convergence trap | What an emergent task needs |
|-------|--------------------------------------|------------------|------------------------------|
| **I — Interview** | clarify scope across 4 dims, then plan | asks scope, never raises *competing strategy candidates* | enumerate 2-4 rival approaches as hypotheses to race |
| **P — Plan** | write ONE diff-level plan, commit to it | **the biggest trap**: single approach is locked from the first phase | a portfolio of N approaches + an ablation/tournament plan |
| **A — Audit** | adversarially review THAT plan | critiques correctness inside one basin; never asks "is there a fundamentally different approach?" | challenge the *approach choice*, not just its bugs |
| **B — Build** | implement the audited plan | builds the one locked idea | build the top candidates in parallel, keep an archive |
| **C — Check** | run build/tests, "real verification" | `attest.ts` only checks `checkOutput`+`exitCode` — a weak self-play proxy passes forever | validate against the TRUE objective with train/val/holdout split |
| **D — Done** | summarize + close to IDLE | closes on phase-motion, not objective-delta | record the true-objective metric and its delta vs last work-phase |
| **cross-phase** | `MAX_STOP_BLOCKS=3` turn-cap only | no result-quality history in `state.ts:18`; no plateau sensor | "N non-improving work-phases -> force step-back / diversify" |

## The two structural roots (file:line)

1. **No objective-delta memory.** `state.ts:18` persists phase/flags/Stop-counters
   only; the ledger (`state.ts:36`) stores phase transitions + evidence strings,
   never a metric delta. So the loop literally cannot know it has plateaued.
2. **C->D is bound to command-shape, not objective-truth.** `attest.ts:98` gates on
   `checkOutput`+`exitCode`; it cannot tell the official judge from local sparring.
   96% self-play passes C/D indefinitely while the real score is flat
   (NYPC: wp9 1400 local games WA=0 vs official 3.5/8).

## What the methodology literature says we were missing

AtCoder heuristic-contest practice (the closest discipline to this task class):
- **Split seeds train/validation/holdout; never chase the validation set.** Tweaking
  after every check overfits exactly like ML. [intro-heuristics; AWTF2025 heuristic]
- **Track median + worst-10% + variance, not mean.** A solver that improves only on
  a few seeds is overfit — which is precisely the 96%-local / 3.5-official gap.
- **Ablate on the SAME seeds/folds** so a change is attributable, not noise. [sklearn CV]

Novelty-search / explore-exploit literature (deceptive optimization landscapes):
- Pure score-greedy search gets stuck in deceptive local optima; the fix is
  **alternating explore/exploit phases with a behavioral-diversity archive**, not a
  single optimized candidate. [Lehman novelty search; EyAL; SERENE; BEACON]

GPT-Pro's independent read matched: "the official judge is not giving you a score;
it is giving you counterexamples — harvest them. Demote local self-play winrate from
the main target to a regression smoke test; build an `official_counterexamples/`
fixture and require old-vs-new ablation on it."

## Honest fix taxonomy (E-tier from 40_enforcement_methods.md)

This is the part most likely to become theater if we are not careful — the very E7
failure mode being diagnosed. Split by what can actually be enforced:

**E2/CLI-enforceable (real harness, codexclaw-owned):**
- Add an operator-supplied **true-objective metric** to the work-phase ledger
  (the operator types the latest submission score; codexclaw cannot read a remote
  judge, so operator-entry is the only honest binding — auto-judge-gating is
  impossible and must NOT be claimed).
- A **stagnation sensor**: after N work-phases with no metric improvement, the Stop
  hook injects a "step-back / diversify / re-interview" directive instead of
  releasing into another same-basin cycle.

**E7 prose (guidance only — label it honestly, do not call it enforcement):**
- A `dev-*` methodology overlay (working name `dev-emergent` or
  `competitive-tuning`): faithful-judge parity, seed train/val/holdout split,
  overfitting warning when local and true metrics diverge, opponent/solution
  replay-forensics, P-phase "generate N rival approaches" divergence step.

**Ownership split (Contrarian #10):** the harness levers (metric memory, stagnation
sensor, P-phase divergence) are codexclaw-owned; the domain methodology (how to
build a faithful NYPC judge, how to read official logs) is bot-repo-owned. Keep them
in separate work-phases so success/failure attribution stays clean.

## What this fix does NOT claim (Contrarian guardrails)

- It does **not** claim "mostly harness fault." Real domain walls existed
  (wp13 deathball / MOVING immutability; official logs show genuine
  `RESULT RIGHT_WIN HQ_DESTROYED`). A better harness would have surfaced the wall in
  ~2 work-phases instead of ~9 — it would not auto-solve the strategy.
- It does **not** claim C/D can machine-verify the official score (remote, server-side).
- It does **not** claim a new skill is a structural fix; prose is E7 and ignorable
  unless paired with the E2 stagnation sensor.
- A single NYPC re-submission cannot statistically prove harness causality; the
  honest local proof is old-vs-new ablation on an official-counterexample fixture.
