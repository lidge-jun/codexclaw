## 7. Data Governance & PII

### Data Classification

| Level | Examples | Handling |
|-------|----------|---------|
| **Public** | Aggregated metrics, public reports | No restrictions |
| **Internal** | Business KPIs, operational data | Access controls, no external sharing |
| **Confidential** | Customer data, financial records | Encryption at rest, column-level masking |
| **Restricted** | SSN, payment data, health records | Tokenization, row-level security, audit logging |

### PII Handling Checklist

Before building any pipeline that touches PII:
- [ ] Classify all columns by sensitivity level
- [ ] Apply masking/tokenization for non-production environments (static masking)
- [ ] Implement dynamic masking for production queries (role-based)
- [ ] Set data retention TTL — don't keep PII longer than needed
- [ ] Support right-to-erasure (GDPR Article 17): cascading delete across all pipeline stages
- [ ] Log all PII access for audit trail
- [ ] Mask raw PII values before logs and traces — use structured logging with redaction

### GDPR/CCPA Quick Reference

| Requirement | Engineering Pattern |
|-------------|---------------------|
| Right to erasure | Soft delete → batch purge → propagate to downstream stores including data lake |
| Data minimization | Collect only necessary fields; TTL on non-essential data |
| Consent tracking | Consent event store with versioned preferences; consent-aware pipeline branches |
| Data portability | Standardized export endpoint (JSON/CSV) per user request |

See `../references/governance.md` for detailed implementation patterns, row-level security, and retention policies.

---

## 8. Query Performance Guidelines

Ownership note: this section covers analytical SQL, warehouse/lakehouse queries, and pipeline transforms. Plain app CRUD SQL, OLTP schema design, and transactional query tuning belong to `../../dev-backend/references/stacks/database.md`.

- Start query investigation with non-executing EXPLAIN. EXPLAIN ANALYZE actually executes
  the statement, including writes and possible function/external side effects. Use it
  only with authorized execution on representative isolated data and a resource budget.
  A rollback does not undo every possible external effect; never treat ANALYZE as a
  read-only diagnostic. See the PostgreSQL EXPLAIN documentation for the pinned version.
- Slow query threshold: > 100ms for OLTP, > 5s for OLAP/analytics
- Index strategy: B-tree for equality/range, GIN for array/JSONB, GiST for geo
- Missing index detection: `pg_stat_user_tables` → seq_scan / idx_scan ratio
- Partition tables > 10M rows if query patterns allow time-range or hash partitioning
- Never `SELECT *` in production code — specify columns

For pipeline observability, follow the OpenTelemetry patterns in `../../dev-backend/references/core/observability.md`. Instrument pipeline stages as spans, data quality checks as events.

When pipeline errors surface through APIs, use the AppError taxonomy from `../../dev-backend/SKILL.md` §3. Map pipeline failures to appropriate HTTP status codes (422 for validation, 502 for upstream failures, 503 for capacity).

For data API patterns (pagination of large datasets, cursor-based access, streaming responses), see `../../dev-backend/references/core/api-design.md`.

---

## 9. Companion Skills

Data engineering does not exist in isolation. Cross-reference these skills when your pipeline connects to other systems:

| Companion | When to Consult | Key Sections |
|-----------|-----------------|--------------|
| `dev-backend` | Exposing data via API, response envelope shape, pagination | §5 API Response Contract, §2 Layered Architecture |
| `dev-security` | PII handling, data classification, access controls, audit logging, input validation policy (per dev-security §10 ownership matrix) | §1 Input Validation, §4 Secrets, §8 Pre-Flight |
| `dev-testing` | Pipeline validation, contract tests for data APIs, CI gates | §2 Backend & API Testing, §3 Contract Testing |
| `dev-frontend` | Downstream reporting/dashboard consumers, data format expectations | §15 Backend Contract & Security Alignment |

**Integration patterns:**
- Data APIs preserve the existing/protocol contract and its exceptions (`dev-backend` §5); do not wrap GraphQL, gRPC, SSE, or an established API just to match a sample envelope
- PII pipelines must classify columns and apply masking per `dev-security` guidance before this skill's §7 rules
- Data contract changes (§4 Data Contracts) must notify downstream consumers including frontend teams

---
