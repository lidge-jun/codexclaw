---
name: cxc-dev-backend
description: "MUST USE for backend, API, server, or database work — API design, architecture, database optimization, security hardening, error handling, middleware, observability, queues, and long-lived connections. Triggers: 'backend', 'API', 'REST', 'GraphQL', 'schema', 'migration', 'query optimization', 'middleware', 'OTel', 'caching', 'Result pattern', 'server', '백엔드', 'API 작업', '마이그레이션', '쿼리 최적화'."
metadata:
  last-verified: "2026-07-02"
  short-description: "Framework-agnostic backend guidance for APIs, architecture, data access, and operations."
  keywords: ["API", "REST", "endpoint", "middleware", "database", "ORM", "cache", "queue", "error handling"]
---

# Dev-Backend — Production-Grade Backend Engineering

> **Ownership boundary:** This skill owns API design, app architecture, database optimization,
> error handling, middleware, queues, long-lived connections, and app-level observability/health
> hooks. Deployment strategy, rollback proof, rollout shape, SLOs, alert routing, incident
> response, and operational readiness gates are owned by `dev-devops`. Backend exposes the
> app-level hooks that DevOps operational gates consume.


Build reliable, secure, and maintainable server-side applications.
This skill is a routing role that activates by **change-surface**: whenever the work primarily touches APIs, servers, services, jobs, data access, schemas, migrations, or operational backend behavior, use this skill and then read the relevant references.

> **C0/C1 work (small local patches):** See `dev` §0.0 Work Classifier + §0.1 Patch Fast-Path before reading references.

## Modular References

| File                                   | When to Read                   | What It Covers                                                         |
| -------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `references/core/crud-api.md`          | C2 ordinary CRUD/resource endpoints | Route/schema/service/query basics, five operations, error+permission mapping |
| `references/core/api-design.md`        | New/changed API style, or C3+ API work (C2 ordinary slice: `crud-api.md` alone suffices) | REST conventions, response envelopes, HTTP status, pagination, GraphQL, gRPC, tRPC |
| `references/core/api-lifecycle.md`     | API versioning, deprecation, migration | Versioning strategy, RFC 9745/8594 lifecycle, breaking-change gates |
| `references/core/architecture.md`      | New features at C3+ (C2 ordinary slice: `crud-api.md` alone suffices) | Layered architecture, DDD, SOLID, when to split, monolith vs micro |
| `references/core/anti-slop-backend.md` | New endpoints, classes, or modules | Banned patterns: god classes, raw SQL in services, magic numbers, etc. |
| `references/core/observability.md`     | Production deployments         | OpenTelemetry, structured logging, distributed tracing, alerting       |
| `references/core/health-checks.md`     | Production/long-lived services | Liveness, readiness, startup probes, dependency checks                 |
| `references/core/process-isolation.md` | CPU-bound or untrusted work    | worker_threads vs child_process vs separate service, communication, resource limits |
| `references/core/caching.md`           | Performance optimization       | Redis patterns, CDN, connection pooling, cache invalidation            |
| `references/stacks/node.md`            | Node.js/TypeScript projects    | Express/Fastify, middleware, Zod validation, ESM, error handling       |
| `references/stacks/python.md`          | Python projects                | FastAPI/Django, Pydantic, async patterns, testing                      |
| `references/stacks/database.md`        | Database design/optimization   | PostgreSQL, MongoDB, indexing, N+1, migrations, ORM comparison         |
| `references/core/ml-serving.md`        | ML model deployment, GPU inference | vLLM/SGLang runtime selection, FastAPI+GPU patterns, dynamic batching, quantization |
| `references/core/llm-integration.md`   | RAG, LLM API integration, prompt engineering | Chunking, hybrid search, vector DB, structured output, LangChain/LlamaIndex 2026 |
| `references/core/mobile-api.md`        | Mobile app API patterns        | BFF, push notifications, offline sync, mobile auth, API optimization   |

