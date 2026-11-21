# CRUD UI Basics — Ordinary Screen Slice

On-demand reference for C2 list/detail/form screens. These are product surfaces, not
marketing pages — objective UX states matter; visual styling follows the repo's existing
system (style presets are STYLE_SAMPLE, never requirements).

## State coverage (DEFAULT — the actual quality bar)

Every data-driven view handles all of:

| State | List view | Form/mutation |
|-------|-----------|---------------|
| Loading | Skeleton/spinner consistent with repo pattern | Disabled submit + pending indicator |
| Empty | Honest empty state with the next action | — |
| Error | Retryable error with message | Field-level + form-level errors, input preserved |
| Permission-denied | Hidden or explained, per product convention | Action disabled with reason |
| Success | Data rendered, stable ordering | Confirmation + navigation/refresh per repo pattern |

Missing states are review findings; pixel styling differences are not.

## List + detail

- Reuse the repo's existing table/list component and data-fetch pattern (query lib, store,
  fetch wrapper) — do not introduce a new data layer for one screen.
- Pagination/sort/filter UI only when the API provides it and the product needs it.
- Detail view: deep-linkable when routing exists; 404/permission states handled.

## Forms + mutations

Form `<select>` and picker controls participate in the project dropdown design
layer (`dropdown-layer.md` FE-DROPDOWN-LAYER-01): one unified skin over
behavior-correct primitives, with labels, errors, autofill, and keyboard
operability fully preserved.

- Validation mirrors the API schema; client-side checks are UX sugar, the server stays the
  source of truth.
- Submit: prevent double-fire, show pending, surface server errors back into the form.
- Destructive actions (delete) get an explicit confirm step; irreversible-data deletes are
  an ESCALATE product decision, not a UI default.
- Optimistic updates only where the repo already does them.

## Objective UX gates (STRICT/DEFAULT — separate from taste)

- Keyboard: form fully operable by keyboard; visible focus states.
- Labels: every input has an accessible label; errors are announced/associated.
- Contrast meets the repo's accessibility baseline.

## Verification (C2 default)

- UI smoke for the changed screen (manual click-through or one Playwright run when UI risk
  is real — risk-tier rule, not a universal blocker).
- One negative check: a failing submit shows errors without losing input.
- See `dev-testing/references/core/crud-test-matrix.md`.
