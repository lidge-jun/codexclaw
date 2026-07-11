---
name: cxc-dev-data
description: "MUST USE for data engineering and analysis work — pipelines, ETL/ELT, data quality, SQL optimization, schema evolution, backfills, and reporting. Triggers: ETL, ELT, pipeline, data quality, SQL optimization, backfill, migration, schema drift, validation, batch vs streaming, 데이터 파이프라인, 데이터 품질, 백필."
metadata:
  last-verified: "2026-07-02"
  short-description: "Data pipelines, ETL/ELT design, data quality validation, SQL optimization, and analysis patterns."
---

# Dev-Data — Data Engineering & Analysis Guide

Activates by change surface for data pipelines, analytics, SQL-heavy work, schema evolution, backfills, and reporting.

Production-grade data engineering patterns for building reliable data systems.

> **C0/C1 work (small local patches):** See `dev` §0.0 Work Classifier + §0.1 Patch Fast-Path before reading references.

## When to Activate

- Building data pipelines or ETL/ELT processes
- Processing CSV, JSON, Parquet, or Excel files
- Writing analytical SQL, warehouse/lakehouse queries, or transformation models
- Setting up data quality checks or validation
- Performing data analysis, aggregation, or reporting
- Choosing between batch and streaming architectures

**Do not activate for plain app CRUD SQL, OLTP query tuning, or transactional schema design.** Route those to `dev-backend/references/stacks/database.md`. This skill owns analytics, ETL/ELT, pipelines, data quality, and reporting.

## External/current data evidence

For current external dataset contracts, source freshness, pipeline/tool version
behavior, provider data API changes, or public benchmark/source claims, read the
active `search` skill and follow its query-rewrite, source-fetch, and
evidence-status rules. Use browser fetch/open/text/get-dom/snapshot only after
candidate URLs exist and the claim needs browser-verifiable source evidence.

---

## Pre-Flight Checklist

Before delivering:
- [ ] Input contract defined: source, schema, expected columns/types, and owner
- [ ] Pipeline is idempotent and restartable from the last successful checkpoint
- [ ] Data-quality checks cover nulls, uniqueness, ranges, freshness, and row counts
- [ ] Volume and latency justify the chosen engine: pandas, Polars, DuckDB, SQL warehouse, Spark/Flink
- [ ] Invalid records have a dead-letter/quarantine path with enough context to debug
- [ ] PII/governance classification is complete or delegated to `dev-security`/§7
- [ ] Output format and downstream contract are explicit

---

## 1. Data Processing Principles

Five rules that apply to every data task:

| Principle | What It Means |
|-----------|---------------|
| **Pipeline thinking** | Every pipeline is Extract → Transform → Load. Keep each stage as an independent, testable function. |
| **Schema-first** | Define expected columns, types, and constraints BEFORE writing transformation logic. |
| **Defensive parsing** | External data will have nulls, wrong types, extra columns, missing columns, and encoding issues. Assume all of these. |
| **Idempotent operations** | Running the same pipeline twice on the same input must produce the same output. Use upsert patterns, not blind inserts. |
| **Fail fast, fail loud** | Raise errors at pipeline boundaries immediately. Internal transforms propagate errors; dead-letter queues handle row-level quarantine at the boundary (see §3). |

---

## 2. Data Ingestion Patterns

### Format-Specific Guidance

