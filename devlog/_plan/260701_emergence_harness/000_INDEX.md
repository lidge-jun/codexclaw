# 260701_emergence_harness — Divergence Layer for PABCD (research track)

Status: RESEARCH (reference-backed design input; NO code change) · 2026-07-01 · evidence: cxc-search Tier 1 primary sources + prior in-repo diagnosis

> This track answers one question the prior diagnosis left open: **PABCD (and its
> siblings jawcode/gjc and lazycodex/omo) are convergence-only loops with no
> divergence surface — what does the established literature say a real
> divergence/quality-diversity layer looks like, and how would it map onto
> codexclaw's no-server, hook-only philosophy?**
>
> Upstream diagnosis (read first): `structure/50_emergence_gap.md` — why PABCD is a
> convergence (exploitation) machine. Sibling comparison verdict: jawcode `autoresearch`
> (best metric-binding) and lazycodex SubagentStop (best evidence gate) each fix *part*
> of the gap; neither has a divergence/population/diversity mechanism.
>
> Enforcement vocabulary: `structure/40_enforcement_methods.md` (tiers E1-E8).
> No-server / hook-only boundary: `structure/00_philosophy.md`.

## Why this track exists

The NYPC "NEXT NATION" bot stalled at 3.5/8 on the official judge while local
self-play showed 96%+. The diagnosis found the loop never generated competing
approaches, never raced them on the true objective, and never injected exploration
on plateau. The literature below is the body of work that solved exactly this class
of problem (LLM-driven program search over a deceptive objective). This track records
the primary sources and distills them into a divergence-layer design input — it does
NOT implement anything yet.

## Source-Proof status (cxc-search)

These are Tier 1 (hosted web search) discovery results. The four anchors are
well-known primary sources (Nature, arXiv, DeepMind). For any claim that drives a
later implementation decision, open the arXiv/Nature PDF for Tier 2 proof before
treating a specific numeric/result claim as settled. Conceptual mechanisms cited
here (programs database, evaluator-scored evolution, novelty archive, MAP-Elites
cells) are stable and corroborated across all four sources.

## Documents

| Doc | Topic |
| --- | ----- |
| `001_reference_landscape.md` | The 4 primary sources: AlphaEvolve, FunSearch, novelty search / MAP-Elites, Quality-Diversity. What each contributes to a divergence layer. |
| `002_divergence_layer_design.md` | How the mechanisms map onto PABCD phases + codexclaw's hook-only / no-server constraints, with an honest E-tier split. |
| `003_open_questions.md` | What must be resolved (in Interview) before any implementation; non-goals; falsifiability of "did the divergence layer help". |
| `004_ipabcd_divergence_flow.md` | Operator-proposed IPABCD mapping (I=diverge N, P=N plans, A+B=worktree builds, C=keep/discard compare, D=human gate). N-sizing + compare mechanism backed by best-of-N / beam / population literature + jawcode autoresearch. |
| `005_loop_continuation_patterns.md` | The same work as a `cxc-loop` improvement: Ralph, jawcode autoresearch, long-running harnesses, SICA → 6 mapped loop levers (durable plan re-read, metric memory, plateau→diverge, ideas/archive, keep/discard, fresh-context resilience). |
| `006_divergence_gating_and_selection.md` | The gating problem: how to decide AB-needed (maximize-metric) vs single-strategy (satisfy-spec), divergence as a plateau-triggered MODE not a default, and layered selection (cheap-screen → harness compare → human gate). |
| `007_collapse_point_model.md` | The collapse-point model: I keeps the N>=2 recording rule (asymmetric "strong-1 + add-1" OK), with the N candidates GROUNDED via `cxc-search` (Tier 1 discover + Tier 2 prove, not invented from memory); the USER-FACING question is conditional (clear intent → converge silently; open intent → ask); build/satisfy-spec collapses EARLY at P; algo/unclear collapses LATE — parallel A-B-C then race at D on the fixed-seed metric. |
| `emergence_gap.html` | Single-page visual diagnosis of the convergence gap (open in browser). |

## Non-goals (restated from philosophy)

- No long-running server, daemon, or background population manager (no-server, §2).
- No claim that a hook can auto-run a tournament — hooks fire on 4 events only.
- No vendored evolutionary framework; the "population" is files + a ledger, not a service.
