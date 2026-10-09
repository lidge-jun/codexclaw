## 6. Caching Strategy

**Decision rules:**
- Say **Redis-compatible**, not Redis-only (verified 2026-07-02): prefer **Valkey** (Linux Foundation, BSD) for permissive OSS/self-hosted defaults; choose Redis when managed-service, module, or license posture justifies it.
- Cache only after correctness is proven on the uncached path.
- Prefer cache-aside by default; use write-through only when strong consistency matters.
- Every key has a namespace, version, stable identifier, TTL, and invalidation trigger.
- Never cache error responses or personalized CDN responses; protect cached PII with encryption and access controls.
- Add stampede protection for hot keys and monitor hit rate, pool exhaustion, and stale-read incidents.

See `../../references/core/caching.md` for TTL guidance, Redis patterns, CDN rules, invalidation triggers, connection pooling, and code examples.

---

## 7. Observability (OpenTelemetry)

**Decision rules:**
- **OTel maturity (verified 2026-07-02):** traces/metrics are Stable in JS/Python; **logs are still Development** — baseline is trace/span-correlated structured logs + OTel traces/metrics.
- Production services emit traces, metrics, and structured JSON logs with `requestId`, `traceId`, and `spanId`.
- Start with OTel auto-instrumentation, then add custom spans only for business-critical or non-instrumented work.
- Never log PII, secrets, full request/response bodies, or noisy stack traces outside error boundaries.
- Page only on customer-impacting signals tied to SLOs; use warning alerts for capacity trends.

See `../../references/core/observability.md` for OTel setup, structured logging conventions, trace propagation, dashboards, RUM correlation, and alerting guidance.

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
- Analytical data / ETL / pipeline quality: load `dev-data`.
- API consumer context / frontend contract alignment: load `dev-frontend`.
- Test strategy / verification harnesses / QA execution: load `dev-testing`.
- Backend failure RCA methodology: load `dev-debugging`.
- New project setup / file placement conventions: load `dev-scaffolding`.

---

## 12. Pre-Flight Checklist

Before delivering:
- [ ] Existing/protocol response contract preserved; shared envelope only where applicable ([§5](03-request-contracts.md#5-api-response-contract))
- [ ] Input validation with schema (Zod, Pydantic, etc.)
- [ ] Authentication middleware on protected routes
- [ ] Rate limiting on public endpoints
- [ ] Structured JSON logging with `requestId` and `traceId`
- [ ] Error handler preserves the repository's error convention and correct HTTP mapping; AppError is one optional pattern
- [ ] No raw SQL in service layer
- [ ] No hardcoded secrets
- [ ] Migration code is backward-compatible when release sequencing requires it
- [ ] Observability: traces and structured logs wired (see `../../references/core/observability.md`)
- [ ] Health/readiness handlers exist when the runtime/deploy surface requires them; operational gates live in `dev-devops`
- [ ] API performance: p95 reads ≤ 200ms, slow queries logged with EXPLAIN (§9)
- [ ] SEO endpoints: sitemap.xml + robots.txt if serving web pages (§10)
- [ ] Security review: delegate to `../../../dev-security/SKILL.md` for production readiness
- [ ] Stack-specific rules followed (see `../../references/stacks/`)
