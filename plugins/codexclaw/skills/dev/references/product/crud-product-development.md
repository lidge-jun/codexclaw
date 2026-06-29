# Ordinary Product Development — Feature-Slice Recipe

Most app work is a small product slice: a route, a screen, a form, validation, permissions,
a migration, a metric, an integration touchpoint, or an incident fix. CRUD is the most
compact representative benchmark of this — **one benchmark, not the default center**.
This reference is on-demand: read it for C2 ordinary-product work, not for every task.

## 1. Classify and scope (dev §0.0)

- Typical slice = **C2**. C4-promotion triggers (DEV-ESCALATE-01: auth, payments, deletion,
  migration, public contract, permissions) promote the relevant part to C4 — split it out
  rather than inflating the whole slice.
- If behavior, target user, or success measure is ambiguous → `product_discovery` overlay:
  capture the behavior/user-value/metric decision first. Do NOT ask discovery questions
  for obvious implementation.

## 2. Slice plan (compact, response-level)

State in a few lines before coding:
1. The user-visible behavior the slice delivers (one sentence).
2. Touched layers: route/endpoint → service/model → storage → UI states.
3. Conventions to reuse — find the nearest existing slice (dev §0.5/§1.5) and mirror its
   naming, foldering, validation, and error mapping. Existing Repo First is STRICT.
4. The verification that will prove it works (smallest honest proof).

## 3. Build order (vertical, thin)

Work end-to-end thin rather than layer-complete:
1. **Contract** — route/schema/types for the happy path.
2. **Data** — model/query/migration stub (migration itself: see `migration_backfill`
   strict triggers in dev §0.3 before touching real data).
3. **Behavior** — service logic; validation at the controller/trust boundary
   (dev-architecture §4 — services trust their callers).
4. **Surface** — UI states: list/detail/form + loading/empty/error/permission-denied.
5. **Proof** — focused test or manual check per §4 below.

Per-layer specifics: `dev-backend/references/core/crud-api.md`,
`dev-frontend/references/core/crud-ui.md`.

## 4. Verification (risk-tier, see dev-testing crud-test-matrix)

- C2 default: one focused integration/contract test + UI smoke if UI changed +
  targeted build/typecheck. Unit-test only what holds logic.
- Permission paths and error mapping get at least one negative check.
- Release/production surface involved → escalate per `release_cd`/`observability` triggers.

## 5. Anti-over-engineering guards (HEURISTIC)

- No new abstraction until the second concrete usage exists.
- No speculative configuration, feature flags, or extension points for the slice.
- No new architecture pattern (DDD/hexagonal/etc.) without real boundary pressure (C3+).
- Pagination/filtering/caching only when the data shape or product actually needs them.
