## Pre-Flight Checklist

Before delivering:
- [ ] Input contract defined: source, schema, expected columns/types, and owner
- [ ] Pipeline is idempotent and restartable from the last successful checkpoint
- [ ] Data-quality checks cover nulls, uniqueness, ranges, freshness, and row counts
- [ ] Volume and latency justify the chosen engine: pandas, Polars, DuckDB, SQL warehouse, Spark/Flink
- [ ] Invalid records have a dead-letter/quarantine path with enough context to debug
- [ ] PII/governance classification is complete or delegated to `dev-security`/[§7](04-governance-queries.md#7-data-governance--pii)
- [ ] Output format and downstream contract are explicit

---

## 4. Data Quality

### Validation Checks

Run these after every pipeline step, not just at the end:

| Check | What It Validates | Example |
|-------|-------------------|---------|
| **Not null** | Required fields have values | `WHERE order_id IS NULL` → 0 rows |
| **Unique** | No duplicates on key columns | `COUNT(*) = COUNT(DISTINCT id)` |
| **Range** | Numeric values within bounds | `amount BETWEEN 0 AND 1,000,000` |
| **Categorical** | Values in allowed set | `status IN ('pending', 'active', 'closed')` |
| **Freshness** | Data is recent enough | `MAX(updated_at) > NOW() - INTERVAL '24 hours'` |
| **Row count** | No unexpected data loss or explosion | Within ±10% of previous run |
| **Referential** | Foreign keys point to existing records | `customer_id EXISTS IN customers` |

### Quality Tool Integration

Use a **layered quality strategy** — different tools at different pipeline stages:

| Stage | Tool | Purpose |
|-------|------|---------|
| **Ingest** | Great Expectations | Validate raw data against expectations before staging |
| **Transform** | dbt tests | Assert model-level quality (not_null, unique, relationships, custom SQL) |
| **Production** | Soda / Monte Carlo | Real-time monitoring, anomaly detection, SLA enforcement |

Validate data dimensions: completeness, uniqueness, range, format, referential integrity, freshness.

**Rule:** Run validation on every pipeline step — skipping "because the data looks fine" leads to silent downstream corruption.

### Data Contracts

For datasets shared between teams, define a contract:

A data contract must include:
- **name**, **owner**, **version**
- **schema**: column name, type, nullability, uniqueness, allowed values
- **SLA**: freshness threshold, minimum completeness percentage
- **consumers**: list of downstream teams/systems

Changes to a contracted schema require **versioning and consumer notification**.

### Migration & Backfill Sequencing

**Rule (DATA-MIGRATION-01):** Treat schema changes and data backfills as separate steps. Production evolution uses expand → backfill → dual read/write when needed → contract; require a dry run, idempotency proof, and reconciliation counts before declaring the migration complete.

---

## Data Change Review Checklist (DATA-REVIEW-01, DEFAULT)

When reviewing or implementing changes that affect data pipelines, schemas,
or data stores, check these domain-specific concerns:

### Schema Changes
- [ ] Is the change backward-compatible? (additive fields, optional columns)
- [ ] Are existing consumers updated or tolerant of the new schema?
- [ ] Is there a migration path for existing data?
- [ ] Are destructive changes (DROP, RENAME, type narrowing) reversible?
- [ ] Is the schema change tested with representative production-scale data?

### Pipeline Changes
- [ ] Are late/out-of-order events handled correctly?
- [ ] Is the pipeline idempotent for replays?
- [ ] Are timezone/DST transitions handled (especially for daily aggregations)?
- [ ] Is numeric precision preserved across transforms (float → decimal)?
- [ ] Are nondeterministic transforms (sampling, shuffling) reproducible with seeds?

### Quality Gates
- [ ] Is there a before/after reconciliation report (row counts, checksums)?
- [ ] Are null/missing value rates within expected bounds?
- [ ] Are downstream consumers notified of schema or semantic changes?
- [ ] Is the blast radius documented (which dashboards, models, exports break)?

### Backfill Safety
- [ ] Is the backfill cost estimated (compute, I/O, lock duration)?
- [ ] Is there a rollback plan for partial backfill failure?
- [ ] Are concurrent writes handled during backfill?
- [ ] Is the backfill window documented and approved?