Read `api-design.md` + `anti-slop-backend.md` first, then the relevant stack file.
For C2 ordinary slices, `crud-api.md` alone suffices; read `api-design.md`/`architecture.md` for new API styles or C3+ work.

When backend decisions depend on current external API docs, API lifecycle
changes, LLM/RAG provider behavior, dependency freshness, or package/source
evidence, read the active `search` skill and follow its query-rewrite,
source-fetch, and evidence-status rules.

---
## 0. Stack Detection & Architecture Clarification

### Auto-detect (existing projects)

| File Found                          | Project Type      |
| ----------------------------------- | ----------------- |
| `tsconfig.json`                     | TypeScript (Node) |
| `package.json` (no ts)              | JavaScript (Node) |
| `pyproject.toml`/`requirements.txt` | Python            |
| `go.mod`                            | Go                |
| `Cargo.toml`                        | Rust              |

If config files exist → detect silently and proceed.

### Architecture Clarification (new or ambiguous projects)

When the request has **unspecified technology or unclear scope**, clarify before coding:

1. **Identify what's ambiguous** from this list:

| Dimension    | Options to present                                                                  |
| ------------ | ----------------------------------------------------------------------------------- |
| API style    | REST (default) · GraphQL (BFF/mobile) · gRPC (internal microservices) · tRPC (TS monorepo) |
| Database     | PostgreSQL (default, ACID) · MongoDB (flexible schema) · SQLite (embedded)          |
| Auth method  | JWT + refresh (stateless) · Session-based (simple) · OAuth 2.1 (3rd party)          |
| Realtime     | Not needed (default) · WebSocket · SSE · Polling                                    |
| Architecture | Monolith (default) · Modular monolith · Microservices                               |

2. **Recommend one with reasoning**: cite project context. e.g., "Small team → monolith + PostgreSQL + JWT is the simplest starting point."
3. **Over-engineering guard**: A CRUD API *probably* doesn't need GraphQL + microservices + event sourcing. Simple → complex, not the reverse.
4. **One round limit**: 2-3 options → recommend → confirm → proceed.

If the user already specifies clear tech (e.g. "FastAPI로 REST API 만들어줘"), **skip this entirely**.

**Node/framework defaults (verified 2026-07-02):** production uses Active/Maintenance LTS — Node 24 (Active) for new services. Framework: Fastify for greenfield Node APIs; Express 5 for legacy/ecosystem compatibility; Hono for edge/serverless/multi-runtime Web-Standards APIs. New TS validation baseline: Zod v4 (read the migration guide before upgrading v3 projects).

For new Node backend source files, prefer `.ts` when the repo supports TypeScript or is greenfield. Inherit `dev` TypeScript strict-compatibility rules.
If backend boundaries are unclear, read existing source-of-truth docs/logs first, then document routes, services, repositories, data stores, and runtime commands in the repo's existing SOT before broad implementation.

---

## 1. Architecture Decision

Before coding, identify the right pattern:

| Team Size | Default Starting Point  |
| --------- | ----------------------- |
| 1-3 devs  | Modular monolith        |
| 4-10 devs | Modular monolith or SOA |
| 10+ devs  | Consider microservices  |

**Default to monolith.** Extract only when you have a proven need (different scaling, independent deployment, technology mismatch).

See `references/core/architecture.md` for full decision matrices.

### API Protocol Decision

| Protocol | Choose When | Avoid When |
|----------|-------------|------------|
| **REST** | Public/partner APIs, simple CRUD, caching matters | Clients need flexible data shapes |
| **GraphQL** | Mobile/BFF, multiple resources per request, bandwidth-constrained | Simple CRUD, server-to-server, file uploads |
| **gRPC** | Internal microservices, high-perf binary, bidirectional streaming | Browser clients (without gRPC-Web), public APIs |
| **tRPC** | TypeScript monorepo, internal tools, rapid prototyping | Polyglot environments, public APIs |

