## §5 SRE Foundations

### §5.1 SLO/SLI (DEFAULT)

| SLI | Measurement | Typical SLO |
|-----|-------------|-------------|
| Availability | Success requests / total | 99.9% (28-day rolling) |
| Latency | p50/p95/p99 response time | p99 < 500ms |
| Error rate | 5xx / total | < 0.1% |
| Freshness | Data update delay | < 5min (pipelines) |

SLIs measure **user experience**, not infrastructure metrics. "CPU is fine ≠ users are fine."

Error budget = 1 − SLO (99.9% → 0.1% budget).

**DORA 2025 (verified 2026-07-02):** AI acts as an *amplifier* — returns depend on the underlying sociotechnical system. For AI-agent-heavy delivery invest in golden paths, guardrails, observability, provenance, and review gates.

### §5.2 Error Budget Policy (DEFAULT)

| Budget State | Action |
|-------------|--------|
| Normal (>50%) | Continue releases, routine monitoring |
| Accelerated burn (20–50%) | Heightened alerts, slow releases, reliability triage |
| **Exhausted (≤0%)** | **Feature freeze** — security/bugfix only; VP exception required |

Single incident consuming >20% → mandatory postmortem.
Two consecutive window misses → architecture review.

### §5.3 Incident Response (DEFAULT)

1. **Detect** → **Triage** (S1/S2/S3) → **Stabilize** → **Fix** → **Postmortem**
2. Roles: IC, Primary Responder, Comms Lead, Scribe
3. **Mitigation first, diagnosis second** during active incidents
4. All S1/S2 → mandatory blameless postmortem within 5 business days
5. Status updates: S1 every 15min, S2 every 30min

### §5.4 Runbook Template (HEURISTIC)

```markdown
## [Service] — [Symptom]
### Diagnosis
1. Logs: `kubectl logs -l app=<name> --tail=100`
2. Metrics: Grafana → [dashboard URL]
3. Dependencies: `curl -s http://<dep>/health | jq .`
### Emergency Mitigation
1. Rollback: `argocd app rollback <app>`
2. Traffic block: ...
### Root Fix
1. ...
### Escalation
- Owner: @team-sre
- PagerDuty: [policy]
```

### §5.5 Anti-Patterns

| Banned | Fix |
|--------|-----|
| Infrastructure-only SLIs | User-experience-based SLIs |
| SLO without consequences | Error budget policy with freeze gate |
| Too many SLIs (>5 per service) | 2-4 meaningful SLIs |
| Page on every deviation | Burn-rate multi-window alerting |
| Blame individuals | Blameless postmortem, system improvement |
| No error budget policy | Define 3-stage policy (normal/accelerated/exhausted) |
