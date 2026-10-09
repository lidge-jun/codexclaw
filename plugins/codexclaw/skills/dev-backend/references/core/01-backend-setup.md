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

See `../../references/core/architecture.md` for full decision matrices.

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

See `../../references/core/api-design.md` for protocol-specific patterns.
