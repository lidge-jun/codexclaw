# 070 — Docs + Visual Sync + Falsifiability

Status: PLANNED (no code yet) · 2026-07-01 · emergence_harness_impl WP 070 · class C2 (docs + test gate) · E8 (drift gate)

> Design source: all of `../260701_emergence_harness/`; `003` (falsifiability). This is the closing
> decade: reconcile the layered model into one SOT, keep the HTML in sync, and lock the honest
> validation rule so the divergence layer is provable, not asserted.

## Why

The model now spans 000-007 + `emergence_gap.html` across several layers (`006` mode-axis, `007`
collapse-axis). Two axes describing one mechanism invites drift. And without a falsifiability rule,
"the divergence layer works" is an unfalsifiable claim — exactly the epistemic failure the whole
track exists to fix. This decade reconciles the SOT and fixes how the layer is validated.

## Ground Truth (read before edit)

- `006` (plateau mode-axis) + `007` (collapse-point axis) — the two layers to reconcile.
- `emergence_gap.html` sections 07-10 — the visual to keep in sync.
- `50_emergence_gap.md:52` — the train/validation/holdout split discipline.
- Decade 045 harness + decade 050 race — what the ablation is run against.

## Design (diff-level)

1. 070.1 — fold `006` (plateau mode) + `007` (collapse point) into ONE reconciled section; keep
   `emergence_gap.html` (sections 07-10) in sync with the reconciled text.
2. 070.2 — falsifiability rule recorded: validate the divergence layer by OLD-vs-NEW ablation on a
   PREDEFINED seed/fold set (train/validation/holdout split per `50_emergence_gap.md:52`),
   comparing baseline vs new on IDENTICAL seeds, judged by median + worst-10% + variance (NOT mean)
   against a noise/effect-size threshold. A single fixed-seed fixture can itself become the overfit
   target, so the holdout fold must stay UNTOUCHED during tuning. Official NYPC re-submission is
   EXTERNAL smoke, never causal proof.
3. 070.3 — optional E8 drift gate: a test asserting skill text ↔ shipped Stop behavior ↔ this plan
   stay consistent (catches the doctrine-vs-runtime drift the diagnosis warns about).

## Invariants

- One reconciled SOT; the HTML never contradicts the markdown.
- Holdout fold untouched during tuning (else the fixture becomes the overfit target).
- median + worst-10% + variance, not mean (mean hides the deceptive-proxy tail).
- Remote NYPC score = external smoke, never causal proof of the layer.

## Acceptance

| Check | Evidence |
|-------|----------|
| Single SOT | 006+007 folded into one reconciled section |
| HTML in sync | sections 07-10 match the reconciled text |
| Falsifiability fixed | train/val/holdout + median/worst-10%/variance rule recorded |
| Drift gate (opt) | a test asserts skill ↔ runtime ↔ plan consistency |

## Verification

- HTML tag-balance check + `git diff --cached --check` (whitespace) after any HTML edit.
- the optional drift test runs green. `npm run build` ; `npm test` ; `npm run gate`.

## PABCD plan (one full cycle, FUTURE loop)

- P: decide whether the E8 drift gate ships now or stays optional; lock the reconciled section shape.
- A: gpt-5.4 explorer — does the reconciled SOT drop any nuance from 006/007? is the holdout-untouched
  rule explicit? does the metric judge use median/worst-10% (not mean)?
- B: fold the docs + sync HTML + (optional) drift test.
- C: build + drift/doc-sync + gate; HTML tag-balance.
- D: close, commit `docs(emergence-070): reconcile SOT + falsifiability rule`, `goal update`.

## Depends on / feeds

Depends on ALL prior decades (it reconciles them). Feeds nothing in-track — this closes the loop;
the next cycle is the first IMPLEMENTATION loop, starting at decade 010.
