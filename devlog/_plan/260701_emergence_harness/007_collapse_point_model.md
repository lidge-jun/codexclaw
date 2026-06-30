# 007 — The Collapse-Point Model: diverge at I always, converge early vs late

Status: RESEARCH (design input; NO code change) · 2026-07-01

> Operator refinement (2026-07-01): divergence is recorded at I for EVERY task
> (log N>=2 approaches in devlog), but the point where the loop collapses to one
> candidate MOVES by task type. Build/satisfy-spec collapses early at P (paper
> selection); unclear/algorithmic collapses late, after C ("make them fight" at D).
> This supersedes the looser "divergence mode" framing in `006` with a cleaner axis:
> the COLLAPSE POINT. Upstream: `004`, `006`, `structure/50_emergence_gap.md`.

## The model: I records N>=2 (kept); the USER-FACING question is conditional; collapse point varies

```
I  ── record N>=2 candidate approaches in devlog/.codexclaw  (KEPT rule; anti-anchoring)
│      approaches are GROUNDED via cxc-search, not invented from memory
│      candidates MAY be asymmetric: "strong-1 + add-1" (one primary + one light alternative)
│      • user intent clear  ──► do NOT interrogate the user with an N>=2 menu;
│      │                         the agent records strong-1 + add-1 itself, then converges
│      • user intent open   ──► may surface options / ask the user to choose
│
├─ BUILD / satisfy-spec ──► COLLAPSE EARLY at P
│     P selects ONE approach on paper from the recorded N (no metric race available)
│     A → B → C → D run single-candidate (normal PABCD)
│
└─ ALGO / maximize, unclear ──► COLLAPSE LATE after C
      P keeps N plans; A audits each; B builds each (worktrees); C runs each on harness
      D: race the built candidates on the fixed-seed true metric ("싸우게 하기")
```

## cxc-search grounds the N>=2 generation (mandatory when diverging)

Inventing the N approaches from memory re-creates the anchoring failure — the "alternatives"
collapse to minor variations of the first idea the model thought of. So whenever I (or a
late-collapse P) generates N>=2 candidates, the divergence MUST be grounded through
`cxc-search`, not pulled from memory:

- **Discover real approaches (Tier 1).** Rewrite the problem into focused queries and find
  what established methods / algorithms / library options / prior art actually exist for
  this problem class. The candidate set should reflect genuinely different real approaches,
  not invented placeholders.
- **Prove before trusting (Tier 2).** Treat search hits as candidate URLs; open the primary
  source to confirm an approach is real, current, and applicable before it becomes a
  recorded candidate. (Source-Proof Invariant.)
- **Classify the target first (Korean Intent Guard rule 1).** External method/library
  lookup → the web ladder; framework/API docs → official docs; this repo's existing pattern
  → file search. Convention/precedent for the EARLY collapse (build) is the same skill,
  used to pick the approach that matches established practice.
- **Deep research only when warranted (Tier 3, opt-in).** For a genuinely open
  maximize-metric problem (the late-collapse case), the main agent MAY spawn the ultraresearch
  swarm to map the approach space before committing N plans — deliberately, not by default.

So the N>=2 rule and the cxc-search rule are linked: **a recorded candidate must trace to a
real, source-checked approach, not a memory guess.** strong-1 + add-1 still applies — but
both the strong and the add are grounded, the add at least at Tier 1 discovery depth.

Recording >=2 approaches at I is cheap and stays ON — it is the anti-anchoring habit that
breaks the "first approach lock-in" behind the NYPC plateau. What is CONDITIONAL is the
user-facing surface: when the user already gave clear intent, the agent does NOT ask them
to pick between N options (dev §0: "if the user already specifies clear tech and scope,
skip clarification entirely"). The divergence still happens internally and is logged; the
user is simply not interrogated.

## I's rule: keep N>=2 recording; gate the QUESTION, allow asymmetric candidates

The single biggest defect in `50_emergence_gap.md` was P committing to ONE approach
WITHOUT considering alternatives. The fix keeps the N>=2 recording rule, but separates two
things that the previous draft wrongly merged:

- **Recording (kept, always):** I logs >=2 approaches. The second need not be a co-equal,
  fully-elaborated plan — **"strong-1 + add-1"** is valid: one primary recommendation plus
  one lightweight alternative noted for contrast. This keeps anti-anchoring without
  doubling the planning cost.
- **User-facing question (conditional):** only ask the user to choose among approaches when
  intent is open/ambiguous. When intent is clear, capture it, record strong-1 + add-1
  yourself, and converge at P without a multiple-choice prompt.

So N>=2 is NOT downgraded to "only when intent is open" — it stays. What is gated is
whether the divergence is surfaced to the user as a question, and how heavy the second
candidate is.

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
| I records N>=2 (strong-1 + add-1 OK) | devlog/`.codexclaw` record; kept rule | E7 |
| N>=2 grounded via cxc-search | Tier 1 discover + Tier 2 prove; not from memory | E7 |
| ask the USER to choose | only when intent is open; else converge silently | E7 |
| classify early vs late collapse | objective-kind (satisfy vs maximize) + winner-clarity | E7 |
| P early selection | subagent critic + `cxc-search` convention research | E7 (agent runs it) |
| late parallel build | worktrees (`team` pattern) | E7 + E2 ledger |
| D metric race | fixed-seed `evaluate.sh`, keep/discard | E2 / CLI |
| plateau re-arms late collapse | Stop metric-delta check | E2 (the real lever) |

Only the metric race and the plateau check are hook/CLI-enforced (E2). The collapse-point
decision and the paper selection are agent doctrine (E7) recorded in the ledger.

## Open questions (Interview)

- Asymmetry default: is "strong-1 + add-1" the standard shape, escalating to N co-equal
  candidates only for the late-collapse algo case?
- User-question trigger: what concretely flips I from "record silently + converge" to
  "ask the user to choose"? (clear intent → silent; open/ambiguous → ask)
- P early-selection: is the subagent critic mandatory, or only when the N approaches are
  close? (cost vs rigor)
- Late-collapse trigger at the FIRST phase vs only on plateau: do we ever start a goal
  already in late-collapse, or always start single and let plateau escalate?
