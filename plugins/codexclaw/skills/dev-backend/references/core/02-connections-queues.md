### Long-Lived Connection Operation

Rules for SSE, WebSocket, and any connection held open beyond a single request-response cycle.

**Lifecycle examples (HEURISTIC):** tune these to protocol version, proxy limits,
capacity and product needs. The common six-connection browser limit concerns HTTP/1.x;
HTTP/2 stream limits are negotiated. These values are not universal failure thresholds.

| Parameter | Default | Rationale |
|-----------|---------|-----------|
| Heartbeat interval | 15-30s | Detect dead connections before TCP timeout (varies by proxy) |
| Reconnection backoff | Exponential 1s-30s with jitter | Prevent thundering herd on server restart |
| Max connection duration | 1h (SSE), 24h (WebSocket) | Force reconnect to rebalance and prevent memory leaks |
| Connections per client | Cap at 6 (SSE) or 1-2 (WebSocket) | Browser limits + server memory budget |

**Server-Side Requirements:**

- **Connection registry:** Track all active connections in-memory (Map by client/session ID). Required for graceful drain and debugging.
- **Graceful drain on deploy:** Stop accepting new connections → send "reconnect" frame to existing → wait drain timeout → close.
- **Memory budget:** Allocate max memory per connection (e.g., 2KB buffer). Monitor total; reject new connections when approaching limit.
- **Backpressure:** If client stops consuming, buffer up to N messages then drop oldest or disconnect.

**Pattern — "202 + Job ID" for Long Operations:**

Instead of holding a connection open for a slow operation:
```
POST /generate → 202 { jobId: "j_abc123" }
GET /jobs/j_abc123 → { status: "processing", progress: 0.6 }
                   → { status: "complete", result: {...} }
```
Use SSE/WebSocket only for push notifications about job status — not for the operation itself.

**Banned:**

| Banned | Fix |
|--------|-----|
| Unbounded connections (no cap, no registry) | Connection registry + cap per client + global max |
| No heartbeat (rely on TCP keepalive only) | Application-level heartbeat every 15-30s |
| Blocking event loop per connection (sync work in message handler) | Offload to worker thread or queue; handler stays async |
| Holding connection open for >5s synchronous work | Return 202 + job ID; notify via push when done |
| No reconnection logic on client side | Implement exponential backoff with jitter |

### Server Runtime Safety (DEFAULT)

**Rule (BACKEND-RUNTIME-01):** Production server runtimes set explicit read, write, request/idle, and graceful-shutdown timeouts; drain on SIGTERM/deploy by stopping new accepts, letting in-flight work finish within the shutdown budget, then closing; and propagate the request ID from ingress into structured logs, traces, queued work, and outbound calls where the stack supports it.

---

### Async Task Queue Patterns

When work exceeds what an HTTP response cycle should hold open, use a queue.

**Decision: Queue vs Direct:**

| Condition | Use Queue | Use Direct |
|-----------|-----------|------------|
| Work exceeds the actual request/proxy budget (5s is only an example) | Usually | Streaming/bounded synchronous work may be appropriate |
| Must be retryable on failure | Yes | No |
| Fire-and-forget (caller doesn't wait) | Yes | No |
| <1s, idempotent, caller needs immediate result | No | Yes |
| Real-time user-facing validation | No | Yes |

**Pattern — Accept, Queue, Notify:**

```
1. Client  → POST /tasks       → Server validates, enqueues
2. Server  → 202 { jobId }     → Client receives immediately
3. Worker  → picks from queue  → executes task
4. Client  → GET /tasks/{id}   → polls status (or receives webhook/SSE push)
5. Worker  → completes         → writes result, triggers notification
```

**Queue Selection Guide:**

| Queue | When | Notes |
|-------|------|-------|
| **BullMQ** (Redis) | Node.js, need retries + priorities + rate limiting | Most mature Node queue; requires Redis |
| **Celery** (Redis/RabbitMQ) | Python, distributed workers, periodic tasks | De facto Python standard |
| **pg-boss** (PostgreSQL) | Node.js, already have Postgres, moderate scale | No extra infra; SKIP_LOCKED-based |
| **Simple DB queue** (polling) | Small scale (<100 jobs/min), any language | `status` column + `SELECT FOR UPDATE SKIP LOCKED` |
| **SQS / Cloud Tasks** | Serverless, managed, very high scale | No infra to manage; at-least-once delivery |
| **Temporal** | Durable multi-step workflows: sagas, human-in-loop, long-running AI/business processes | Workflow engine, NOT a default queue replacement |

**Required Safeguards:**

| Safeguard | Rule |
|-----------|------|
| Idempotency key | Every enqueue call must include a unique idempotency key; dedup on insert |
| Dead letter queue (DLQ) | Failed 3x (configurable) → move to DLQ → alert → manual review |
| Max retries | Set explicit limit (default: 3); exponential backoff between attempts |
| Timeout per job | Every job has a max execution time; kill and retry on exceed |
| Visibility timeout | Lock duration > expected execution time; prevent duplicate processing |
| Observability | Emit metrics: queue depth, processing time p95, DLQ size, failure rate |

**Banned:**

| Banned | Fix |
|--------|-----|
| Long work exceeds the declared request budget or blocks the event loop | Queue, stream, or isolate according to the actual contract; 5s is not a universal cutoff |
| Queue without DLQ | Always configure DLQ; alert on DLQ depth > 0 |
| Infinite retries (no max) | Set maxRetries=3 with exponential backoff |
| No idempotency (duplicate jobs on retry) | Idempotency key on every enqueue; dedup in worker |
| No timeout on job execution | Set per-job timeout; kill + mark failed on exceed |
| Polling without backoff (tight loop) | Poll with interval (1-5s) or use blocking pop / push notification |

---
