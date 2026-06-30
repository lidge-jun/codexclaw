# 007 — The Collapse-Point Model: diverge at I always, converge early vs late

Status: RESEARCH (design input; NO code change) · 2026-07-01

> Operator refinement (2026-07-01): divergence is recorded at I for EVERY task
> (log N>=2 approaches in devlog), but the point where the loop collapses to one
> candidate MOVES by task type. Build/satisfy-spec collapses early at P (paper
> selection); unclear/algorithmic collapses late, after C ("make them fight" at D).
> This supersedes the looser "divergence mode" framing in `006` with a cleaner axis:
> the COLLAPSE POINT. Upstream: `004`, `006`, `structure/50_emergence_gap.md`.

## The model: I captures INTENT first; divergence is conditional; collapse point is the variable

```
I  ── capture the user's INTENT first (I's core job)
│      • intent clear & directed ("build X this way")  ──► just capture intent, N=1, proceed
│      • intent open / exploratory / maximize-metric    ──► consider & record N>=2 approaches
│
├─ BUILD / satisfy-spec ──► COLLAPSE EARLY at P
│     (if N>1 was recorded) P selects ONE approach on paper (no metric race available)
│     A → B → C → D run single-candidate (normal PABCD)
│
└─ ALGO / maximize, unclear ──► COLLAPSE LATE after C
      P keeps N plans; A audits each; B builds each (worktrees); C runs each on harness
      D: race the built candidates on the fixed-seed true metric ("싸우게 하기")
```

Diverging IDEAS at I is cheap, but it is NOT mandatory. When the user already carries a
clear implementation goal, I only needs to grasp that intent — manufacturing >=2
alternatives there is the over-process trap (dev §0: "if the user already specifies clear
tech and scope, skip clarification entirely"). Divergence is reserved for when intent is
open, or for the unclear-algorithmic case where only a real metric can decide.

## I's rule: intent first, N>=2 only when intent is open

The single biggest defect in `50_emergence_gap.md` was P committing to ONE approach from
the first phase WITHOUT considering alternatives. The fix is NOT "always log >=2" — that
would re-introduce over-process on directed builds. The fix is a CONDITIONAL at I:

- **Intent clear & directed** (the user states what to build and how, or it is C0-C2
  ordinary build work): capture the intent, proceed single-approach. Do not fabricate
  alternatives. The collapse is immediate and trivial.
- **Intent open / ambiguous / exploratory, or maximize-metric with no obvious winner**:
  record N>=2 candidate approaches in the devlog so P (or a late collapse) has real
  alternatives to weigh. This is where anti-anchoring matters.

So N>=2 at I is an option offered against intent-clarity, not an always-on mandate. The
floor is "capture intent"; divergence is the exception layered on top when intent is open.

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
| I captures intent; N>=2 only if intent open | devlog/`.codexclaw` record; conditional on intent-clarity, not forced | E7 |
| classify early vs late collapse | objective-kind (satisfy vs maximize) + winner-clarity | E7 |
| P early selection | subagent critic + `cxc-search` convention research | E7 (agent runs it) |
| late parallel build | worktrees (`team` pattern) | E7 + E2 ledger |
| D metric race | fixed-seed `evaluate.sh`, keep/discard | E2 / CLI |
| plateau re-arms late collapse | Stop metric-delta check | E2 (the real lever) |

Only the metric race and the plateau check are hook/CLI-enforced (E2). The collapse-point
decision and the paper selection are agent doctrine (E7) recorded in the ledger.

## Open questions (Interview)

- Intent-clarity test: what concretely flips I from "capture intent, N=1" to "record
  N>=2"? (directed scope + satisfy-spec → N=1; open scope or maximize-metric → N>=2)
- P early-selection: is the subagent critic mandatory, or only when the N approaches are
  close? (cost vs rigor)
- Late-collapse trigger at the FIRST phase vs only on plateau: do we ever start a goal
  already in late-collapse, or always start single and let plateau escalate?
