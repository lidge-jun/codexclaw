# Observability — OpenTelemetry, Logging, Tracing

**Last reviewed**: 2026-07-02

Production-grade observability patterns using the OpenTelemetry standard.

---

## Three Pillars

| Pillar | What | Backend Options |
|--------|------|-----------------|
| **Traces** | Distributed request flow | Jaeger, Grafana Tempo, Zipkin |
| **Metrics** | Quantitative measurements | Prometheus + Grafana |
| **Logs** | Contextual event records | Loki, ELK Stack, Uptrace |

---

## OpenTelemetry Setup

### Auto-Instrumentation (Node.js)
```typescript
// tracing.ts — import BEFORE any other module
import { NodeSDK } from "@opentelemetry/sdk-node"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_ENDPOINT }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: process.env.SERVICE_NAME,
})
sdk.start()
```

Auto-instruments: HTTP (Express/Fastify), database (pg, mongoose), Redis, gRPC.

### Auto-Instrumentation (Python)
```python
# opentelemetry-instrument command wraps your app
# pip install opentelemetry-distro opentelemetry-exporter-otlp
# opentelemetry-bootstrap -a install  # auto-detect and install instrumentors

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
import os

provider = TracerProvider()
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=os.environ["OTEL_EXPORTER_ENDPOINT"]))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
```

Auto-instruments: FastAPI, Django, SQLAlchemy, psycopg2, Redis, httpx, requests.

### Custom Spans
```typescript
import { trace, SpanStatusCode } from "@opentelemetry/api"
const tracer = trace.getTracer("payment-service")

async function processPayment(orderId: string, amount: number) {
  return tracer.startActiveSpan("processPayment", async (span) => {
    span.setAttributes({ "order.id": orderId, "payment.amount": amount })
    try {
      const result = await paymentGateway.charge(amount)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message })
      throw error
    } finally {
      span.end()
    }
  })
}
```

---

## Structured Logging

### Rules
1. **JSON only** in production — no free-text `console.log`
2. **Every entry** includes: `traceId`, `spanId`, `requestId`, `timestamp`, `level`
3. **Never log**: PII, secrets, full request/response bodies, stack traces in info/warn (send to error tracker)
4. **Log levels**: `error` (action needed) · `warn` (degraded) · `info` (business events) · `debug` (dev only)

### Recommended Libraries

| Language | Library | Why |
|----------|---------|-----|
| Node.js | **pino** | Fastest JSON logger, OTel integration via `pino-opentelemetry-transport` |
| Python | **structlog** | Structured logging with processors, OTel context injection |
| Go | **slog** (stdlib) | Built-in structured logging since Go 1.21 |

### Field Conventions (OTel Semantic Conventions)
```json
{
  "timestamp": "2026-07-20T10:30:00Z",
  "level": "error",
  "message": "Payment processing failed",
  "service.name": "payment-service",
  "trace.id": "abc123",
  "span.id": "def456",
  "http.request_id": "req-789",
  "error.type": "card_declined",
  "payment.id": "pay-001",
  "user.id": "usr-042"
}
```

### requestId Propagation

```typescript
// Middleware: generate or extract requestId
app.use((req, res, next) => {
  req.requestId = req.headers["x-request-id"] || crypto.randomUUID()
  res.setHeader("x-request-id", req.requestId)
  next()
})

// Inject into logger context (pino example)
app.use((req, res, next) => {
  req.log = logger.child({
    "http.request_id": req.requestId,
    "trace.id": trace.getActiveSpan()?.spanContext().traceId,
  })
  next()
})
```

---

## Distributed Tracing Basics

### Trace Context Propagation
- Use W3C Trace Context headers (`traceparent`, `tracestate`) — industry standard
- OTel SDK propagates automatically for HTTP/gRPC when auto-instrumented
- For message queues (Kafka, SQS): inject trace context into message headers

### Span Naming Conventions
```
HTTP:  GET /api/users/{userId}     (use route template, not actual IDs)
DB:    SELECT users                (operation + table, not full query)
Cache: redis.GET user:{id}         (operation + key pattern)
Queue: kafka.SEND orders.created   (operation + topic)
```

