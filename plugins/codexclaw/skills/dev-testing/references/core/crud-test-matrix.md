# CRUD Test Matrix — Risk-Tier Verification

On-demand reference. Verification intensity scales with the work class (dev §0.0) and
risk, not with ceremony. Evidence rows apply only when their strict trigger applies; for
low-risk local work use the smallest proof that validates the claim and state the scope.

## By work class

| Class | Minimum verification | Notes |
|-------|----------------------|-------|
| C0 | Smallest proof (build/typecheck or visual read) | No test required for zero-behavior changes |
| C1 | Targeted check of the changed behavior | One focused test or manual proof |
| C2 | Focused integration/contract test + UI smoke if UI changed + targeted build/typecheck | Unit-test only where logic lives |
| C3 | Affected suite + docs consistency when docs/contracts changed | Independent verification when public contracts moved |
| C4 | Full relevant gates + negative tests + durable evidence record | Security/data/release per their references |
| C5 | — | Research first; verification follows reclassification |

## By CRUD operation (C2 slice)

| Op | Happy path | Required negative |
|----|------------|-------------------|
| List | Returns expected shape/order | Empty result renders/serializes correctly |
| Detail | Found entity | 404 + permission-denied mapping |
| Create | Entity persisted, response shape | Validation reject (bad payload) |
| Update | Change persisted | Permission-denied or stale/missing id |
| Delete | Removal observable | Unauthorized delete blocked |

One happy + one negative per **changed** operation is the C2 default — not the full grid
for every touch.

## UI verification (risk-tier rule)

Manual click-through or one Playwright run is required when UI risk is real
(states/flows changed) — it is **not** a universal blocker for CSS-only or copy-only
changes, which pass with source inspection + targeted build (C0/C1).

## ESCALATE rows (always strict when triggered)

- Auth/permission behavior → negative tests for denied paths (C4).
- Migration/backfill on production or non-trivial data → dry run + idempotency +
  rollback/reconciliation evidence; local/dev-only schema fixtures may use targeted
  apply/revert instead.
- Release surface → build/package/install proof matching the release path (`release_cd`).
