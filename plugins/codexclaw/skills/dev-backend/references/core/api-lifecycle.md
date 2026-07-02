# API Lifecycle Management

**Last reviewed**: 2026-07-02
**Applies to**: REST APIs (Express 5.x / Fastify 5.x / any HTTP framework), OpenAPI 3.1+
**When to read**: API versioning, deprecation planning, breaking change detection, change-surface: API lifecycle
**Canonical owner**: `dev-backend` — versioning strategy and deprecation mechanics
**Non-goals**: API design patterns (→ `api-design.md`), authentication (→ `dev-security`), deployment strategy (→ `dev-devops`)

---

## §1 Versioning Strategy

| Strategy | URL Shape | When to Use | Tradeoff |
|----------|-----------|-------------|----------|
| **URL prefix** | `/api/v1/users` | Public/partner APIs | Explicit, cacheable; duplicates routes |
| **Header** | `Accept: application/vnd.myapp.v2+json` | Internal APIs, single client | Clean URLs; harder to test in browser |
| **Query param** | `/api/users?version=2` | Quick prototyping only | Easy; breaks caching, no production use |

**2026 recommendation**: public APIs use URL prefix, internal APIs use header versioning.

### Router-level version branching (Express 5.x)

```typescript
import { Router } from "express";
import { v1UserRouter } from "./v1/users.js";
import { v2UserRouter } from "./v2/users.js";

const api = Router();
api.use("/api/v1/users", v1UserRouter);
api.use("/api/v2/users", v2UserRouter);
// Services are shared — only controllers diverge per version
```

### Banned

| Banned | Fix |
|--------|-----|
| Minor/patch in URL (`/api/v1.2.3/`) | Major only: `/api/v1/`, `/api/v2/` |
| Unversioned public API | Always prefix with `/api/v1/` from day one |
| Version-specific business logic in services | Version divergence lives in controllers; services stay version-agnostic |

---

## §2 Four-Stage Lifecycle (RFC 9745 + RFC 8594)

Every API version passes through exactly four stages:

| Stage | Headers | Client Impact |
|-------|---------|---------------|
| **Active** | None | Normal operation |
| **Deprecated** | `Deprecation: @1719792000` + `Link: rel="deprecation"` + `Link: rel="successor-version"` | Warnings start; functionality unchanged |
| **Sunset announced** | Above + `Sunset: Mon, 30 Sep 2026 23:59:59 GMT` | Hard end date confirmed |
| **Retired** | `410 Gone` response | Endpoint removed; returns migration pointer |

