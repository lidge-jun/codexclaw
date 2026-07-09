# 004 — IPABCD Divergence Flow (operator-proposed, literature-checked)

Status: RESEARCH (design input; NO code change) · 2026-07-01 · cxc-search Tier 1 + jawcode autoresearch code read

> Operator proposal (2026-07-01): map the divergence layer onto IPABCD phases directly,
> with N bounded small (autoresearch-style), branch-per-candidate builds, and a human
> decision gate at D. This doc records the flow and the literature/runtime evidence that
> sizes N and defines the compare/keep mechanism. Upstream: `002_divergence_layer_design.md`.

## The proposed flow

```
I  (Diverge)   generate N candidate APPROACHES (bounded small, archetype-tagged)
P  (Commit)    confirm >=N implementation plans  [ONLY when task is algorithmic/emergent]
A+B (Build)    build >=2 candidates in worktrees, sequentially
C  (Compare)   run all candidates on the SAME benchmark/seeds; keep/discard by true metric
D  (Decide)    record results + ASK the user: proceed with kept / re-diverge / explore more
```

This is correct in shape: it puts the missing **divergence** at I, the missing
**candidate set** at P, the missing **race** at A+B/C, and a **human gate** at D. It does
not rewrite PABCD; it widens I→C for one class of task and keeps convergence inside each
candidate's build.

## Sizing N — keep it SMALL (this is the key refinement)

The operator's instinct ("너무 발산은 그런데") is backed by the literature:

- **Best-of-N flattens fast.** pass@N is monotonic but gains plateau; with a weak/noisy
  verifier the optimal extra-sample count can be ~0. Rule of thumb is N=5–10 only when
  there is NO strong verifier, N=20–50 with a good execution verifier.
  [arXiv:2107.03374 Codex pass@k; arXiv:2411.17501 imperfect-verifier diminishing returns]
- **Wider is not better.** Beam search shows a "beam search curse" — too-wide search can
  degrade final quality, not improve it. Start moderate, tune on validation.
  [Cohen & Beck 2019 (PMLR v97); aclanthology 2023.eamt-1.10]
- **Population size = explore/exploit knob.** Small population exploits fast but risks
  premature convergence; large explores rugged/deceptive landscapes but costs more. No
  universal best size — it depends on landscape ruggedness.
  [ACM 10.1145/2480741.2480752 survey; arXiv:2501.02153]

**Decisive cost argument for codexclaw:** here each "sample" is a FULL PABCD cycle
(worktree + build + verify), not a cheap token sample. So the per-candidate cost is far
higher than best-of-N token sampling. That pushes the sweet spot BELOW the 5–10 rule:

- **Default N = 2–3 approaches** for an algorithmic work-phase.
- Cheap-screen first when possible (one `evaluate.sh` run on a stub/heuristic) before
  committing a full build to a candidate.
- Raise N only when the landscape is proven deceptive (metric plateaued under low N) —
  i.e. escalate diversity exactly when Novelty Search says to (S3 in `001`).

## Compare/keep mechanism — borrow autoresearch, not raw best-of-N

jawcode `autoresearch` already implements the safe compare loop; reuse its discipline
rather than ad-hoc "pick the best-looking one":

- **Harness-first (Phase 1).** Before any candidate, build `autoresearch.sh`: emits
  `METRIC name=value`, runs deterministically on fixed seeds, exit 0/non-0.
  (`packages/coding-agent/src/autoresearch/prompt-setup.md`). This is the faithful-judge
  step NYPC skipped — the single highest-value habit.
- **keep / discard / crash / checks_failed (Phase 2).** Each candidate run is logged:
  `keep` commits the worktree, `discard`/regress/flat reverts it, low confidence → re-run
  before keeping. Confidence is reported as a multiple of the observed noise floor.
  (`autoresearch/prompt.md`, `tools/log-experiment.ts`).
- **Same-seed ablation is enforced by construction:** every candidate runs the identical
  `autoresearch.sh`, so deltas are attributable, not noise. This is exactly what the C
  phase needs and what `attest.ts:98` (exitCode-only) does not give.

So the C phase = run each built candidate through the same harness, keep the metric-best,
discard the rest (revert their worktrees). Not "best-of-N rerank on vibes" — keep/discard
on a fixed-seed true metric.

## D — the human decision gate (operator's addition, retained)

After C compares candidates, D should NOT silently pick and march on. It asks the user:

1. **Proceed** with the kept candidate (converge/ship it).
2. **Re-diverge** — discard all, generate a fresh approach set (the plateau→novelty
   escape from S3 when no candidate beat baseline).
3. **Explore more** — raise N / add an archetype not yet tried.

This is honest about the irreducible judgment: when several candidates are close, or none
beats baseline, a human picks the direction. It also matches the no-server constraint —
the gate is a `request_user_input` at D, not an autonomous tournament controller.

## Guardrails (carried from 003 + the diagnosis)

- Divergence flow is **opt-in for algorithmic/emergent tasks only** — build/bug work must
  NOT pay N× build cost. Likely a goal tag.
- N small by default (2–3); escalate diversity only on proven plateau.
- Compare on a SAME-seed harness; remote-judge truth stays operator-entered (a hook can't
  read it — `50_emergence_gap.md` limit).
- Worktree-per-candidate reuses jawcode `team`'s isolation pattern; no new server.
- D's human gate is `request_user_input`, consistent with HITL when no autonomous proof
  exists.

## Open sizing questions (for Interview)

- Cheap-screen before full build: what's the stub metric that decides which of N
  approaches earns a full PABCD build?
- N escalation rule: exact plateau threshold that bumps N or forces re-diverge.
- Worktree budget: max concurrent/sequential candidate builds per work-phase.
