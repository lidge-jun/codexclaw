# 007 — The Collapse-Point Model: diverge at I always, converge early vs late

Status: RESEARCH (design input; NO code change) · 2026-07-01

> Operator refinement (2026-07-01): divergence is recorded at I for EVERY task
> (log N>=2 approaches in devlog), but the point where the loop collapses to one
> candidate MOVES by task type. Build/satisfy-spec collapses early at P (paper
> selection); unclear/algorithmic collapses late, after C ("make them fight" at D).
> This supersedes the looser "divergence mode" framing in `006` with a cleaner axis:
> the COLLAPSE POINT. Upstream: `004`, `006`, `structure/50_emergence_gap.md`.

## The model: divergence is fixed at I; the collapse point is the variable

```
I  ── ALWAYS record N>=2 candidate approaches in devlog/.codexclaw  (cheap; anti-anchoring)
│
├─ BUILD / satisfy-spec ──► COLLAPSE EARLY at P
│     P selects ONE approach on paper (no metric race available)
│     A → B → C → D run single-candidate (normal PABCD)
│
└─ ALGO / maximize, unclear ──► COLLAPSE LATE after C
      P keeps N plans; A audits each; B builds each (worktrees); C runs each on harness
      D: race the built candidates on the fixed-seed true metric ("싸우게 하기")
```

Diverging IDEAS at I is always cheap — it is just recording alternatives, and it breaks
the "first approach lock-in" that caused the NYPC plateau. Diverging BUILDS (carrying N
through A-B-C) is expensive, so it is reserved for the unclear-algorithmic case where
only a real metric can decide.

## Why I always logs N>=2 (even for build tasks)

The single biggest defect in `50_emergence_gap.md` was P committing to ONE approach from
the first phase. Forcing I to record >=2 candidate approaches in the devlog — even when
the task will collapse immediately at P — is a cheap, always-on anti-anchoring habit. It
costs a few lines of log and guarantees at least one alternative was considered before
commitment. For a build task the second candidate may be discarded one line later; that is
fine. The record exists, and the reviewer/convention check at P has something to compare.

## Collapse EARLY (build / satisfy-spec): selection at P, no metric race

There is no continuous metric to race, so selection is by informed judgment at P. Two
concrete selection mechanisms (the operator's question):

- **Subagent critic compare.** Spawn a reviewer to adversarially compare the N>=2 recorded
  approaches and recommend one with reasons (rollback risk, blast radius, convention fit).
  This is the existing A-phase audit pulled forward to act as a selection step at P.
- **Convention / precedent research.** Use `cxc-search` (or repo convention discovery) to
  check what the ecosystem standard / existing codebase already does, and pick the
  approach that matches established precedent. Prefer the repo's existing pattern over a
  novel one (dev §0.5 convention discovery).

Output of P: ONE selected approach + a one-line record of why the others were rejected.
Then A/B/C/D proceed single-candidate as today. No worktree fan-out, no metric race.

## Collapse LATE (algo / unclear): parallel A-B-C, race at D

When several approaches are plausible and no paper argument settles it (the maximize-metric
+ not-locally-trivially-verifiable case), do NOT collapse at P:

- **P** writes N>=2 implementation plans (kept, not pruned).
- **A** audits each plan (can be parallel subagents, one per candidate).
- **B** builds each candidate in its own worktree (sequential or parallel per budget;
  reuse jawcode `team` isolation).
- **C** runs each built candidate through the SAME fixed-seed `evaluate.sh` harness.
- **D** races them: keep the metric-best, discard (revert) the rest; if the metric cannot
  separate or none beats baseline, ask the user (proceed / re-diverge / explore more).

"싸우게 하기" = the candidates fight on the fixed-seed true metric at D, not on vibes.

## The two axes, reconciled

`006` framed divergence as plateau-triggered; `007` adds the orthogonal collapse-point
axis. They compose:

| | Collapse EARLY (P) | Collapse LATE (post-C, race at D) |
|---|---|---|
| When | satisfy-spec; or build phase of any task | maximize-metric + unclear winner |
| I records N>=2? | yes (anti-anchoring) | yes |
| Selection by | subagent critic + convention research | fixed-seed metric race |
| Cost | one extra log + a review | N× build + N× verify |
| Plateau (006) | n/a (spec met, loop closes) | plateau can RE-arm a late collapse next phase |

So the default for ordinary build work is: diverge ideas at I, collapse at P, single build.
The expensive late collapse is gated to the unclear-algorithmic case, and a plateau on a
maximize-metric goal can re-trigger a late collapse in a later work-phase.

## Honest E-tier

| Step | Mechanism | Tier |
|---|---|---|
| I logs N>=2 approaches | devlog/`.codexclaw` record; Stop can refuse P with <2 logged | E7 + E2 nudge |
| classify early vs late collapse | objective-kind (satisfy vs maximize) + winner-clarity | E7 |
| P early selection | subagent critic + `cxc-search` convention research | E7 (agent runs it) |
| late parallel build | worktrees (`team` pattern) | E7 + E2 ledger |
| D metric race | fixed-seed `evaluate.sh`, keep/discard | E2 / CLI |
| plateau re-arms late collapse | Stop metric-delta check | E2 (the real lever) |

Only the metric race and the plateau check are hook/CLI-enforced (E2). The collapse-point
decision and the paper selection are agent doctrine (E7) recorded in the ledger.

## Open questions (Interview)

- Minimum N at I: hard floor of 2, or "2 unless the task is genuinely single-option"?
- P early-selection: is the subagent critic mandatory, or only when the N approaches are
  close? (cost vs rigor)
- Late-collapse trigger at the FIRST phase vs only on plateau: do we ever start a goal
  already in late-collapse, or always start single and let plateau escalate?
