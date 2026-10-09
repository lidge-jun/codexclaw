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
❌ Fail: Quarantine invalid rows under the dataset's access/retention policy; log redacted identifiers and diagnostics, not raw PII. Don't silently drop.
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
