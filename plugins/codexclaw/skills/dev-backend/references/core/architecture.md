# Architecture Patterns

When to use which pattern, how to structure code, and when to split.
Synthesized from dev-backend + dev-scaffolding (Lidge Standard) + senior-architect (alirezarezvani).

---

## Layered Architecture (Default)

```
Routes → Controllers → Services → Repositories → Database
```

### Layer Rules

| Layer        | Responsibility                  | Receives   | Returns     |
| ------------ | ------------------------------- | ---------- | ----------- |
| Routes       | URL patterns + middleware chain | HTTP req   | (delegates) |
| Controllers  | Parse input, format output      | req/res    | HTTP resp   |
| Services     | Business logic (input validated at controller/trust boundary) | Plain data | Plain data  |
| Repositories | Database access                 | Queries    | Entities    |

**Iron Rule:** Services never receive `req`/`res`. Services never write raw SQL.

---

## When to Split

| Signal                                     | Action                               |
| ------------------------------------------ | ------------------------------------ |
| Module needs different scaling             | Extract to separate service          |
| Separate team needs independent deploy     | Extract to microservice              |
| Technology mismatch (Python ML + Node API) | Separate per technology              |
| File > 500 lines                           | Split by domain within same layer    |
| Feature > 10 files                         | Create sub-folders by responsibility |
| **Everything else**                        | Keep in monolith                     |

---

## Pattern Selection Matrix

| Requirement                  | Recommended Pattern           |
| ---------------------------- | ----------------------------- |
| Rapid MVP development        | Modular Monolith              |
| Independent team deployment  | Microservices                 |
| Complex domain logic         | Domain-Driven Design (DDD)    |
| High read/write ratio diff   | CQRS                          |
| Audit trail required         | Event Sourcing                |
| Third-party integrations     | Hexagonal / Ports & Adapters  |
| Different scaling per module | Service-Oriented Architecture |

---

## Monolith vs Microservices Decision

### Choose Monolith When:
- Team < 10 developers
- Domain boundaries unclear
- Rapid iteration is priority
- Operational complexity must be minimized
- Shared database acceptable

### Choose Microservices When:
- Teams own services end-to-end
- Independent deployment critical
- Different scaling per component
- Technology diversity needed
- Domain boundaries well understood

### Hybrid Approach (Recommended):
Start modular monolith → extract when:
1. A module has significantly different scaling needs
2. A team needs independent deployment
3. Technology constraints require separation

---

## Database Selection

| Characteristic                 | Points to SQL | Points to NoSQL |
| ------------------------------ | :-----------: | :-------------: |
| Structured with relationships  |       ✓       |                 |
| ACID transactions required     |       ✓       |                 |
| Flexible/evolving schema       |               |        ✓        |
| Document-oriented data         |               |        ✓        |
| High write throughput (>10K/s) |               | ✓ (specialized) |

Quick reference:
```
PostgreSQL  → Default choice for most applications
MongoDB     → Document store, flexible schema
Redis       → Caching, sessions, real-time
DynamoDB    → Serverless, auto-scaling, AWS
TimescaleDB → Time-series with SQL
```

---

## SOLID Principles (Quick Reference)

| Principle                 | Rule                                        |
| ------------------------- | ------------------------------------------- |
| **S**ingle Responsibility | One class = one reason to change            |
| **O**pen/Closed           | Open for extension, closed for modification |
| **L**iskov Substitution   | Subtypes must be substitutable              |
| **I**nterface Segregation | Small, focused interfaces                   |
| **D**ependency Inversion  | Depend on abstractions, not concretions     |

---

## The Lidge Standard (Project Scaffolding)

Three pillars every project must follow:

1. **Screaming Architecture** — folder names reveal what the app does (`stock-price/`, `auth/`, `report/`)
2. **Colocation** — related files live together (logic + test + schema in same folder)
3. **Barrel Export** — each feature exposes a single entry point

### Project Skeleton

```
<project>/
├── AGENTS.md              # AI context (propose in plan — do not create silently per dev §0.5)
├── README.md              # Human overview
├── .env.example           # Env template (never commit .env)
│   ├── _plan/             # Active plans
│   ├── _fin/              # Completed work
│   └── str_func/          # Module documentation
├── src/                   # Feature-based layout
│   ├── auth/              # Feature folder
│   │   ├── auth.tool.ts
│   │   ├── auth.test.ts
│   │   └── index.ts       # Public API barrel (package boundary only — see dev-architecture §5)
│   └── shared/            # Truly shared utils only
├── config/
├── docs/
└── tests/e2e/
```

### Feature Module Files

| Language   | Main File      | Test File      | Barrel        |
| ---------- | -------------- | -------------- | ------------- |
| TypeScript | `name.tool.ts` | `name.test.ts` | `index.ts`    |
| Python     | `name_tool.py` | `test_name.py` | `__init__.py` |
| Go         | `name.go`      | `name_test.go` | *(package)*   |

---

## Architecture Decision Records (ADRs)

For significant decisions, create:

```markdown
# ADR-001: [Decision Title]

## Context
[Why this decision is needed]

## Decision
[What we decided]

## Alternatives Considered
[What we rejected and why]

## Consequences
[Trade-offs accepted]
```

Store in `docs/adr/` or another repository source-of-truth planning location.
