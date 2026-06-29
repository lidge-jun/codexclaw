# SRE Foundations — SLO, Incident Response, Postmortem

Last reviewed: 2026-06-16
Applies to: Google SRE principles, 2026 observability practices
When to read: Production operations, incident response, SLO definition
Canonical owner: dev-devops §5

Cross-ref: read `platform-engineering.md` for DORA metrics and platform
engineering context before broad DevOps capability refreshes.

---

## §1 SLO/SLI Design Guide

### SLI Selection Principles

SLIs measure **user experience**, not infrastructure health.

| ❌ Wrong SLI | ✅ Right SLI |
|-------------|-------------|
| CPU utilization < 80% | Request success rate > 99.9% |
| Memory free > 2GB | p99 latency < 500ms |
| Disk IOPS < 5000 | Data freshness < 5 minutes |
| Pod restart count < 3 | Error rate < 0.1% |

### SLI by Service Type

| Service Type | Recommended SLIs |
|-------------|------------------|
| Request-driven (API) | Availability, latency (p50/p95/p99), error rate |
| Pipeline/batch | Freshness, correctness, throughput |
| Storage | Durability, availability, latency |
| Streaming | Throughput, end-to-end latency, message loss rate |

### SLO Definition

```yaml
# Example SLO definition (documentation format)
service: payments-api
slos:
  - name: availability
    sli: "successful requests / total requests"
    target: 99.9%
    window: 28 days (rolling)
    error_budget: 0.1% (≈ 40 minutes/28 days)

  - name: latency
    sli: "requests completing within 500ms / total requests"
    target: 99.0%
    window: 28 days (rolling)

  - name: error-rate
    sli: "5xx responses / total responses"
    target: "< 0.1%"
    window: 28 days (rolling)
```

### Population Definition Checklist

- [ ] Which endpoints are included? (all API routes? only customer-facing?)
- [ ] Which regions count? (global or per-region SLO?)
- [ ] How are retries handled? (count each attempt or only final result?)
- [ ] Are health checks excluded from SLI calculation?
- [ ] Are internal/admin endpoints excluded?

---

## §2 Error Budget Policy

### 3-Stage Policy Template

```
┌─────────────────────────────────────────────────┐
│ NORMAL (budget > 50%)                           │
│ → Standard release velocity                     │
│ → Routine monitoring                            │
│ → Normal on-call rotation                       │
├─────────────────────────────────────────────────┤
│ ACCELERATED BURN (budget 20-50%)                │
│ → Heightened alerting thresholds                │
│ → Reliability triage before new features        │
│ → Reduced release frequency                    │
│ → Team standup includes budget status           │
├─────────────────────────────────────────────────┤
│ EXHAUSTED (budget ≤ 0%)                         │
│ → FEATURE FREEZE (security/bugfix only)         │
│ → Next sprint: reliability work only            │
│ → Exception requires VP-level approval          │
│ → Postmortem mandatory for contributing events  │
└─────────────────────────────────────────────────┘
```

### Escalation Triggers

| Trigger | Action |
|---------|--------|
| Single incident consumes >20% budget | Mandatory postmortem + P1 action items |
| Two consecutive window misses | Structural problem; architecture review |
| Budget exhausted for 2+ windows | Executive escalation; team capacity review |

---

## §3 Burn-Rate Alerting

### Multi-Window Alert Design

Traditional threshold alerts fire too often (alert fatigue) or too late.
Burn-rate alerts use the SLO itself as the reference.

| Alert Type | Burn Rate | Time to Exhaust | Window | Action |
|-----------|-----------|-----------------|--------|--------|
| Fast burn | 14.4× | ~2 hours (of 28-day budget) | 1h long, 5m short | **Page** (wake someone up) |
| Slow burn | 6× | ~5 days | 6h long, 30m short | **Ticket** (next business day) |

### Formula

```
error_rate = errors / total_requests
burn_rate = error_rate / (1 - SLO)

Alert fires when:
  burn_rate(short_window) > threshold
  AND
  burn_rate(long_window) > threshold
```

### Prometheus Example