| Format | Best For | Watch Out For |
|--------|----------|---------------|
| **CSV** | Simple tabular data, human-readable | Encoding (UTF-8 BOM), delimiter ambiguity, multiline values, inconsistent quoting |
| **JSON** | Nested structures, API responses | Large files (stream, don't load all at once), deeply nested objects, encoding |
| **Parquet** | Large analytical datasets, columnar queries | Requires library support, not human-readable, schema evolution |
| **Excel** | Business user handoffs | Multiple sheets, merged cells, formulas vs. values, date formatting |
| **Database** | Production system access | Connection pooling, query timeouts, use read replicas for analytics |

### Incremental Loading

For large or frequently updated data sources:

1. Use a **watermark column** (e.g., `updated_at`, `id`) to track the last processed record.
2. Store the watermark after successful load. On failure, restart from the last saved watermark.
3. Process in batches (tune based on source limits and memory), not all-at-once.
4. Validate row counts: `loaded_rows` should equal `source_rows_since_watermark`.

### Schema Validation on Ingest

Before any transformation, validate incoming data:

```
✅ Check: Expected columns exist
✅ Check: Data types match (string, number, date, boolean)
✅ Check: Required fields are not null
✅ Check: Values are within expected ranges
✅ Check: No unexpected duplicate keys
❌ Fail: If any check fails, write to error log with row details. Don't silently drop.
```

---

## 3. ETL/ELT Pipeline Design

### Layer Architecture

**Rules:**
- **Keep staging immutable.** Copy first, transform in a separate step — this enables replay and debugging.
- **One transformation per step.** Don't combine cleaning + joining + aggregating in one function. Chain separate steps.
- **Incremental processing.** Process only new/changed records when possible. Full reloads only when schema changes.

### dbt Integration Patterns

Engine landscape (verified 2026-07-02): dbt Core remains the default; dbt Fusion is the separately-documented/licensed current engine (check feature matrix + license before adopting); SQLMesh is a credible active alternative. Lakehouse format: choose Delta vs Iceberg by ecosystem — both active; never claim a "winner".

When using dbt for transformations, follow the **staging → intermediate → mart** layer architecture:

**Rules:**
- **Staging models**: rename, cast, filter NULLs — no joins, no business logic
- **Intermediate models**: joins across staging, deduplication, business transforms
- **Mart models**: aggregations, final business entities consumed by BI/analytics
- Every model has a `schema.yml` with tests (not_null, unique, relationships, custom SQL).
- Run validation tests in CI and after significant changes — treat test failures as pipeline failures.
- Use `dbt source freshness` to monitor upstream data staleness

### Error Handling in Pipelines

| Scenario | Pattern |
|----------|---------|
| **Invalid records** | Write to dead-letter table/file for manual review. Preserve every record for debugging. |
| **Source unavailable** | Retry with exponential backoff (1s, 2s, 4s). Alert after 3 failures. |
| **Schema mismatch** | Halt pipeline. Log expected vs. actual schema. Don't attempt partial loads. |
| **Duplicate records** | Use upsert (INSERT ON CONFLICT UPDATE) or deduplicate with window functions. |

### Orchestration Basics

When pipelines have multiple steps with dependencies:

- Define tasks as a **DAG** (Directed Acyclic Graph). Each task depends on its upstream tasks.
- Each task must be **independently retryable**. If step 3 fails, you restart step 3, not step 1.
- Set reasonable retries (2-3) with delay (5 min between attempts).
- Add timeout per task to prevent hung pipelines.
- Alert on failure: email, Slack, or monitoring dashboard.

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

## 5. Analysis & Reporting

### Always Start with Summary Statistics

Before any deep analysis, provide:

| Metric | What to Report |
|--------|----------------|
| Row count | Total records in dataset |
| Column inventory | Name, type, null count per column |
| Numeric summary | min, max, mean, median, std dev |
| Categorical summary | Unique values, top 5 most frequent |
| Time range | Earliest and latest timestamp |
| Data quality | Null percentage, duplicate percentage |

### Output Formats

| Format | When to Use |
|--------|-------------|
| **Markdown tables** | Inline reports, ≤50 rows, quick summaries |
| **JSON** | Programmatic consumption, API responses |
| **CSV export** | Handoff to spreadsheet users, large datasets |
| **HTML + charts** | Dashboards, visual reports (Chart.js, Mermaid diagrams) |

### Statistical Reporting

When analysis involves statistics:
- State the method used and its assumptions.
- Report confidence intervals, not just point estimates.
- Visualize distributions (histograms, box plots), not just averages.
- Distinguish correlation from causation explicitly.

---

## 6. Architecture Decisions

### Batch vs. Streaming

| Condition | Choose |
|-----------|--------|
| Real-time insight required (sub-minute latency) | Streaming (Kafka + Flink, Spark Structured Streaming, or Kafka Streams depending on complexity) |
| Exactly-once semantics needed | Kafka transactional producers + Flink/Spark |
| Latency >1 min acceptable, volume >1TB/day | Distributed batch (Spark, Databricks) |
| Latency >1 min acceptable, volume <1TB/day | Single-node batch (SQL, Python, dbt) |

**Default to batch.** Streaming adds significant complexity in error handling, state management, and debugging. Only use streaming when latency requirements genuinely demand it.

### Streaming Decision Tiers (heuristic guidance)

| Latency Requirement | Framework | Complexity |
|---------------------|-----------|------------|
| Sub-100ms, complex stateful | Apache Flink | High (dedicated cluster) |
| Sub-second, existing Spark infra | Spark Structured Streaming | Medium |
| Sub-second, Kafka-centric | Kafka Streams (embedded library) | Low-Medium |
| Minutes acceptable | Batch with frequent scheduling | Low |

**Kafka essentials for data engineers (Kafka 4.x / KRaft era — no ZooKeeper):**
- Partition by expected throughput — avoid excessive partitions
- Use Schema Registry for backwards-compatible evolution
- Default to at-least-once delivery + idempotent consumers
- Use exactly-once only for financial/billing (transactional producers + consumers)
- Monitor consumer lag via Prometheus/Grafana

See `references/streaming.md` for Kafka configuration, CDC patterns, and windowing.

### Storage Selection

| Need | Choose |
|------|--------|
| SQL analytics, BI dashboards, structured queries | Data warehouse (Snowflake, BigQuery, PostgreSQL) |
| ML training, unstructured data, large-scale storage | Data lake (S3/GCS + Parquet or Delta format) |
| Both SQL and ML needs | Lakehouse (Delta Lake, Apache Iceberg) |
| Real-time key-value lookups, caching | Redis, DynamoDB |
| Graph relationships | Neo4j, Neptune |

### Tool Selection

| Category | Options |
|----------|---------|
| **Orchestration** | Airflow 3.x (standalone DAG processor; `SequentialExecutor` removed), Prefect 3, Dagster |
| **Transformation** | dbt, Spark, plain SQL |
| **Streaming** | Kafka, Kinesis, Pub/Sub |
| **Quality** | GX Core (Great Expectations' OSS library), dbt tests, Soda Core (data contracts), custom validators |
| **Monitoring** | Prometheus, Grafana, Datadog, Monte Carlo |
| **Local analysis** | DuckDB (in-process SQL), Polars (fast DataFrame), pandas only for explicit compatibility exceptions |

### Tool Decision Matrix

| Factor | pandas | Polars | DuckDB |
|--------|--------|--------|--------|
| **Best for** | Required pandas-only downstream compatibility | Batch ETL, performance, DataFrame workflows | SQL analytics, ad-hoc queries, small exploration |
| **Execution** | Single-threaded, eager | Multi-threaded Rust, lazy eval | Vectorized, auto disk spill |
| **Speed (groupby/join)** | Baseline | 5-10x faster | Matches Polars on SQL-native |
| **Memory** | Full load into RAM | Streaming, lazy chains | Spill-to-disk for out-of-core |
| **API style** | DataFrame (imperative) | DataFrame (expression-based) | SQL-first |
| **ML interop** | Excellent (scikit-learn, etc.) | Good (`.to_pandas()`) | Good (`.fetchdf()`) |
| **File format** | CSV, JSON, Excel | CSV, Parquet, Arrow-native | CSV, Parquet, JSON, S3 direct |

**Decision rule:**

| Data size / workflow | Recommended tool |
|----------------------|------------------|
| Small (<100MB), interactive exploration | DuckDB for SQL-first, Polars for DataFrame-first |
| Medium (100MB-10GB), batch transforms | Polars |
| SQL-first analytics, any size | DuckDB |
| Blended workflow | Polars transforms, DuckDB aggregations (zero-copy via Arrow) |
| pandas-only library boundary | pandas, with the compatibility exception stated |

See `references/tools.md` for full patterns and code examples.
See `references/ml-pipeline.md` for ML training pipelines, experiment tracking (MLflow 3.x), feature stores (Feast), and data versioning (DVC/Delta Lake).

---

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

See `references/governance.md` for detailed implementation patterns, row-level security, and retention policies.

---

## 8. Query Performance Guidelines

Ownership note: this section covers analytical SQL, warehouse/lakehouse queries, and pipeline transforms. Plain app CRUD SQL, OLTP schema design, and transactional query tuning belong to `dev-backend/references/stacks/database.md`.

- Every query that runs in production: EXPLAIN ANALYZE before deploy
- Slow query threshold: > 100ms for OLTP, > 5s for OLAP/analytics
- Index strategy: B-tree for equality/range, GIN for array/JSONB, GiST for geo
- Missing index detection: `pg_stat_user_tables` → seq_scan / idx_scan ratio
- Partition tables > 10M rows if query patterns allow time-range or hash partitioning
- Never `SELECT *` in production code — specify columns

For pipeline observability, follow the OpenTelemetry patterns in `dev-backend/references/core/observability.md`. Instrument pipeline stages as spans, data quality checks as events.

When pipeline errors surface through APIs, use the AppError taxonomy from `dev-backend/SKILL.md` §3. Map pipeline failures to appropriate HTTP status codes (422 for validation, 502 for upstream failures, 503 for capacity).

For data API patterns (pagination of large datasets, cursor-based access, streaming responses), see `dev-backend/references/core/api-design.md`.

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
- Data APIs serving frontend dashboards must use the standard response envelope (`dev-backend` §5)
- PII pipelines must classify columns and apply masking per `dev-security` guidance before this skill's §7 rules
- Data contract changes (§4 Data Contracts) must notify downstream consumers including frontend teams

---

## Data Change Review Checklist (DATA-REVIEW-01, DEFAULT)

Source: sol research (dev-skill reinforcement audit, Euler findings).

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
