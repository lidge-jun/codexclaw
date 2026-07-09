# 006 — When to Diverge, and How to Select (the gating problem)

Status: RESEARCH (design input; NO code change) · 2026-07-01

> Operator point (2026-07-01): the prior docs assume divergence but never say HOW to
> decide a task needs AB (multi-candidate build) vs a single strategy, nor HOW to select
> among diverged candidates. Most goal-directed builds are fine with ONE strategy. This
> doc resolves the gating + selection problem. Upstream: `004`, `005`,
> `structure/50_emergence_gap.md`.

## The core correction: divergence is the EXCEPTION, gated — not the default

Forcing N candidates on every task would make build/bug work N× slower for no gain. The
default must stay single-strategy convergence (normal PABCD). Divergence is a MODE the
loop enters on signal and exits when resolved.

## Discriminator — does this task need AB at all?

The dividing line is the OBJECTIVE's shape, not the task label:

| | Satisfy-spec (convergent) | Maximize-metric (divergent) |
|---|---|---|
| Objective | pass/fail, one correct behavior | continuous score, "better is open-ended" |
| Verifiable locally? | yes (tests/typecheck settle it) | often no (remote judge / holdout / hidden dist) |
| Landscape | not deceptive | deceptive — local proxy can mislead |
| Examples | bug fix, CRUD, refactor, migration | NYPC bot, perf tuning, heuristic search, ML knobs |
| Strategy count | **N=1 is correct** | N≥2 may be needed |

If the task is satisfy-spec → single strategy, do NOT pay divergence cost. This is the
common case and the operator is right that "one strategy is enough" for it.

## The key insight: divergence is usually PLATEAU-TRIGGERED, not up-front

You rarely KNOW up front that you need divergence — you discover it when a single strategy
stalls against the true objective. So the loop should:

```
DEFAULT          single strategy, normal PABCD (N=1)
  │
  ├─ plateau?    L3 metric-delta check: N non-improving work-phases on the TRUE metric
  │              (not turn-count) → flip to DIVERGENCE MODE for the next work-phase
  │
  DIVERGENCE     I generates N=2-3 archetypes, P plans them, A+B builds, C compares
  │
  └─ resolved    a candidate beats baseline (keep) OR human picks at D
                 → return to single-strategy convergence on the winner
```

Divergence is a mode entered and exited, not a permanent state. This directly resolves the
operator's tension: goal-directed builds START with one strategy; the loop only escalates
to divergence when the metric proves the single strategy is stuck.

### Up-front divergence — the narrow exception
Skip straight to divergence at the FIRST work-phase only when ALL hold:
- objective is maximize-metric (continuous score), AND
- the true objective is not locally verifiable (remote/holdout), AND
- multiple architectures are plausible with no a-priori winner.
NYPC met all three; a CRUD endpoint meets none.

## Selection — how to pick among N diverged candidates (cheapest judge first)

Layered, so expensive human judgment is last:

1. **Cheap-screen.** Before any full PABCD build, run each candidate as a stub/heuristic
   through `evaluate.sh` once. Prune candidates the metric already separates. (Mirrors
   autoresearch establishing baseline before iterating.)
2. **Harness compare.** If cheap-screen can't separate the survivors, full-build the top 2
   in worktrees and run BOTH through the same fixed-seed harness. Keep the metric-best,
   discard (revert) the rest. Same-seed → attributable, not noise.
3. **Human gate (D).** Only when the metric cannot decide — candidates within noise floor,
   OR none beats baseline — ask the user: proceed with kept / re-diverge / explore more.

Selection criterion is ALWAYS the fixed-seed true metric, never "looks smarter." The human
enters only at the irreducible-judgment boundary, which keeps the loop honest and cheap.

## How the loop carries this (cxc-loop)

- The loop runs single-strategy by default; the L3 plateau check (doc `005`) is the switch
  that arms divergence mode.
- Divergence mode is recorded in `.codexclaw/` state (mode flag + candidate archive) so a
  fresh pass knows it is mid-divergence and which candidates exist.
- On resolution the mode clears; the loop converges on the kept candidate.
- For a satisfy-spec goal the plateau check effectively never fires (the spec is met and
  the loop closes), so single-strategy goals pay zero divergence overhead.

## Honest E-tier

| Decision | Mechanism | Tier |
|---|---|---|
| satisfy-spec vs maximize-metric classify | operator/agent judgment at goal start (a goal tag) | E7 |
| plateau → arm divergence | Stop hook metric-delta check | **E2 (the real lever)** |
| cheap-screen prune | agent runs `evaluate.sh` on stubs | E7 + E2 ledger |
| harness compare keep/discard | fixed-seed metric, worktree revert | E2 / CLI |
| human gate when metric can't decide | `request_user_input` at D | E2 (HITL) |

The only thing a hook truly enforces is the plateau→diverge switch (E2). Everything else is
the agent following the discriminator and the layered selection, recorded in the ledger.

## Open questions (Interview)

- Goal tag: explicit `--objective-kind satisfy|maximize`, or inferred from whether an
  `evaluate.sh` METRIC exists?
- Plateau threshold to ARM divergence vs the threshold to FORCE re-diverge — same N or
  different?
- Cheap-screen fidelity: a stub metric that is too rough mis-prunes; how faithful must it
  be before it is allowed to prune a candidate?
