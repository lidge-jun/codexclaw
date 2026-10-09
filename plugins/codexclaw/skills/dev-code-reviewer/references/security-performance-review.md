## 3.5 Security Review Quick-Check

For every review, scan these OWASP-aligned red flags.

### Must-Check Every PR

| Check | Red Flag | Severity |
|-------|----------|----------|
| Hardcoded secrets | API keys, passwords, tokens, or DB URLs in source | **Critical** |
| Injection | User-controlled strings composed into SQL, NoSQL, shell, or templates | **Critical** |
| Missing validation | Untrusted input reaches logic without schema/content checks | **High** |
| Missing auth/authz | Endpoint lacks authentication or permission enforcement | **High** |
| BOLA / ownership | Object access does not verify caller ownership | **High** |
| Sensitive logging | Tokens, passwords, credentials, or private payloads enter logs | **High** |

### Conditional Checks

| Check | Trigger | Red Flag |
|-------|---------|----------|
| SSRF | User controls an outbound URL | No allowlist or host/protocol validation |
| Path traversal | User controls a file path | No canonicalization or containment check |
| Mass assignment | Request object populates a model | No explicit field allowlist |
| Dependency audit | Dependencies are added or updated | No repo-native vulnerability audit |
| Lockfile | Lockfile changes | Unexpected or unexplained resolution changes |

Load `dev-security` for deep analysis. Security routing is required when the diff
touches auth, credentials, untrusted input, sensitive data, dependencies, agent
tools, or trust boundaries.

---

## 3.6 Performance Review Quick-Check

Scan every PR for these common performance pitfalls:

### Database & API

| Check | Red Flag | Fix |
|-------|----------|-----|
| N+1 queries | Loop containing DB call or API fetch | Batch with `WHERE IN (...)` or DataLoader |
| Missing pagination | `.findAll()` or `SELECT *` without LIMIT | Add cursor-based or offset pagination |
| Missing index | New WHERE/JOIN column without index | `CREATE INDEX` on filtered/joined columns |
| Unbounded query | No LIMIT on user-facing list endpoints | Always set max page size |

### Frontend-Specific

| Check | Red Flag | Fix |
|-------|----------|-----|
| Measured expensive re-renders | Profiler identifies repeat work | Check Compiler activation and state ownership first; use manual memoization only where still useful |
| Bundle size impact | New large dependency (>50KB gzipped) | Check `bundlephobia.com`, consider alternatives or lazy loading |
| Missing `key` prop | List rendering without stable keys | Use unique ID, never array index for dynamic lists |
| Unoptimized images | Large images without `next/image`, `loading="lazy"`, or srcset | Use framework image optimization |

### General

| Check | Red Flag | Fix |
|-------|----------|-----|
| Missing timeout | External HTTP call without timeout | Set timeout on all network requests |
| Sync blocking | CPU-intensive work on main thread/event loop | Offload to worker/queue |
| Memory leak | Event listeners/subscriptions without cleanup | Add cleanup in `useEffect` return / `finally` block |
