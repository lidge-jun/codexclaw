# Data Processing Tools — pandas vs Polars vs DuckDB

Decision matrix and code patterns for the three core data processing engines.

---

## When to Use What

| Scenario | Recommended | Why |
|----------|-------------|-----|
| Quick CSV exploration, <100MB | pandas | Widest ecosystem, interactive-friendly |
| Batch ETL pipeline, >100MB | Polars | Multi-threaded, lazy evaluation, memory efficient |
| SQL analytics on local files | DuckDB | Vectorized SQL engine, queries Parquet/CSV directly |
| ML feature engineering | pandas (with Arrow interop) | scikit-learn, PyTorch, TensorFlow compatibility |
| Ad-hoc data warehouse queries | DuckDB | SQL-first, spill-to-disk for large datasets |
| High-performance joins/groupby | Polars or DuckDB | Both 5-10x faster than pandas |

---

## Polars Patterns

```python
import polars as pl

# Lazy evaluation — build query plan, execute once
result = (
    pl.scan_parquet("orders/*.parquet")
    .filter(pl.col("status") == "completed")
    .group_by("customer_id")
    .agg([
        pl.col("amount").sum().alias("total_spend"),
        pl.col("order_id").count().alias("order_count"),
    ])
    .sort("total_spend", descending=True)
    .collect()  # execute
)

# Streaming mode for larger-than-RAM datasets
result = (
    pl.scan_parquet("huge_dataset/*.parquet")
    .filter(pl.col("amount") > 100)
    .collect(streaming=True)
)
```

**Key rules:**
- Prefer `scan_*` (lazy) over `read_*` (eager) for files >100MB
- Use expressions (`pl.col()`) not Python lambdas — expressions parallelize, lambdas don't
- `.collect(streaming=True)` for datasets approaching RAM limits

---

## DuckDB Patterns

```python
import duckdb

# Query files directly — no loading step
result = duckdb.sql("""
    SELECT customer_id, SUM(amount) as total
    FROM 'orders/*.parquet'
    WHERE status = 'completed'
    GROUP BY customer_id
    ORDER BY total DESC
    LIMIT 100
""").fetchdf()  # returns pandas DataFrame

# Query Polars DataFrame (zero-copy via Arrow)
import polars as pl
df = pl.read_parquet("events.parquet")
top_users = duckdb.sql("SELECT user_id, COUNT(*) FROM df GROUP BY user_id HAVING COUNT(*) > 10")
```

**Key rules:**
- DuckDB queries Parquet, CSV, JSON, and S3 paths directly — no ETL step needed
- Use for SQL-heavy analytics; use Polars for imperative transform chains
- `duckdb.sql()` accepts Polars/pandas DataFrames as table references (zero-copy)

---

## pandas Patterns (When Appropriate)

```python
import pandas as pd

# Small dataset exploration
df = pd.read_csv("data.csv", dtype={"id": str, "amount": float})

# Always specify dtypes to avoid inference surprises
# Always check shape, dtypes, nulls immediately
print(df.shape, df.dtypes, df.isnull().sum())
```

**Key rules:**
- Use only for <100MB datasets or when ML library requires pandas input
- Avoid chained indexing (`df[col][row]`) — use `.loc` / `.iloc`
- Convert to Polars/DuckDB for any transform over 100MB

---

## Interop Patterns

```python
import polars as pl
import duckdb

# Polars → DuckDB (zero-copy via Arrow)
df = pl.scan_parquet("events/*.parquet").filter(pl.col("status") == "active").collect()
result = duckdb.sql("SELECT user_id, COUNT(*) as cnt FROM df GROUP BY user_id ORDER BY cnt DESC LIMIT 10")

# DuckDB → Polars (zero-copy via Arrow)
arrow_table = duckdb.sql("SELECT * FROM 'data.parquet' WHERE amount > 100").arrow()
df = pl.from_arrow(arrow_table)

# Polars → pandas (when ML library requires it)
pandas_df = df.to_pandas()

# pandas → Polars (for performance upgrade)
polars_df = pl.from_pandas(pandas_df)
```

---

## Decision Flowchart

```
Data size?
├── <100MB, interactive exploration → pandas
├── >100MB, <10GB batch transforms → Polars
├── SQL-first analytics, any size → DuckDB
├── ML pipeline needing scikit-learn/PyTorch → pandas (convert from Polars at boundary)
└── Blended workflow → Polars transforms → DuckDB aggregations
```
