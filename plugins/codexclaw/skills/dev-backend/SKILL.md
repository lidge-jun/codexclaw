---
name: cxc-dev-backend
description: "Use for APIs, servers and app databases. Triggers: REST, GraphQL, migration, query optimization, middleware, caching, queues, 백엔드, API 작업, 마이그레이션, 쿼리 최적화."
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

Before backend work, read [dev](../dev/SKILL.md) for classification, fast paths, rule authority, family invariants, verification, and safety; current/public evidence follows its [Conditional Routes](../dev/SKILL.md#conditional-routes).

## Modular References

| Condition | Reference |
|---|---|
| C2 ordinary CRUD/resource slice | [CRUD API](references/core/crud-api.md) alone suffices |
| New/changed API style or C3+ API work | [API design](references/core/api-design.md) |
| Versioning, deprecation, or API migration | [API lifecycle](references/core/api-lifecycle.md) |
| Stack detection, ambiguous technology, or architecture/protocol selection | [Setup](references/core/01-backend-setup.md); C3+: [Architecture](references/core/architecture.md) |
| New endpoints, classes, or modules | [Anti-slop](references/core/anti-slop-backend.md) |
| SSE/WebSocket, runtime timeouts/drain/request IDs, or async queues | [Connections and queues](references/core/02-connections-queues.md) |
| Layer placement, error mapping/Result, middleware order, or response contracts | [Request contracts](references/core/03-request-contracts.md) |
| Caching, observability, template evaluation, performance, SEO, handoff, or delivery checklist | [Production delivery](references/core/04-production-delivery.md) |
| Production/long-lived services | [Observability](references/core/observability.md), [health checks](references/core/health-checks.md) |
| CPU-bound/untrusted work | [Process isolation](references/core/process-isolation.md) |
| Cache optimization | [Caching patterns](references/core/caching.md) |
| Node/TypeScript, Python, or database work | [Node](references/stacks/node.md), [Python](references/stacks/python.md), [database](references/stacks/database.md), respectively |
| ML deployment, RAG/LLM integration, or mobile APIs | [ML serving](references/core/ml-serving.md), [LLM integration](references/core/llm-integration.md), [mobile API](references/core/mobile-api.md), respectively |
| Auth/input/security policy | `cxc-dev-security` |
| Deployment, analytics, frontend contracts, testing, RCA, or scaffolding | [Handoff owners](references/core/04-production-delivery.md#11-deployment-handoff) |

Read `api-design.md` + `anti-slop-backend.md` first, then the relevant stack file.
For C2 ordinary slices, `crud-api.md` alone suffices; read `api-design.md`/`architecture.md` for new API styles or C3+ work.

## 3. Error Handling

For error mapping and the conditional Result pattern, read [Error handling](references/core/03-request-contracts.md#3-error-handling).
