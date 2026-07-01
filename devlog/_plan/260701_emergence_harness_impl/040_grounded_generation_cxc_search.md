# 040 — N>=2 Grounded Generation via cxc-search

Status: DONE (shipped + tested) · 2026-07-01 · emergence_harness_impl WP 040 · class C2 (skill doctrine) · E7

> Design source: `../260701_emergence_harness/007` (cxc-search grounding rule). Skill reference:
> `plugins/codexclaw/skills/search/SKILL.md` (Tier 1 discover, Tier 2 prove ladder).

## Why

N candidates invented from memory collapse to variations of the first idea — the anti-anchoring
rule is empty without grounding. The `cxc-search` ladder is the antidote: Tier 1 discovers
candidate approaches (URLs), Tier 2 proves them (open the source, cite real numbers). Per `007`,
memory speculation is forbidden — a divergence candidate must trace to a grounded source, not a
half-remembered idea. This makes the N>=2 in decade 030 real diversity instead of rephrasing.

## Ground Truth (read before edit)

- `cxc-search` skill: `plugins/codexclaw/skills/search/SKILL.md` — Tier 1 (discover) / Tier 2
  (prove) / Tier 3 (ultraresearch) ladder; Korean-source guard; source-proof invariant.
- `cxc-loop` doctrine (extended in 030) + `dev` §0 cross-ref (the grounding habit).
- Candidate archive shape from decade 030 (where provenance is recorded).

## Design (diff-level)

1. 040.1 — doctrine in `cxc-loop` (+ `dev` §0 cross-ref): when any PABCD workflow diverges
   (HITL manual entry or goal-mode plateau prompt), ground EACH candidate via `cxc-search` —
   Tier 1 discover, Tier 2 prove. The user-facing N>=2 question is conditional on OPEN intent;
   with clear intent, record strong-1 (grounded deep, Tier 2+) + add-1 (at least Tier 1) and
   converge silently. No candidate may be invented from memory.
2. 040.2 — record the grounding source URLs alongside each recorded candidate in the archive
   (provenance, not memory). Tier 1 result = candidate URL; cite concrete numbers only after Tier 2.
   Shipped archive enforces non-empty source URLs; Tier 1/2 proof remains E7 doctrine and phase
   evidence, not machine-certified by the archive.

## Invariants

- No memory-invented candidates: every candidate carries a grounding source.
- strong-1 proven to Tier 2+; add-1 grounded to at least Tier 1.
- The user question fires only on open intent (silent converge when intent is clear); HITL
  divergence still does not force a fake menu question.

## Acceptance

| Check | Evidence |
|-------|----------|
| Grounding required | doctrine forbids memory-only candidates |
| Provenance recorded | each archived candidate carries source URLs |
| Tier discipline | strong-1 Tier 2+, add-1 Tier 1+; numbers cited only post-Tier-2 |
| Conditional question | N>=2 user question only on open intent |

## Verification

- doc-sync check: `cxc-loop`/`dev` text references `cxc-search` tiers; archive schema carries a
  provenance field. `npm run build` ; `npm test` ; `npm run gate` ; `git diff --check`.

## PABCD plan (one full cycle, FUTURE loop)

- P: lock the strong-1/add-1 grounding-depth contract + the provenance field.
- A: gpt-5.4 explorer — can a candidate still be invented from memory and pass? is the user
  question correctly conditional on open intent? is the Tier-2-before-numbers rule explicit?
- B: write the doctrine + provenance field.
- C: build + doc-sync + gate.
- D: close, commit `feat(emergence-040): cxc-search-grounded N>=2 generation`, `goal update`.

## Closed decision

Tier 3 ultraresearch is opt-in, matching the search skill ladder. The archive enforces source URLs
only; it does not certify search tier.

## Depends on / feeds

Depends on 030 (the doctrine + archive this extends). Feeds 050 (the candidates it grounds are
what the worktree fan-out builds), 060 (intent-question gating shares the open-vs-clear trigger).
