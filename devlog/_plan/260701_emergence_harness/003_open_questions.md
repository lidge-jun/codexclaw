# 003 — Open Questions, Non-Goals, Falsifiability

Status: RESEARCH · 2026-07-01

> Per the loop discipline, these must be resolved in an Interview round before any
> implementation. This doc is the interview input, not a license to code.

## Open questions (resolve in Interview)

1. **Scope of the divergence layer.** Is it a general PABCD addition, or an opt-in mode
   for "emergent/algorithmic" tasks only? (Build/bug work does NOT want forced divergence —
   it would waste cycles. Likely answer: opt-in tag on the goal.)
2. **Where does the true objective live?** For a remote judge (NYPC), the metric is
   operator-entered; for a local benchmark, `evaluate.sh` emits it. Do we support both from
   day one, or local-benchmark first?
3. **Plateau threshold N.** After how many non-improving work-phases does Stop force
   diversification? Fixed (e.g. 2, matching "after 2 non-improving submissions") or
   configurable per goal?
4. **Archive behavior descriptor.** Who defines the niche key — operator (named archetypes)
   or a derived signal? MAP-Elites needs a behavior space; a coding task has no obvious one.
5. **Candidate cost.** N>=2 full PABCD cycles per round is expensive. Cap N? Cheap-screen
   candidates first (one eval run) before a full PABCD converge on survivors?
6. **autoresearch reuse.** Adopt jawcode's METRIC/keep-discard pattern as the metric spine,
   or reimplement minimally? (It is extension-gated in jawcode, not default — Godel finding.)

## Non-goals (locked)

- No server / daemon / background population manager (no-server philosophy §2).
- No claim a hook auto-runs a tournament; hooks gate, the agent executes.
- No vendored evolutionary library; archive = files + ledger.
- No new subagent roles (lazygap steering principle); divergence travels as a skill +
  ledger, dispatched through the 3 base roles.
- No auto-verification of a remote judge score (impossible; operator-entered).

## Falsifiability — "did the divergence layer help?"

The Contrarian guardrail from the prior diagnosis applies: a single NYPC re-submission
cannot prove causality. The honest test is **local + ablation**:

1. Build a faithful `evaluate.sh` (or official-counterexample fixture) first.
2. Run the OLD loop (single approach) vs the NEW loop (divergence layer) on the SAME
   seeds/fixtures.
3. Accept the divergence layer only if it produces a measurably better/ more diverse
   candidate set on the fixture — not because one re-submission moved.
4. Separately, the operator may re-submit to NYPC, but that is a real-world check, not the
   causal proof.

## Pointer

Design input: `002_divergence_layer_design.md`. Upstream diagnosis:
`structure/50_emergence_gap.md`. Reference sources: `001_reference_landscape.md`.
