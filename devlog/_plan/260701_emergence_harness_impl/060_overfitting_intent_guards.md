# 060 — Overfitting Guard + Intent-Question Gating

Status: PLANNED (no code yet) · 2026-07-01 · emergence_harness_impl WP 060 · class C2 (skill doctrine) · E7

> Design source: `../260701_emergence_harness/006` (layered selection), `007` (user-question
> gating), `50_emergence_gap.md` (the 96%-local / 3.5-official gap). Objective-kind moved to 015,
> harness-first to 045; what remains here are the two doctrine guards.

## Why

Even with the metric loop in place, two failure modes stay unowned. First, the agent can overfit
a LOCAL proxy — exactly the 96%-local / 3.5-official trap — and mistake a rising local number for
progress. Second, the agent can over-ask the user, turning every divergence into a menu when the
intent was already clear. Both need explicit doctrine triggers, not vibes.

## Ground Truth (read before edit)

- `50_emergence_gap.md` — the 96%-local / 3.5-official gap is the canonical overfitting example.
- `007` — user-question gating: ask only on open intent; silent strong-1+add-1 on clear intent.
- Decade 015 objective-kind + decade 010 metric (local vs true/holdout deltas).
- `cxc-loop` / `dev` §0 (where the guards live as doctrine).

## Design (diff-level)

1. 060.1 — overfitting guard wording: a LOCAL metric diverging from the TRUE/holdout metric is a
   stop-and-rethink signal, NOT a "keep" — the exact 96%-local / 3.5-official trap. Encode it so a
   rising local number with a flat/falling true number arms re-think, not celebration.
2. 060.2 — intent-question gating: I asks the user to choose among approaches ONLY when intent is
   OPEN; with clear intent it records strong-1 + add-1 and converges silently (`007`). Encode the
   concrete trigger that flips silent-converge <-> ask.

## Invariants

- local != true divergence is a STOP signal, never a keep.
- The user is asked only on open intent; clear intent -> silent converge.
- Doctrine only (E7); no new runtime lever (the lever is 020).

## Acceptance

| Check | Evidence |
|-------|----------|
| Overfitting guard | doctrine treats local!=true divergence as stop-and-rethink |
| Intent gating | user question fires only on open intent; clear -> silent |
| Trigger defined | the silent<->ask flip has a concrete stated signal |
| No over-claim | labelled E7 doctrine, no phantom E2 |

## Verification

- doc-sync: `cxc-loop`/`dev` carry both guards; drift check green.
- `npm run build` ; `npm test` ; `npm run gate` ; `git diff --check`.

## PABCD plan (one full cycle, FUTURE loop)

- P: lock the concrete signal that flips silent-converge <-> ask.
- A: gpt-5.4 explorer — is "local!=true = stop" unambiguous? can the agent still over-ask under
  clear intent? is anything mislabelled as a runtime lever?
- B: write both guards into doctrine.
- C: build + doc-sync + gate.
- D: close, commit `feat(emergence-060): overfitting guard + intent-question gating`, `goal update`.

## Open Q

What concrete signal flips "converge silently" -> "ask the user"? (e.g. ambiguity score,
missing success criterion, conflicting constraints.)

## Depends on / feeds

Depends on 015 (objective-kind) + 030 (divergence doctrine). Feeds 070 (the falsifiability rule
formalizes the local-vs-holdout split this guard relies on).
