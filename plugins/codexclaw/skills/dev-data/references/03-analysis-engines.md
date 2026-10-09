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

See `../references/streaming.md` for Kafka configuration, CDC patterns, and windowing.

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
| **Speed (groupby/join)** | Measure on representative input | Depends on expressions, data and execution mode | Depends on SQL plan, data and memory budget |
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

See `../references/tools.md` for full patterns and code examples.
See `../references/ml-pipeline.md` for ML training pipelines, experiment tracking (MLflow 3.x), feature stores (Feast), and data versioning (DVC/Delta Lake).

---
