## 2. Backend & API Testing
> Deep reference: `backend-testing.md`
### 2.1 Coverage Map
| Layer | Verify | TypeScript Default | Python Default |
|-------|--------|-------------------|----------------|
| Service layer | validation, orchestration, domain errors | Vitest | pytest |
| API layer | status, envelope, middleware, auth | Supertest | httpx / ASGITransport |
| Repository layer | SQL / ORM correctness | Testcontainers + real DB | Testcontainers + real DB |
| Background jobs | idempotency, retry, dead-letter | Vitest + fake clock | pytest + monkeypatch |
### 2.2 Mock Strategy Hierarchy
```text
real deterministic dependency
→ Testcontainers / ephemeral infra
→ recorded responses / thin fake
→ manual stub / fake
→ framework mock as last resort
```
### 2.3 Service & API Patterns
Mock dependencies at service boundaries. Use Supertest/httpx for route-level integration tests. Match response envelope shape from backend contracts.
### 2.4 Database Truth with Testcontainers
Use a **real database** when verifying migrations, transactions, unique constraints, foreign keys, query translation, and performance-sensitive SQL. Use Testcontainers for real DB truth in correctness-sensitive persistence tests. Start container in beforeAll/fixture setup, capture connection URI.
### 2.5 Fixture / Seed Synchronization
- Prefer builders / factories over copied JSON snapshots.
- Keep shared contract examples in `fixtures/contracts/` or equivalent.
- Seed data should expose **stable IDs** used by Playwright smoke flows.
- If frontend mocks drift from backend fixtures, write or update a **contract test first**.
---
## 3. Contract Testing
Contract tests protect the **frontend↔backend boundary**. They sit between API tests and browser tests.
**Rule**: Playwright proves the experience. Contract tests prove the shared shape.
### 3.1 Contract-Stable Surface
- response envelope: `success`, `data`, `error`, `meta`
- error taxonomy: HTTP status + machine-readable `error.code`
- pagination fields, auth headers, cookie behavior
- `requestId` propagation
- nullability, timestamps, enums, money serialization
### 3.2 Contract Options
| Style | Best For | Tooling |
|-------|----------|---------|
| consumer-driven contract | rapidly changing frontend/backend teams | Pact |
| schema-first contract | OpenAPI-led backends | OpenAPI validators, Schemathesis |
| type-level contract | TS monorepos | shared types / codegen |
| full-stack smoke | final user confidence | Playwright |
### 3.3 Consumer Contract — TypeScript (Pact / PactV4)
`PactV4` (aliased `Pact`) is the current interface (Pact Specification v4); treat `PactV3` as the legacy spec-v3 API. Workflow:
1. Define interaction: provider state + request + expected response (use `MatchersV3` for flexible matching)
2. Execute test against Pact mock server
3. Assert consumer expectations
4. Pact file auto-writes to `pacts/` → publish to broker → provider verifies

See `backend-testing.md` for a full example.
### 3.4 Schema Verification
Use schema-based API testing (Schemathesis) to verify OpenAPI/GraphQL contract compliance. (Dredd is legacy/inactive — do not adopt for new projects.)
### 3.5 Rules
- Contract tests are **strongly recommended** for parallel FE/BE, public APIs, and cross-team contracts.
- E2E success does **not** replace provider verification.
- Store golden examples near the contract, not inside one app only.
- If the shape is intentionally breaking, update the contract first, then all consumers.