```yaml
# Fast burn alert (page)
- alert: PaymentsHighBurnRate
  expr: |
    (
      sum(rate(http_requests_total{service="payments",code=~"5.."}[5m]))
      / sum(rate(http_requests_total{service="payments"}[5m]))
    ) > 14.4 * (1 - 0.999)
    AND
    (
      sum(rate(http_requests_total{service="payments",code=~"5.."}[1h]))
      / sum(rate(http_requests_total{service="payments"}[1h]))
    ) > 14.4 * (1 - 0.999)
  for: 2m
  labels:
    severity: page
  annotations:
    summary: "Payments API burning error budget at 14.4x rate"
```

### Anti-Patterns

| Banned | Fix |
|--------|-----|
| Alert on every 5xx | Burn-rate multi-window |
| Single-window alert | Dual-window (short AND long) |
| No SLO reference in alert | Alert threshold derived from SLO |

---

## §4 Incident Response Playbook

### Role Definitions

| Role | Responsibilities |
|------|-----------------|
| IC (Incident Commander) | Coordinate response, delegate tasks, make decisions |
| Primary Responder | Diagnose and fix; technical execution |
| Comms Lead | Status updates to stakeholders, status page |
| Scribe | Timeline documentation, action item tracking |

### Incident Lifecycle

```
0min   Alert fires → acknowledge
5min   Declare incident → assign IC → open channel
10min  IC assigns roles → begin diagnosis
15min  First status update (S1: every 15min, S2: every 30min)
N min  Stabilize (mitigation > diagnosis during active incident)
N+M    Root cause identified → permanent fix planned
5 days Postmortem completed and shared
```

### Severity Definitions

| Severity | Impact | Response |
|----------|--------|----------|
| S1 | Full service outage, revenue impact | IC mandatory, 15min updates, all-hands |
| S2 | Major feature broken, significant user impact | IC recommended, 30min updates |
| S3 | Partial degradation, workaround available | Assignee handles, async updates |

### Key Principle

> **Mitigation first, diagnosis second** during active incidents.
> Stop the bleeding before understanding the wound.

---

## §5 Blameless Postmortem Template

```markdown
# Postmortem: [Title]

**Date**: YYYY-MM-DD
**Severity**: S1/S2/S3
**Duration**: HH:MM (detect → resolve)
**IC**: @name
**Author**: @name

## User Impact
- Affected: N% of users for M minutes
- Revenue impact: estimated $X (if applicable)
- Support tickets: N

## Timeline
| Time (UTC) | Event |
|-----------|-------|
| HH:MM | Alert fired: [alert name] |
| HH:MM | IC assigned, incident channel opened |
| HH:MM | Root cause identified: [brief] |
| HH:MM | Mitigation applied: [action] |
| HH:MM | Service fully restored |

## Detection Gap
- How could we have detected this sooner?
- Was monitoring adequate? What was missing?

## Contributing Factors (NOT "Root Cause")
1. [Factor 1]: [description]
2. [Factor 2]: [description]

## What Went Well
- [positive aspect of the response]

## What Could Be Improved
- [improvement area]

## Action Items
| Item | Owner | Due | Priority |
|------|-------|-----|----------|
| Add circuit breaker to payment gateway | @engineer | YYYY-MM-DD | P1 |
| Improve alert coverage for [gap] | @sre | YYYY-MM-DD | P2 |
| Update runbook with new failure mode | @oncall | YYYY-MM-DD | P2 |
```

### Postmortem Rules

| Rule | Detail |
|------|--------|
| Blameless | Focus on systems, not individuals |
| Timeline accuracy | Use logs/metrics, not memory |
| Action items | Specific, owned, dated, prioritized |
| Follow-through | Review action items in next team sync |
| Required for | All S1, all S2, any event consuming >20% error budget |

---

## §6 Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| Infrastructure-only SLIs | "Server CPU is fine" while users see errors | User-experience-based SLIs |
| SLO without consequences | SLO exists on paper but nobody acts on breaches | Error budget policy with freeze gate |
| Too many SLIs (>5/service) | Dashboard overload, unclear priority | 2-4 meaningful SLIs per service |
| Page on every deviation | Alert fatigue, ignored alerts | Burn-rate multi-window alerting |
| Blame individuals | Engineers hide mistakes, no systemic improvement | Blameless postmortem culture |
| No error budget policy | SLO violations have no defined response | Define 3-stage policy |
| Postmortem without action items | Theater; same incidents repeat | Specific, owned, tracked items |