**Hybrid pattern (verified 2026-07-02 — OpenAPI 3.1+, prefer 3.2 where tooling supports; tRPC v11; Apollo Federation ONLY for multi-subgraph supergraphs):**
```
Public/Partner → REST (OpenAPI 3.1)
Mobile/Web BFF → GraphQL (Apollo Federation)
Internal services → gRPC (Protobuf contracts)
TS internal tools → tRPC (zero-codegen type safety)
```

See `references/core/api-design.md` for protocol-specific patterns.

### Long-Lived Connection Operation

Rules for SSE, WebSocket, and any connection held open beyond a single request-response cycle.

**Lifecycle Rules:**

| Parameter | Default | Rationale |
|-----------|---------|-----------|
| Heartbeat interval | 15-30s | Detect dead connections before TCP timeout (varies by proxy) |
| Reconnection backoff | Exponential 1s-30s with jitter | Prevent thundering herd on server restart |
| Max connection duration | 1h (SSE), 24h (WebSocket) | Force reconnect to rebalance and prevent memory leaks |
| Connections per client | Cap at 6 (SSE) or 1-2 (WebSocket) | Browser limits + server memory budget |

**Server-Side Requirements:**

- **Connection registry:** Track all active connections in-memory (Map by client/session ID). Required for graceful drain and debugging.
- **Graceful drain on deploy:** Stop accepting new connections → send "reconnect" frame to existing → wait drain timeout → close.
- **Memory budget:** Allocate max memory per connection (e.g., 2KB buffer). Monitor total; reject new connections when approaching limit.
- **Backpressure:** If client stops consuming, buffer up to N messages then drop oldest or disconnect.

**Pattern — "202 + Job ID" for Long Operations:**

Instead of holding a connection open for a slow operation:
```
POST /generate → 202 { jobId: "j_abc123" }
GET /jobs/j_abc123 → { status: "processing", progress: 0.6 }
                   → { status: "complete", result: {...} }
```
Use SSE/WebSocket only for push notifications about job status — not for the operation itself.

**Banned:**

| Banned | Fix |
|--------|-----|
| Unbounded connections (no cap, no registry) | Connection registry + cap per client + global max |
| No heartbeat (rely on TCP keepalive only) | Application-level heartbeat every 15-30s |
| Blocking event loop per connection (sync work in message handler) | Offload to worker thread or queue; handler stays async |
| Holding connection open for >5s synchronous work | Return 202 + job ID; notify via push when done |
| No reconnection logic on client side | Implement exponential backoff with jitter |

### Server Runtime Safety (DEFAULT)

**Rule (BACKEND-RUNTIME-01):** Production server runtimes set explicit read, write, request/idle, and graceful-shutdown timeouts; drain on SIGTERM/deploy by stopping new accepts, letting in-flight work finish within the shutdown budget, then closing; and propagate the request ID from ingress into structured logs, traces, queued work, and outbound calls where the stack supports it.

---

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

### Async Task Queue Patterns

When work exceeds what an HTTP response cycle should hold open, use a queue.

**Decision: Queue vs Direct:**

