## 2. Layered Architecture (Default; Allow Serverless Handlers, Vertical Slices, and Small Scripts When Appropriate)

```
Routes → Controllers → Services → Repositories → Database
  │          │             │            │
  │          │             │            └── Data access only
  │          │             └── Business logic (validation at controller boundary — service trusts caller per dev-architecture §4)
  │          └── Parse HTTP, format response
  └── URL mapping, middleware
```

**Rules:**
- Routes: URL patterns + middleware only. No logic.
- Controllers: parse input, call services, format output. No business rules.
- Services: receive/return plain data (not `req`/`res`). All logic here.
- Repositories: abstract DB access. Services access data through repositories only.

### Boundary Parsing Contract (DEFAULT)

**Rule (BACKEND-BOUNDARY-01):** Parse once at ingress/trust boundaries; inside that boundary, typed values are proof. Do not duplicate schema validation, null defense, or defensive parsing in services unless data crosses a new trust boundary. Canonical boundary-defense ownership stays in `dev-architecture` §4; this is the backend stub.

### Repository Pattern (Interface Abstraction)

Use repository interfaces so services depend on abstractions, enabling mocking and swapping implementations.

## 3. Error Handling

| Type           | HTTP | Log Level     |
| -------------- | ---- | ------------- |
| Validation     | 400  | warn          |
| Authentication | 401  | warn          |
| Authorization  | 403  | warn          |
| Not found      | 404  | info          |
| Conflict       | 409  | warn          |
| Rate limit     | 429  | info          |
| Internal error | 500  | error + stack |

Use a centralized `AppError` class (DEFAULT — when the repo already has an error convention, follow it instead). Distinguish operational vs programmer errors.

### Error Taxonomy (AppError Hierarchy)

If the repository chooses AppError, a base class may carry statusCode, code, and
isOperational. Do not introduce a parallel hierarchy into an established Result/error model.

### Result Pattern (conditional)

Consider the Result/Either pattern (e.g. neverthrow) for recoverable domain errors where explicit error handling improves clarity — adopt it only when the project scope justifies it and the repo doesn't already settle error style (HEURISTIC, not a universal requirement).

| Library | When to Use |
|---------|-------------|
| **neverthrow** | Default choice — small explicit `Result<T, E>` for recoverable domain errors |
| **Effect** | Only when the app benefits from a full effect runtime: typed errors, retries, resources, concurrency, tracing |

Use Result only when selected for this repository. Otherwise propagate errors to a
clear handling boundary; do not add wrappers or change public error contracts by preference.

---

## 4. Middleware Execution Order

Apply in this sequence (order matters):

1. Request ID generation
2. Request logging
3. Security headers (CORS, CSP, HSTS)
4. Rate limiting
5. Authentication
6. Authorization
7. Body parsing
8. Input validation (schema)
9. Route handler
10. Error handler
11. Response logging

---

## 5. API Response Contract

API endpoints should use a **stable response envelope** (DEFAULT) unless the protocol (GraphQL, gRPC, SSE) defines its own or the repo already has a different established contract — follow the existing contract first. Envelope, OTel, health checks, and deployment-readiness checks are production-surface concerns (`dev` §0.4 shared definition), conditional by project scope, not universal blockers.

**Rules:**
- `success` boolean at top level — never infer from HTTP status alone
- `error.code` is machine-readable (UPPER_SNAKE), `error.message` is human-readable
- `meta.requestId` on every response — enables cross-service tracing
- Pagination uses cursor-based (`after`/`before`) for large datasets, offset-based (`page`/`pageSize`) for admin UIs
- Nullability: prefer consistent key presence; omit when sparse payloads are intentional
- Timestamps: ISO 8601 UTC (`2024-01-15T09:30:00Z`), never Unix epoch in JSON
- Money: integer cents + currency code, never floating point

See `../../references/core/api-design.md` for protocol-specific patterns (REST, GraphQL, gRPC, tRPC).

---
