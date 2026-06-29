# Blameless Postmortem Template

Use after resolving any incident that was customer-impacting, took >1 hour to
diagnose, involved 3+ failed fix attempts, or revealed a systemic issue.
**Purpose**: Learning, not blame. Produce at least one action item per postmortem.

---

## Incident: [Title]

**Date**: YYYY-MM-DD | **Duration**: Xh Ym | **Severity**: P0/P1/P2 | **Author**: [name]

### Summary

[2-3 sentences: what happened, who was affected, what was the impact]

### Timeline

| Time | Event |
|------|-------|
| HH:MM | First symptom / detection |
| HH:MM | Investigation started |
| HH:MM | Root cause identified |
| HH:MM | Mitigation applied |
| HH:MM | Permanent fix deployed, verified resolved |

### Root Cause

[Be specific — not "server error" but "missing null check in session middleware
caused TypeError when Redis timed out, returning 500 for all authenticated requests."]

### Contributing Factors

1. [Factor that made the bug possible]
2. [Factor that delayed detection]
3. [Factor that complicated resolution]

### What Went Well / Poorly

- Well: [detection speed, collaboration, tooling...]
- Poorly: [delayed detection, wrong hypothesis, missing tooling...]

### Action Items

| Action | Owner | Deadline | Status |
|--------|-------|----------|--------|
| [Preventive — stop this bug class] | @name | YYYY-MM-DD | ⬜ |
| [Detective — catch it faster] | @name | YYYY-MM-DD | ⬜ |

### Lessons Learned

[What assumption was wrong? How does this change our mental model?]

---

## Example: Profile updates return stale data for 30% of users

**Date**: 2026-03-15 | **Duration**: 2h 45m | **Severity**: P1 | **Author**: Jun

**Summary**: After deploying v2.4.1, ~30% of users saw stale profile data.
PUT /api/profile returned 200 correctly, but GET /api/dashboard returned
pre-update values for users routed to read replicas.

| Time | Event |
|------|-------|
| 14:00 | v2.4.1 deployed |
| 14:22 | First user report: "My name didn't update" |
| 14:42 | Diagnostic logging → DB query returns stale data |
| 14:55 | Root cause: dashboard query moved to read replica without consistency |
| 15:05 | Mitigation: route dashboard reads to primary |
| 16:45 | Fix deployed: read-after-write consistency for profile queries |

**Root Cause**: v2.4.1 moved dashboard query to a read replica for performance.
Replication lag (100-500ms) meant writes hadn't propagated when users immediately
loaded the dashboard.

**Contributing Factors**: (1) No read-after-write consistency policy, (2) No
integration test for update-then-read, (3) No replication lag alerting.

**Well**: Report triaged in 8 min; boundary logging pinpointed layer fast.
**Poorly**: Change reviewed without considering consistency; no canary deployment.

| Action | Owner | Status |
|--------|-------|--------|
| Add `readFromPrimary` for post-write queries | @backend | ✅ |
| Integration test: update → read → assert fresh | @testing | ✅ |
| Replica lag alert at >1s | @infra | ⬜ |

**Lesson**: Moving a query to a replica looked safe ("it's just a read"). We didn't
consider the write-then-read sequence. Rule: any read following a user-initiated
write must use the primary or wait for replica acknowledgment.
