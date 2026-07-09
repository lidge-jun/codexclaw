# 002 — Divergence Layer Design (mapping to PABCD + hook-only constraints)

Status: RESEARCH (design input; NO code change) · 2026-07-01

> Maps the four literature pieces (`001`) onto codexclaw's actual surfaces. The hard
> constraint: hooks fire on exactly 4 events (UserPromptSubmit / PreToolUse / Stop /
> SessionStart), nothing else is enforceable, and there is no server (`structure/00`).
> So a "population/tournament" must be **files + a ledger driven by the agent**, gated
> only where a hook can really see state. Each lever is labeled with its honest E-tier
> from `structure/40_enforcement_methods.md`.

## The reframe: add a divergence phase, do not replace PABCD

PABCD is correct for convergence (build/bug). The fix is not to rewrite it but to add a
**divergence pass in front of it** for emergent/algorithmic work — then let PABCD
converge on each surviving candidate. Conceptually: `Diverge → (PABCD per candidate) →
Select → Archive → loop`.

## Lever 1 — P-phase generates a candidate set, not one plan (E7 prose + E2 assist)

- From S1/S2: the unit of work is a *population* of approaches, not one plan.
- Map: redefine the emergent-task P-phase to require **N>=2 distinct approach candidates**
  with explicit behavioral descriptors (e.g. "aggressive rush" vs "economic scaling" vs
  "standing-defense"), each with a falsifiable hypothesis. This is prose (E7) — a skill
  rule the agent follows.
- E2 assist: the Stop hook, when armed on an emergent goal at P with <2 candidates
  recorded in the ledger, can BLOCK termination with "P requires a candidate set" — that
  turns the prose into something the runtime nudges (it cannot author the candidates, only
  refuse to let the loop proceed without them).

## Lever 2 — Evaluator = true objective, recorded per candidate (E2/CLI)

- From S1/S2: only the objective score decides survival; it must be the *real* metric.
- Map: borrow jawcode `autoresearch`'s pattern — a repo-local `evaluate.sh` that emits a
  machine-readable `METRIC name=value` line per candidate, on **fixed seeds**. codexclaw
  records each candidate's metric in the work-phase ledger (operator-entered when the true
  score is a remote judge, since a hook cannot read a remote submission — same honest
  limit as `50_emergence_gap.md`).
- E-tier: the *recording* and the *delta-vs-baseline* gate are E2/CLI-enforceable; the
  fidelity of `evaluate.sh` to the official judge is the operator's responsibility (E7).

## Lever 3 — Diversity archive as files + ledger (E2 data model, no server)

- From S3/S4: keep the best candidate **per behavioral niche**, not one global best — a
  MAP-Elites/QD archive.
- Map (no-server): the archive is a directory of candidate snapshots keyed by behavior
  descriptor + a ledger row `{descriptor, metric, path, kept}`. No daemon; the agent
  writes entries, a CLI (`cxc`-side) validates shape, a hook can read "how many distinct
  niches filled" as a coarse signal.
- This is the QD archive (S4) reduced to what codexclaw can persist honestly.

## Lever 4 — Plateau sensor → forced diversification (E2 Stop directive)

- From S3 (abandon objectives): when the true metric stalls across N work-phases, stop
  optimizing the current lineage and reward novelty instead.
- Map: persist the per-work-phase true-objective metric (Lever 2). The Stop hook compares
  the last N recorded metrics; if no improvement, it injects a **"diversify / step-back /
  re-interview"** directive instead of releasing into another same-basin PABCD cycle. This
  is the single most important runtime addition and the one all three sibling harnesses
  lack.
- E-tier: E2 (Stop can block + inject a directive). It cannot force the *content* of the
  new approach — only refuse "more of the same" and tell the agent to diverge.

## Honest E-tier summary

| Lever | Mechanism | Best enforceable tier | Hard limit |
| ----- | --------- | --------------------- | ---------- |
| 1 candidate set | P needs N>=2 approaches | E7 + E2 nudge | hook can't author candidates |
| 2 true-objective metric | `evaluate.sh` METRIC + ledger | E2/CLI | remote judge → operator-entered |
| 3 diversity archive | files + ledger keyed by descriptor | E2 data model | no server; agent maintains it |
| 4 plateau → diversify | Stop compares metric history | **E2 (key lever)** | can't dictate new approach content |

## What we would borrow vs build

- **Borrow (reference impl):** jawcode `autoresearch` METRIC/baseline/best/keep-discard
  loop (`packages/coding-agent/src/autoresearch/`) — closest existing true-objective
  binding. lazycodex SubagentStop evidence gate — anti-false-completion rail.
- **Build (codexclaw-first):** Levers 1, 3, 4 as a divergence layer. No sibling has a
  population + diversity archive + plateau-diversify trigger; this is the differentiator.
