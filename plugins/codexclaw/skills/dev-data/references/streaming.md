# Streaming & Event-Driven Data Patterns

Kafka patterns, stream processing selection, and CDC integration.

---

## Kafka Configuration Essentials

### Topic Design
- Partition count = expected peak throughput ÷ single-partition throughput
- Avoid >50 partitions per topic unless proven necessary
- Use Schema Registry (Avro/Protobuf) for backwards-compatible schema evolution
- Naming: `{domain}.{entity}.{event}` (e.g., `commerce.orders.created`)

### Delivery Semantics

| Semantic | Config | Use Case |
|----------|--------|----------|
| At-most-once | `acks=0` | Metrics, logs (loss acceptable) |
| At-least-once | `acks=all` + idempotent consumer | Default for most pipelines |
| Exactly-once | `enable.idempotence=true` + transactional API | Financial, billing, inventory |

### Producer Tuning
- `batch.size`: 16-64KB for throughput (default 16KB)
- `linger.ms`: 5-50ms to allow batching
- `compression.type`: `lz4` (speed) or `zstd` (ratio)
- Always enable `enable.idempotence=true`

### Consumer Patterns
- Prefer cooperative rebalancing (`partition.assignment.strategy=cooperative-sticky`)
- Commit offsets after processing, not before
- Monitor consumer lag via Prometheus metrics

---

## Change Data Capture (CDC)

Use **Debezium** for database → Kafka streaming:

```
PostgreSQL (WAL) → Debezium Connector → Kafka Topic → Consumer/Flink/Spark
```

- Captures INSERT, UPDATE, DELETE as events with before/after state
- No application code changes needed — reads from database WAL
- Supports PostgreSQL, MySQL, MongoDB, SQL Server

---

## Stream Processing Selection

| Need | Choose |
|------|--------|
| Ultra-low latency (<100ms) + complex state | Apache Flink |
| Existing Spark infrastructure + can tolerate >1s | Spark Structured Streaming |
| Simple transforms, data stays in Kafka | Kafka Streams (no extra cluster) |
| Latency >1min acceptable | Batch with frequent scheduling |

---

## Windowing Patterns

| Window Type | Use Case | Example |
|-------------|----------|---------|
| **Tumbling** | Fixed, non-overlapping intervals | 1-minute aggregation buckets |
| **Sliding** | Overlapping intervals | 5-min window sliding every 1 min |
| **Session** | Activity-based, gap-defined | User session grouped by inactivity gap |

Handle **late data** with watermarks: define maximum acceptable lateness, drop or route late events to dead-letter.

---

## Batch vs Streaming Decision Refinement

```
Is real-time insight required?
├── Latency <100ms + complex joins/aggregations → Flink
├── Latency <1s + existing Spark cluster → Spark Structured Streaming
├── Latency <1s + Kafka-only transforms → Kafka Streams
├── Latency 1-60s + simple enrichment → Kafka consumer with micro-batch
└── Latency >60s → Batch (Airflow/Dagster scheduled jobs)
```

**Default to batch.** Only add streaming when latency requirements genuinely demand it. Streaming adds complexity in:
- State management (checkpointing, recovery)
- Error handling (dead-letter queues, poison pills)
- Testing (hard to reproduce timing-dependent bugs)
- Monitoring (consumer lag, backpressure)
