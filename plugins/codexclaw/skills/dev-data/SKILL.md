---
name: cxc-dev-data
description: "Use for analytics and data pipelines. Triggers: ETL, ELT, data quality, SQL optimization, schema drift, backfill, 데이터 파이프라인, 데이터 품질, 백필."
metadata:
  last-verified: "2026-07-02"
  short-description: "Data pipelines, ETL/ELT design, data quality validation, SQL optimization, and analysis patterns."
---

# Dev-Data — Data Engineering & Analysis Guide

Activates by change surface for data pipelines, analytics, SQL-heavy work, schema evolution, backfills, and reporting.

Production-grade data engineering patterns for building reliable data systems.

Before data work, read [dev](../dev/SKILL.md) for classification, fast paths, rule authority, family invariants, verification, and safety; current/public evidence follows its [Conditional Routes](../dev/SKILL.md#conditional-routes).

Use browser fetch/open/text/get-dom/snapshot only after
candidate URLs exist and the claim needs browser-verifiable source evidence.

## When to Activate

- Building data pipelines or ETL/ELT processes
- Processing CSV, JSON, Parquet, or Excel files
- Writing analytical SQL, warehouse/lakehouse queries, or transformation models
- Setting up data quality checks or validation
- Performing data analysis, aggregation, or reporting
- Choosing between batch and streaming architectures

**Do not activate for plain app CRUD SQL, OLTP query tuning, or transactional schema design.** Route those to `dev-backend/references/stacks/database.md`. This skill owns analytics, ETL/ELT, pipelines, data quality, and reporting.

## Modular References

| Condition | Reference |
|---|---|
| Every data task; ingestion, incremental loading, ETL/ELT, dbt, retries, or orchestration | [Principles and pipelines](references/01-ingestion-pipelines.md) |
| Quality checks, data contracts, schema changes/backfills, review, or delivery | [Quality and evolution](references/02-quality-evolution.md) (DATA-MIGRATION-01, DATA-REVIEW-01) |
| Analysis/reporting, batch/streaming, storage, or engine selection | [Analysis and engines](references/03-analysis-engines.md), [streaming](references/streaming.md), [tools](references/tools.md) |
| ML training, experiments, feature stores, or data versioning | [ML pipelines](references/ml-pipeline.md) |
| PII, retention, masking, or governance | [Governance](references/04-governance-queries.md#7-data-governance--pii), [implementation patterns](references/governance.md); `cxc-dev-security` for policy |
| Analytical SQL/query execution safety, pipeline APIs, observability, or consumers | [Queries and companions](references/04-governance-queries.md#8-query-performance-guidelines) |