References: [RFC 9745 §3 — Deprecation header](https://www.rfc-editor.org/rfc/rfc9745#section-3), [RFC 8594 §3 — Sunset header](https://www.rfc-editor.org/rfc/rfc8594#section-3)

### Deprecation middleware (Express 5.x)

```typescript
interface DeprecationConfig {
  deprecatedAt: number;        // Unix epoch seconds
  sunsetDate?: string;         // HTTP-date (RFC 7231)
  successorUrl: string;        // e.g. "/api/v2/users"
  migrationDocsUrl: string;    // e.g. "https://docs.example.com/migrate-v1-v2"
}

function deprecation(config: DeprecationConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Deprecation", `@${config.deprecatedAt}`);
    if (config.sunsetDate) {
      res.setHeader("Sunset", config.sunsetDate);
    }
    res.setHeader("Link", [
      `<${config.migrationDocsUrl}>; rel="deprecation"`,
      `<${config.successorUrl}>; rel="successor-version"`,
    ].join(", "));
    next();
  };
}

// Usage
v1Router.use(deprecation({
  deprecatedAt: 1719792000,
  sunsetDate: "Mon, 30 Sep 2026 23:59:59 GMT",
  successorUrl: "/api/v2/users",
  migrationDocsUrl: "https://docs.example.com/migrate-v1-v2",
}));
```

### Retired endpoint handler

```typescript
v1Router.all("*", (req, res) => {
  res.status(410).json({
    success: false,
    error: {
      code: "API_VERSION_RETIRED",
      message: "v1 was retired on 2026-09-30. Migrate to v2.",
      migrationDocs: "https://docs.example.com/migrate-v1-v2",
    },
  });
});
```

### Banned

| Banned | Fix |
|--------|-----|
| `Sunset` without `Deprecation` | Always set `Deprecation` first — RFC 9745 precedes RFC 8594 |
| `Sunset` on soft-deprecation (no committed date) | Use `Deprecation` + `Link` only until date is confirmed |
| Silent removal (no 410, no headers) | Retired endpoints return `410 Gone` with migration link |

---

## §3 Deprecation Policy Template

Minimum notice periods before each transition:

| Transition | Public API | Internal API |
|------------|-----------|--------------|
| Active → Deprecated | 180 days before sunset | 90 days before sunset |
| Deprecated → Sunset announced | 90 days before retirement | 30 days before retirement |
| Sunset → Retired | On announced date | On announced date |

### Notification channels (all required)

1. **Response headers** — `Deprecation` + `Sunset` (machine-readable, always on)
2. **Changelog** — `CHANGELOG.md` or `/docs/api-changelog`
3. **Dashboard/status page** — visual deprecation banner
4. **Direct outreach** — email to high-traffic API consumers (top 10 by request volume)

### Policy document location

```
/docs/api-deprecation-policy.md   # or published at docs site
```

Include: versioning scheme, minimum notice periods, sunset process, support contact, exception request process.

---

## §4 Migration Playbook

### Breaking change detection with oasdiff

```bash
# Install: go install github.com/oasdiff/oasdiff@latest
# Detect breaking changes between two OpenAPI specs
oasdiff breaking openapi/v1.yaml openapi/v2.yaml --format json

# CI gate — exit 1 on breaking changes
oasdiff breaking openapi/v1.yaml openapi/v2.yaml --fail-on ERR
```

### CI gate (GitHub Actions)

```yaml
- name: API breaking change check
  run: |
    oasdiff breaking openapi/v1.yaml openapi/v2.yaml --fail-on ERR
  # Blocks PR if breaking changes detected without migration guide
```

When a breaking change is intentional, require a migration guide link in the PR description.

### Migration guide structure

```markdown
## v1 → v2 Migration Guide

### Breaking Changes
| v1 Field | v2 Field | Change | Action Required |
|----------|----------|--------|-----------------|
| `user.name` | `user.fullName` | Renamed | Update all references |
| `GET /users?page=N` | `GET /users?cursor=X` | Pagination model | Switch to cursor-based |

### SDK Update
- npm: `npm install @myapp/sdk@^2.0.0`
- Codegen: `npx openapi-typescript openapi/v2.yaml -o src/api/v2.ts`

### Timeline
- 2026-07-01: v2 available, v1 deprecated
- 2026-12-31: v1 sunset
```

### Banned

| Banned | Fix |
|--------|-----|
| Breaking change deployed without migration guide | PR gate: `oasdiff breaking --fail-on ERR` + guide link required |
| `301 Redirect` for retired API | APIs return `410 Gone`; redirects are for web pages |
| Undocumented field removal/rename | All removals/renames go through oasdiff + changelog entry |

---

## §5 Anti-Patterns & Pre-flight

### Anti-patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| Eternal beta (`/api/beta/`) with no graduation plan | Beta endpoints accumulate consumers with no stability guarantee | Set graduation criteria + timeline at creation; max 90 days |
| Version proliferation (v1, v2, v3, v4 all active) | Maintenance burden scales linearly | Max 2 active versions (current + previous); retire older |
| Copy-paste versioning (fork entire codebase per version) | Shared bug fixes require N patches | Shared services + version-specific controllers only |
| Changelog-only deprecation (no headers) | Machines can't detect deprecation programmatically | RFC 9745 `Deprecation` header is mandatory |
| "We'll figure out versioning later" | Unversioned `/api/users` deployed to production | `/api/v1/` from the first public endpoint |

### Pre-flight checklist

- [ ] New public endpoint starts with `/api/v1/` prefix
- [ ] Deprecation middleware is available and tested (import, configure, verify headers)
- [ ] `oasdiff` runs in CI against the previous version's OpenAPI spec
- [ ] Migration guide template exists at `/docs/api-migration-template.md`
- [ ] Deprecation policy document exists and covers notice periods
- [ ] Sunset date is an HTTP-date (RFC 7231), not ISO 8601
- [ ] Retired endpoints return `410 Gone` with `migrationDocs` link, not `404`

---

## §6 Cross-References

| Topic | Canonical Source | What This File Does NOT Cover |
|-------|-----------------|-------------------------------|
| REST conventions, response envelope, pagination | `api-design.md` §RESTful, §Envelope | URL design, HTTP methods, error codes |
| Contract testing between API versions | `dev-testing` SKILL.md §5 | Test framework selection, CI pipeline |
| New API version scaffolding | `dev-scaffolding` SKILL.md §11 | File generation, ADR templates |
| Canary deployment per version | `dev-devops` (when available) | Blue-green, rolling, traffic splitting |
| OpenAPI spec authoring rules | `dev-scaffolding/references/api-docs.md` (when available) | Spec file structure, example authoring |
