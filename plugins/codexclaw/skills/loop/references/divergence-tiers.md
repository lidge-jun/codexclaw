# Divergence Tiers

This reference owns the detailed DIVERGE-TIER-01 cost tiers and operational rules.

## Tier Selection

- **Tier 0:** inline brainstorm in the plan with no dispatch.
- **Tier 1 (default):** run 2-3 parallel conceptual candidate lanes. Each lane yields
  one one-page direction document, with no code or worktree, and front-matter for
  `assumptions`, `risks`, `kill-criteria`, and `evidence-needed`.
- **Tier 2 (rare):** use isolated worktrees and a shared `evaluate.sh` only when the
  choice is load-bearing, Tier-1 candidates genuinely conflict, and judgment requires
  running code. Expect 0-1 Tier-2 races per unit and record entry as a P-level decision.

Tier inflation and tier deflation are both violations. The scarce resources are
wall-clock time and collapse-owner attention, not tokens.

## Tier 1 Operations

Lane research is performed by read-only EXPLORER subagents that return findings and
evidence only. The MAIN session writes the candidate document, or assigns it to a
scoped WORKER whose write scope is the devlog unit or `.codexclaw/divergence/`.
Explorers never write files.

The front-matter lives in the candidate document. `cxc divergence candidate add`
records its archive row (kind, title, rationale, and `--source`). The MAIN session is
the collapse owner and critiques and triages candidates directly; a separate
cross-critique round is not a gate condition.

The collapse gate requires N candidate documents with complete front-matter and
per-candidate provenance. Tier 1 tightens the `cxc-search` provenance rule and never
relaxes it. Minds remain interview-time contradiction lenses, not candidate authors.
For research-heavy units, the first Tier-1 dispatch SHOULD be a blindspot/unknowns pass
so candidates come from evidence rather than parameter tweaks.

Topology is star, not mesh: subagents neither message one another nor spawn workers.
Exchange is file-mediated through `.codexclaw/divergence/` and the devlog unit.

## Provenance And Ownership

Every candidate carries `cxc-search` provenance: `strong-1` should be Tier 2 proven,
and `add-1` must be at least Tier 1 discovered. Record provenance with
`cxc divergence candidate add ... --source <url>`.

When candidate work uses a git worktree, write archive entries to the owner worktree.
From child worktrees, run `cxc divergence ... --cwd <owner-repo-root>` so the collapse
owner sees every candidate.

## Collapse And Evaluation

Collapse at P for satisfy-spec work with a locally checkable pass/fail condition.
Collapse at D for maximize-metric work where local metrics can deceive: build candidates
in isolated worktrees, run the same `evaluate.sh`, then keep or discard by the recorded
metric.

For maximize goals, build or validate `evaluate.sh` before candidate implementation. It
must be deterministic, use fixed seeds or folds, and emit `METRIC name=value`; ingest
results with `cxc metric ingest --session <id>`.

If local metrics improve while holdout or true metrics stall or fall, treat that as an
overfitting stop signal and re-plan before keeping the candidate.

## Control Boundary

This is E7 doctrine plus project-local evidence. The only shipped E2 lever is the
goal-mode Stop hook's plateau block; HITL divergence entry is human- or agent-selected.
Worktree creation, harness execution, and candidate races are agent-executed work, not
background automation. `.codexclaw/divergence/` files are durable evidence, not an
automatic control source; active mode alone cannot move phases or build candidates.