| Condition | Use Queue | Use Direct |
|-----------|-----------|------------|
| Execution time >5s | Yes | No |
| Must be retryable on failure | Yes | No |
| Fire-and-forget (caller doesn't wait) | Yes | No |
| <1s, idempotent, caller needs immediate result | No | Yes |
| Real-time user-facing validation | No | Yes |

**Pattern — Accept, Queue, Notify:**

```
1. Client  → POST /tasks       → Server validates, enqueues
2. Server  → 202 { jobId }     → Client receives immediately
3. Worker  → picks from queue  → executes task
4. Client  → GET /tasks/{id}   → polls status (or receives webhook/SSE push)
5. Worker  → completes         → writes result, triggers notification
```

**Queue Selection Guide:**

| Queue | When | Notes |
|-------|------|-------|
| **BullMQ** (Redis) | Node.js, need retries + priorities + rate limiting | Most mature Node queue; requires Redis |
| **Celery** (Redis/RabbitMQ) | Python, distributed workers, periodic tasks | De facto Python standard |
| **pg-boss** (PostgreSQL) | Node.js, already have Postgres, moderate scale | No extra infra; SKIP_LOCKED-based |
| **Simple DB queue** (polling) | Small scale (<100 jobs/min), any language | `status` column + `SELECT FOR UPDATE SKIP LOCKED` |
| **SQS / Cloud Tasks** | Serverless, managed, very high scale | No infra to manage; at-least-once delivery |
| **Temporal** | Durable multi-step workflows: sagas, human-in-loop, long-running AI/business processes | Workflow engine, NOT a default queue replacement |

**Required Safeguards:**

| Safeguard | Rule |
|-----------|------|
| Idempotency key | Every enqueue call must include a unique idempotency key; dedup on insert |
| Dead letter queue (DLQ) | Failed 3x (configurable) → move to DLQ → alert → manual review |
| Max retries | Set explicit limit (default: 3); exponential backoff between attempts |
| Timeout per job | Every job has a max execution time; kill and retry on exceed |
| Visibility timeout | Lock duration > expected execution time; prevent duplicate processing |
| Observability | Emit metrics: queue depth, processing time p95, DLQ size, failure rate |

**Banned:**

| Banned | Fix |
|--------|-----|
| Synchronous long operation blocking HTTP response (>5s) | Enqueue + return 202 + job ID |
| Queue without DLQ | Always configure DLQ; alert on DLQ depth > 0 |
| Infinite retries (no max) | Set maxRetries=3 with exponential backoff |
| No idempotency (duplicate jobs on retry) | Idempotency key on every enqueue; dedup in worker |
| No timeout on job execution | Set per-job timeout; kill + mark failed on exceed |
| Polling without backoff (tight loop) | Poll with interval (1-5s) or use blocking pop / push notification |

---

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

Create an AppError base class with statusCode, code, and isOperational properties. Extend for each error type (ValidationError, NotFoundError, etc.).

### Result Pattern (conditional)

Consider the Result/Either pattern (e.g. neverthrow) for recoverable domain errors where explicit error handling improves clarity — adopt it only when the project scope justifies it and the repo doesn't already settle error style (HEURISTIC, not a universal requirement).

| Library | When to Use |
|---------|-------------|
| **neverthrow** | Default choice — small explicit `Result<T, E>` for recoverable domain errors |
| **Effect** | Only when the app benefits from a full effect runtime: typed errors, retries, resources, concurrency, tracing |

**Rule:** Use `Result` where recoverable/domain errors are first-class. Reserve `try/catch` for error boundaries (middleware, top-level handlers) only.

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

See `references/core/api-design.md` for protocol-specific patterns (REST, GraphQL, gRPC, tRPC).

---

## 6. Caching Strategy

**Decision rules:**
- Say **Redis-compatible**, not Redis-only (verified 2026-07-02): prefer **Valkey** (Linux Foundation, BSD) for permissive OSS/self-hosted defaults; choose Redis when managed-service, module, or license posture justifies it.
- Cache only after correctness is proven on the uncached path.
- Prefer cache-aside by default; use write-through only when strong consistency matters.
- Every key has a namespace, version, stable identifier, TTL, and invalidation trigger.
- Never cache error responses or personalized CDN responses; protect cached PII with encryption and access controls.
- Add stampede protection for hot keys and monitor hit rate, pool exhaustion, and stale-read incidents.

See `references/core/caching.md` for TTL guidance, Redis patterns, CDN rules, invalidation triggers, connection pooling, and code examples.

---

## 7. Observability (OpenTelemetry)

**Decision rules:**
- **OTel maturity (verified 2026-07-02):** traces/metrics are Stable in JS/Python; **logs are still Development** — baseline is trace/span-correlated structured logs + OTel traces/metrics.
- Production services emit traces, metrics, and structured JSON logs with `requestId`, `traceId`, and `spanId`.
- Start with OTel auto-instrumentation, then add custom spans only for business-critical or non-instrumented work.
- Never log PII, secrets, full request/response bodies, or noisy stack traces outside error boundaries.
- Page only on customer-impacting signals tied to SLOs; use warning alerts for capacity trends.

See `references/core/observability.md` for OTel setup, structured logging conventions, trace propagation, dashboards, RUM correlation, and alerting guidance.

---

## 8. Skeleton Project Evaluation

When starting from a template or boilerplate, verify before building on top:

| Check | What to Verify |
|-------|---------------|
| Dependencies | Up-to-date? CVEs? Unnecessary packages? |
| Architecture fit | Does the template's structure match your actual needs? |
| Auth/security | Is the auth pattern appropriate for your use case? |
| Database | Is the ORM/query builder suitable for your data model? |
| Dead code | Remove unused example routes, models, and middleware |
| Config management | Environment-based config, no hardcoded values |

Treat templates as starting points, not gospel. Strip to essentials, then add what you need.

---

## 9. API Performance Targets (HEURISTIC defaults — define product SLOs from user journeys and alert on error-budget burn, not raw percentiles alone)

| Metric | Target | Escalation |
|--------|--------|-----------|
| p50 response time (reads) | ≤ 50ms | Profile with tracing |
| p95 response time (reads) | ≤ 200ms target, alert at >500ms (see observability.md) | Optimization target |
| p95 response time (writes) | ≤ 500ms | Acceptable for complex writes |
| p99 response time | ≤ 1000ms | Investigate outliers |
| Error rate | < 0.1% target, alert at >1% (see observability.md) | Optimization target |

- Measure at the handler level, not including network
- Use `Server-Timing` header to expose backend timing to frontend
- Log slow queries (> 100ms) with EXPLAIN output
- Connection pool (long-running servers): min = CPU cores, max = CPU cores × 4; for serverless/Lambda use min = 0–2

API responses that drive UI must include descriptive error messages (not just codes) for screen reader announcement, pagination metadata (total count) for assistive technology, and `Content-Language` header matching response body language.

## 10. SEO Support Endpoints

When the app serves web pages (SSR/SSG):
- `GET /sitemap.xml` — dynamic sitemap generation with `<lastmod>`
- `GET /robots.txt` — configurable per-environment (disallow staging/preview)
- Structured data: provide JSON-LD data in API responses when frontend needs it
- Redirect chains: max 1 hop (301 for permanent, 308 for POST-preserving)

## 11. Deployment Handoff

Deployment strategy, rollout shape, rollback proof, and feature-flag rollout policy are
owned by `dev-devops`. Backend owns the app compatibility hooks that make safe deployment
possible:

- Database migrations: backward-compatible (expand-then-contract), separated from code deploy
- Feature-flag checks in application code (rollout policy lives in `dev-devops`)
- Health/readiness endpoint behavior when requested by the deployment surface
- Graceful-shutdown hooks for drain sequencing

---

## 12. Pre-Flight Checklist

Before delivering:
- [ ] Consistent response envelope on every endpoint
- [ ] Input validation with schema (Zod, Pydantic, etc.)
- [ ] Authentication middleware on protected routes
- [ ] Rate limiting on public endpoints
- [ ] Structured JSON logging with `requestId` and `traceId`
- [ ] Error handler returns proper HTTP codes via `AppError` hierarchy
- [ ] No raw SQL in service layer
- [ ] No hardcoded secrets
- [ ] Migration code is backward-compatible when release sequencing requires it
- [ ] Observability: traces and structured logs wired (see `references/core/observability.md`)
- [ ] Health/readiness handlers exist when the runtime/deploy surface requires them; operational gates live in `dev-devops`
- [ ] API performance: p95 reads ≤ 200ms, slow queries logged with EXPLAIN (§9)
- [ ] SEO endpoints: sitemap.xml + robots.txt if serving web pages (§10)
- [ ] Security review: delegate to `dev-security/SKILL.md` for production readiness
- [ ] Stack-specific rules followed (see `references/stacks/`)
