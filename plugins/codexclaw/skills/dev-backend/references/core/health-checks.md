# Health Checks & Readiness Probes

Every backend service MUST expose:

## Liveness — `GET /health`

```json
{ "status": "ok" }
```

Always returns 200 unless the process is crashed. Use for Kubernetes liveness probes and load balancer health checks.

## Readiness — `GET /ready`

```json
{ "status": "ready", "checks": { "db": "ok", "redis": "ok", "queue": "ok" } }
```

Checks all dependencies are reachable. Returns 503 if any check fails. Use for Kubernetes readiness probes and deploy gating.

## Startup — `GET /health/startup` (optional)

```json
{ "status": "started", "uptime": 12.5, "version": "1.2.3", "commit": "abc1234" }
```

Verifies initial warmup is complete (cache primed, connections established). Use for slow-starting services.

## Rules

- Health endpoints do NOT require authentication
- Health endpoints do NOT log every request (noise in production)
- Database check: `SELECT 1`, not a full query
- Redis check: `PING`, not a read/write cycle
- Timeout per dependency check: 2s max, fail fast
- Include version/commit SHA in startup response for deploy verification
- Never expose internal error details in health responses