### When to Add Custom Spans
- Business-critical operations (payment processing, order fulfillment)
- External service calls not auto-instrumented
- CPU-intensive computations worth tracking
- **Don't over-instrument** — auto-instrumentation covers most cases

---

## Alerting Basics

| Signal | Alert On | Threshold |
|--------|----------|-----------|
| Error rate | 5xx responses | >1% of traffic over 5min |
| Latency | p95 response time | >500ms for API endpoints |
| Saturation | CPU/memory utilization | >80% sustained |
| Consumer lag | Kafka consumer offset | >10,000 messages behind |
| Error budget | SLO violation rate | <99.9% over rolling 30 days |

**Alert fatigue prevention:**
- Page only on customer-impacting issues (error rate, latency SLO breach)
- Use warning-level alerts for capacity planning (saturation approaching threshold)
- Suppress flapping alerts with debounce windows (alert fires only after N consecutive failures)

---

## Alerting Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| Alert on every error | Alert fatigue, ignored pages | Burn-rate alerting tied to SLO (see `dev-devops` `sre-foundations.md`) |
| Single-window threshold | Too many false positives | Multi-window: short (5m) AND long (1h) both fire |
| No SLO reference | Arbitrary thresholds | Derive alert threshold from SLO error budget |
| Duplicate alerts | Multiple pages for same incident | Dedup by service+symptom, not by signal |
| Missing runbook link | Responder guesses what to do | Every alert annotation includes runbook URL |

### Burn-Rate Alert Integration

For SLO-based alerting with burn rates, see `dev-devops/references/sre-foundations.md` §3.
This file owns the **code instrumentation** (OTel setup, spans, logging); `dev-devops` owns the
**alerting rules** (Prometheus rules, burn-rate formulas, error budget policy).

---

## Dashboard Design

### RED Method (Request-driven services)

| Signal | Metric | Dashboard Panel |
|--------|--------|----------------|
| **R**ate | `rate(http_requests_total[5m])` | Requests/sec time series |
| **E**rrors | `rate(http_requests_total{code=~"5.."}[5m])` | Error rate % |
| **D**uration | `histogram_quantile(0.99, http_request_duration_seconds_bucket)` | p50/p95/p99 latency |

### USE Method (Infrastructure resources)

| Signal | What | Example |
|--------|------|---------|
| **U**tilization | % time resource is busy | CPU usage, memory usage |
| **S**aturation | Queue depth / backlog | Goroutine count, connection pool wait |
| **E**rrors | Error count on resource | Disk I/O errors, network drops |

### Dashboard Rules

| Rule | Detail |
|------|--------|
| One dashboard per service | Don't mix unrelated services |
| RED on top row | Most important signals visible first |
| Time range | Default 1h, with 6h/24h/7d presets |
| Annotations | Deploy markers, incident markers |
| Variables | Service, environment, region dropdowns |

---

## Real User Monitoring (RUM) Basics

### What to Measure

| Metric | Source | Target |
|--------|--------|--------|
| LCP (Largest Contentful Paint) | Browser Performance API | < 2.5s |
| FID/INP (Interaction to Next Paint) | Browser | < 200ms |
| CLS (Cumulative Layout Shift) | Browser | < 0.1 |
| TTFB (Time to First Byte) | Server + network | < 800ms |
| JS Error rate | window.onerror / reportError | < 0.1% of sessions |

### Backend Correlation

```typescript
// Add trace context to RUM beacon
const beacon = {
  traceId: document.querySelector('meta[name="trace-id"]')?.content,
  lcp: lcpValue,
  inp: inpValue,
  cls: clsValue,
  url: location.pathname,
  userAgent: navigator.userAgent,
};
navigator.sendBeacon("/api/rum", JSON.stringify(beacon));
```

Link RUM data back to server traces via `traceId` for end-to-end latency attribution.

### Cross-Reference

- Alerting rules and SLO-based monitoring → `dev-devops/references/sre-foundations.md`
- Dashboard infrastructure and Grafana provisioning → `dev-devops/references/sre-foundations.md` §1
