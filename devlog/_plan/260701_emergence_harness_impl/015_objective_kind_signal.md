# 015 — Objective-Kind Signal (satisfy vs maximize)

Status: PLANNED (no code yet) · 2026-07-01 · emergence_harness_impl WP 015 · class C3 (state/runtime)

> Design source: `../260701_emergence_harness/006` (satisfy vs maximize). A-phase audit finding #1:
> this signal MUST precede decade 020 — the Stop lever and decade 030's doctrine both gate on
> "maximize-metric goal", so the discriminator has to exist first.

## Why

`goal-active.ts:29` only exposes `GoalActiveStatus = "active" | "inactive" | "unreadable"` — there
is no satisfy/maximize discriminator. But the whole divergence layer depends on it: a satisfy-spec
goal (pass/fail, locally checkable) should converge EARLY at P and pay zero divergence overhead; a
maximize-metric goal (continuous score, local != true objective, deceptive) is the only kind that
should ever arm the late-collapse race. Without this tag, decade 020 cannot tell which goals to
gate, so ordinary build work would wrongly inherit divergence cost.

## Ground Truth (read before edit)

- `goal-active.ts:29` `GoalActiveStatus` enum + `:13-18` status mapping (read-only goal detection).
- `goal-active.ts:16-18`: only `active` counts; `inactive`/`unreadable` semantics already fixed.
- The hook layer reads goal status read-only; this decade adds a parallel read-only objective-kind,
  with NO new write path to the native goal DB (Q-GM-1-f: codexclaw does not own a goal marker).
- Decade 010 metric substrate: presence of a recorded metric / `evaluate.sh` is the inference signal.

## Design (diff-level)

1. 015.1 — define the objective-kind signal `"satisfy" | "maximize"`. Two sources (resolve in P):
   - explicit: a project-local tag in `.codexclaw/` (e.g. `objective_kind` set by a `cxc` verb or
     the goalplan skill), OR
   - inferred: `maximize` when a decade-010 metric or an `evaluate.sh` exists, else `satisfy`.
   `satisfy` is the DEFAULT so ordinary build work pays zero divergence overhead.
2. 015.2 — surface it to the hook layer read-only, alongside goal status, so decade 020 can gate
   on it without writing the native goal DB.
3. 015.3 — the discriminator is project-local state only; never derived from the goal-DB row.

## Invariants

- `satisfy` is the safe default when unsignalled (no divergence overhead by accident).
- Read-only at the hook layer; no native goal-DB write.
- Project-local under `.codexclaw/`.

## Acceptance

| Check | Evidence |
|-------|----------|
| Classifies satisfy vs maximize | explicit tag or metric/evaluate.sh presence resolves the kind |
| Default is satisfy | no signal -> `satisfy` |
| Hook-readable | the Stop hook can read objective-kind without a goal-DB write |
| No goal-DB write | no mutation of `goals_1.sqlite` |

## Verification

- `node --test` on objective-kind classification: explicit tag, inferred-from-metric, default.
- `npm run build` ; `npm test` ; `npm run gate` ; `git diff --check`.

## PABCD plan (one full cycle, FUTURE loop)

- P: explicit tag vs inferred-from-`evaluate.sh` — pick the default source.
- A: gpt-5.4 explorer — is `satisfy` truly the default? any path where build work accidentally
  arms maximize? any goal-DB write sneaking in?
- B: implement the signal + hook-layer read.
- C: build + unit + gate.
- D: close, commit `feat(emergence-015): objective-kind signal`, `goal update`.

## Open Q

Explicit tag vs inferred-from-`evaluate.sh` — which is the default source of truth?

## Depends on / feeds

No prereqs (can land beside 010). Feeds 020 (gates the Stop lever to maximize goals only), 030
(early-vs-late collapse keys on this), 045 (only maximize goals need harness-first), 060.
