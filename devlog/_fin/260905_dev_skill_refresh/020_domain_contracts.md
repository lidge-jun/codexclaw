# wp2 — exact change plan

Dependency: wp1 common policy.

Scope: only the files and changes below. Re-read against the current tree at P; amend before writing if stale. Existing audit is historical evidence and is not rewritten.

Verification: `node --test plugins/codexclaw/test/manifest-policy.test.mjs` (baseline 6/6 pass, reads skill metadata); YAML parsing over changed SKILL.md files; `git diff --check`. Semantic verification uses independent read-only scenario judgments, not prose phrase assertions.

## 1. MODIFY plugins/codexclaw/skills/dev-architecture/SKILL.md

Before:

`````text
Severity mapping (dev §0.2): `Severity: CRITICAL`/`HIGH` ⇒ STRICT; `MEDIUM` ⇒ DEFAULT.
`````

After:

`````text
Severity describes impact only when backed by a concrete failure. Style, coupling
heuristics, and size limits follow `dev` §0.2 DEFAULT exceptions; uppercase severity
alone does not turn a structural preference into a safety gate.
`````

## 2. MODIFY plugins/codexclaw/skills/dev-architecture/SKILL.md

Before:

`````text
**Rule:** Validation and defensive checks belong ONLY at system boundaries. Internal module boundaries MUST trust their callers.
`````

After:

`````text
**Rule:** Parse untrusted data at trust boundaries and avoid repeating shape validation
inside one trusted typed boundary. Domain invariants (valid ranges, state transitions,
relational constraints) belong to the domain owner even for in-process callers.
Authorization and assertions for genuinely reachable invalid states remain allowed.
`````

## 3. MODIFY plugins/codexclaw/skills/dev-architecture/SKILL.md

Before:

`````text
| Validation in domain entity constructor for in-process callers | Entities should be created from validated data | Validate at boundary, trust domain layer |
`````

After:

`````text
| Repeating the same input shape parser in every domain constructor | Duplicates a trusted ingress contract | Parse shape once; enforce domain invariants in the entity/value-object owner |
`````

## 4. MODIFY plugins/codexclaw/skills/dev-architecture/SKILL.md

Before:

`````text
| Runtime type checks in typed language internals | Duplicates compiler work, adds noise | Trust the type system |
`````

After:

`````text
| Repeated runtime shape checks on already validated trusted values | Adds noise without a new boundary | Trust the parsed shape; retain domain invariants and reachable-state checks |
`````

## 5. MODIFY plugins/codexclaw/skills/dev-architecture/SKILL.md

Before:

`````text
| `assert(x !== null)` in module-internal code | If x can be null, fix the type; if it can't, the assert is noise | Fix type signature or remove assert |
`````

After:

`````text
| Assertions on a state proven impossible by the actual contract | Distracts from reachable failures | Fix types where sufficient; retain assertions for real domain/state constraints |
`````

## 6. MODIFY plugins/codexclaw/skills/dev-architecture/SKILL.md

Before:

`````text
| **Internal function params** | **NO** | Caller is trusted code you control | Type system handles this |
`````

After:

`````text
| **Internal function params** | No repeated shape parsing; domain constraints may apply | Types prove shape, not every business invariant | Domain owner checks start <= end |
`````

## 7. MODIFY plugins/codexclaw/skills/dev-architecture/references/circular-dependencies.md

Before:

`````text
Rust's module system prevents circular dependencies at compile time. No detection tooling needed.
`````

After:

`````text
Distinguish Cargo package dependency cycles from references between Rust modules.
Do not claim that compiling proves an acyclic architectural module graph. Use the
repository's dependency rules or inspect module edges when that property matters.
`````

## 8. MODIFY plugins/codexclaw/skills/dev-architecture/references/circular-dependencies.md

Before:

`````text
2. Run full test suite — ensure no behavioral regression
`````

After:

`````text
2. Run the affected tests/checks at the depth required by `dev` §3; respect explicit execution constraints
`````

## 9. MODIFY plugins/codexclaw/skills/dev-code-reviewer/SKILL.md

Before:

`````text
| >500 lines | Blocking review finding unless already being split in this diff |
`````

After:

`````text
| >500 lines | Strong review signal; not a blocker by size alone. Accept a documented cohesion/risk rationale |
`````

## 10. MODIFY plugins/codexclaw/skills/dev-code-reviewer/SKILL.md

Before:

`````text
| Unused exports | `ts-prune`, `knip`, grep for import sites | Remove export; delete if no internal use |
`````

After:

`````text
| Unused exports | `ts-prune`, `knip`, consumer search | Remove scoped internal dead exports; public contracts require compatibility review before removal |
`````

## 11. MODIFY plugins/codexclaw/skills/dev-code-reviewer/SKILL.md

Before:

`````text
| Unnecessary re-renders | State updates in parent causing child re-render cascade | `React.memo`, `useMemo`, extract state down |
`````

After:

`````text
| Measured expensive re-renders | Profiler identifies repeat work | Check Compiler activation and state ownership first; use manual memoization only where still useful |
`````

## 12. MODIFY plugins/codexclaw/skills/dev-code-reviewer/SKILL.md

Before:

`````text
Run repo-native lint, type checks, and tests first.
`````

After:

`````text
Run the smallest repo-native checks that observe the requested review scope.
Docs-only reviews use document/contract checks; a diagnostic review does not authorize
installs, product changes, or a repository-wide suite prohibited by the user.
`````

## 13. MODIFY plugins/codexclaw/skills/dev-debugging/SKILL.md

Before:

`````text
Complete root cause investigation before proposing any fix.
If Phase 1 is not done, keep investigating.
`````

After:

`````text
Before a permanent fix, investigate and explain the cause. During an active incident,
an already-authorized, reversible mitigation may precede full RCA; follow `dev-devops`
incident policy and preserve evidence. Diagnosis alone never authorizes a code fix,
rollback, production access, or an upstream issue submission.
`````

## 14. MODIFY plugins/codexclaw/skills/dev-debugging/SKILL.md

Before:

`````text
3. **Verify**: the test passes, no regressions (run the full test suite:
   `npm test` / `pytest` / equivalent).
`````

After:

`````text
3. **Verify**: reproduce the repaired behavior and run affected checks at the
   `dev` §3 / `dev-testing` risk floor. Respect user restrictions on local suites.
`````

## 15. MODIFY plugins/codexclaw/skills/dev-debugging/SKILL.md

Before:

`````text
   the codebase? Search for it. Fix all instances, not just the one you found.
`````

After:

`````text
   the codebase? Search for it. Fix instances within the authorized scope; report
   additional affected areas rather than silently expanding the patch.
`````

## 16. MODIFY plugins/codexclaw/skills/dev-debugging/SKILL.md

Before:

`````text
| Claiming "fixed" without running verification | Run full test suite, show green output, verify the original symptom |
`````

After:

`````text
| Claiming "fixed" without running verification | Run the relevant checks, show output, and verify the original symptom |
`````

## 17. MODIFY plugins/codexclaw/skills/dev-debugging/SKILL.md

Before:

`````text
- **Undocumented library behavior** — file an issue upstream, work around it
`````

After:

`````text
- **Undocumented library behavior** — document evidence; propose an upstream report or scoped workaround without posting externally unless authorized
`````

## 18. MODIFY plugins/codexclaw/skills/dev-debugging/SKILL.md

Before:

`````text
For security-sensitive bugs (auth bypass, data leak, injection), follow the incident response in `dev-security/SKILL.md` before applying a fix.
`````

After:

`````text
For security-sensitive bugs (auth bypass, data leak, injection), use `dev-security` for
controls and `dev-devops` for incident response. Preserve the same authorization boundary.
`````

## 19. MODIFY plugins/codexclaw/skills/dev-backend/SKILL.md

Before:

`````text
- [ ] Consistent response envelope on every endpoint
`````

After:

`````text
- [ ] Existing/protocol response contract preserved; shared envelope only where applicable (§5)
`````

## 20. MODIFY plugins/codexclaw/skills/dev-backend/SKILL.md

Before:

`````text
- [ ] Error handler returns proper HTTP codes via `AppError` hierarchy
`````

After:

`````text
- [ ] Error handler preserves the repository's error convention and correct HTTP mapping; AppError is one optional pattern
`````

## 21. MODIFY plugins/codexclaw/skills/dev-backend/SKILL.md

Before:

`````text
Create an AppError base class with statusCode, code, and isOperational properties. Extend for each error type (ValidationError, NotFoundError, etc.).
`````

After:

`````text
If the repository chooses AppError, a base class may carry statusCode, code, and
isOperational. Do not introduce a parallel hierarchy into an established Result/error model.
`````

## 22. MODIFY plugins/codexclaw/skills/dev-backend/SKILL.md

Before:

`````text
**Rule:** Use `Result` where recoverable/domain errors are first-class. Reserve `try/catch` for error boundaries (middleware, top-level handlers) only.
`````

After:

`````text
Use Result only when selected for this repository. Otherwise propagate errors to a
clear handling boundary; do not add wrappers or change public error contracts by preference.
`````

## 23. MODIFY plugins/codexclaw/skills/dev-backend/SKILL.md

Before:

`````text
**Lifecycle Rules:**
`````

After:

`````text
**Lifecycle examples (HEURISTIC):** tune these to protocol version, proxy limits,
capacity and product needs. The common six-connection browser limit concerns HTTP/1.x;
HTTP/2 stream limits are negotiated. These values are not universal failure thresholds.
`````

## 24. MODIFY plugins/codexclaw/skills/dev-backend/SKILL.md

Before:

`````text
| Execution time >5s | Yes | No |
`````

After:

`````text
| Work exceeds the actual request/proxy budget (5s is only an example) | Usually | Streaming/bounded synchronous work may be appropriate |
`````

## 25. MODIFY plugins/codexclaw/skills/dev-backend/SKILL.md

Before:

`````text
| Synchronous long operation blocking HTTP response (>5s) | Enqueue + return 202 + job ID |
`````

After:

`````text
| Long work exceeds the declared request budget or blocks the event loop | Queue, stream, or isolate according to the actual contract; 5s is not a universal cutoff |
`````

## 26. MODIFY plugins/codexclaw/skills/dev-data/SKILL.md

Before:

`````text
- Data APIs serving frontend dashboards must use the standard response envelope (`dev-backend` §5)
`````

After:

`````text
- Data APIs preserve the existing/protocol contract and its exceptions (`dev-backend` §5); do not wrap GraphQL, gRPC, SSE, or an established API just to match a sample envelope
`````

## 27. MODIFY plugins/codexclaw/skills/dev-data/SKILL.md

Before:

`````text
- Every query that runs in production: EXPLAIN ANALYZE before deploy
`````

After:

`````text
- Start query investigation with non-executing EXPLAIN. EXPLAIN ANALYZE actually executes
  the statement, including writes and possible function/external side effects. Use it
  only with authorized execution on representative isolated data and a resource budget.
  A rollback does not undo every possible external effect; never treat ANALYZE as a
  read-only diagnostic. See the PostgreSQL EXPLAIN documentation for the pinned version.
`````

## 28. MODIFY plugins/codexclaw/skills/dev-data/SKILL.md

Before:

`````text
| **Speed (groupby/join)** | Baseline | 5-10x faster | Matches Polars on SQL-native |
`````

After:

`````text
| **Speed (groupby/join)** | Measure on representative input | Depends on expressions, data and execution mode | Depends on SQL plan, data and memory budget |
`````

## 29. MODIFY plugins/codexclaw/skills/dev-data/SKILL.md

Before:

`````text
❌ Fail: If any check fails, write to error log with row details. Don't silently drop.
`````

After:

`````text
❌ Fail: Quarantine invalid rows under the dataset's access/retention policy; log redacted identifiers and diagnostics, not raw PII. Don't silently drop.
`````

## 30. MODIFY plugins/codexclaw/skills/dev-scaffolding/SKILL.md

Before:

`````text
| Python     | `kebab-case/` | `name_tool.py` | `test_name.py` | `__init__.py`          |
`````

After:

`````text
| Python     | `package_name/` | `name_tool.py` | `test_name.py` | `__init__.py`          |
`````

## 31. MODIFY plugins/codexclaw/skills/dev-scaffolding/SKILL.md

Before:

`````text
| Folders             | kebab-case            | `stock-price/`, `user-auth/` |
`````

After:

`````text
| Repository folders | Follow existing convention; kebab-case is a JS/TS sample | `stock-price/` |
| Importable packages | Follow language identifiers; no hyphens in normal Python imports | `stockprice/`, `stock_price/` |
`````

## 32. MODIFY plugins/codexclaw/skills/dev-scaffolding/SKILL.md

Before:

`````text
After scaffolding, verify the result is usable — do not claim done from
structural inspection alone:
`````

After:

`````text
Apply the following only to a runnable project scaffold and only for supported commands.
Documentation scaffolds use link/structure/contract checks; module scaffolds use affected
checks. Do not install dependencies, start servers, or run a broad suite merely to validate prose.
For a runnable scaffold, verify usability within the authorized environment:
`````

## 33. MODIFY plugins/codexclaw/skills/dev-devops/SKILL.md

Before:

`````text
Severity mapping: `CRITICAL`/`HIGH` ⇒ STRICT; `MEDIUM` ⇒ DEFAULT (aligned with `dev` §0.2).
`````

After:

`````text
Severity and rule authority are distinct (`dev` §0.2). Safety/correctness and release
proof remain mandatory; architecture/tool preferences need project-specific justification.
`````

## 34. MODIFY plugins/codexclaw/skills/dev-devops/SKILL.md

Before:

`````text
CRITICAL/HIGH findings → block push. No exceptions. Read
`````

After:

`````text
CRITICAL/HIGH image findings block push under this image policy. General checklist
exception language does not waive this gate: changing it needs a separately approved,
predeclared security policy, never an exception invented in the failing release report. Read
`````

## 35. MODIFY plugins/codexclaw/skills/dev-devops/SKILL.md

Before:

`````text
Delivery repositories accumulate dead refs, and the cost is not disk.
`````

After:

`````text
This section guides explicitly requested branch-lifecycle work. A review or routine
feature change does not authorize changing host settings, creating scheduled jobs,
or deleting refs. Propose missing automation first; enact it only when authorized.

Delivery repositories accumulate dead refs, and the cost is not disk.
`````

## 36. MODIFY plugins/codexclaw/skills/dev-security/SKILL.md

Before:

`````text
See `references/asvs-checklist.md` V2 and V3 before deploy.
`````

After:

`````text
See `references/asvs-checklist.md` for the local release checklist and the distinction
from formal ASVS 5.0.0 evidence (Authentication V6, Session Management V7).
`````

## 37. MODIFY plugins/codexclaw/skills/dev-security/SKILL.md

Before:

`````text
- [ ] Browser tokens live in `httpOnly`, `secure`, `sameSite` cookies; keep session tokens out of `localStorage`.
`````

After:

`````text
- [ ] Browser session tokens use an appropriate httpOnly/secure/SameSite cookie strategy; keep session tokens out of localStorage. For cookie-authenticated state changes, verify framework CSRF protection or an appropriate token/origin/Fetch-Metadata defense; SameSite alone is not sufficient in most deployments.
`````

## 38. MODIFY plugins/codexclaw/skills/dev-security/SKILL.md

Before:

`````text
- [ ] ASVS Level 1 passes for all security-sensitive changes; Level 2 passes for auth, payments, PII, admin, or multi-tenant flows.
`````

After:

`````text
- [ ] Applicable security requirements are mapped to the pinned ASVS version, requirement IDs, applicability decisions and evidence. The local checklist alone never certifies ASVS L1/L2 compliance.
`````

## 39. MODIFY plugins/codexclaw/skills/dev-security/references/asvs-checklist.md

Before:

`````text
# ASVS 5.0 Level 1 and Level 2 Pre-Deploy Checklist

Use this checklist before deploying any security-sensitive feature.
Level 1 is the minimum for ordinary authenticated applications.
Level 2 is required for admin surfaces, multi-tenant systems, PII, payments, file uploads, and internal tools with elevated access.

## V1: Architecture and Design
- [ ] L1: Threat model identifies assets, attacker types, trust boundaries, and blast radius.
- [ ] L1: Security assumptions and external dependencies are documented.
- [ ] L1: High-risk entry points are listed: auth, payments, uploads, admin, webhooks, exports.
- [ ] L2: Abuse cases are defined for admin actions, exports, file uploads, and automation.
- [ ] L2: High-risk workflows require explicit security review before merge.
- [ ] L2: Trust boundaries are reflected in architecture diagrams, sequence docs, or ADRs.

## V2: Authentication
- [ ] L1: Passwords are hashed with `argon2id` or `bcrypt`.
- [ ] L1: Login, reset, and MFA verification are rate-limited.
- [ ] L1: Auth failures do not reveal whether the account exists.
- [ ] L1: Password reset and magic-link tokens are short-lived.
- [ ] L2: Step-up authentication protects account recovery, role change, and payout change.
- [ ] L2: Password reset tokens are one-time and stored hashed server-side.
- [ ] L2: Sensitive auth events trigger audit logs and optional alerting.

## V3: Session Management
- [ ] L1: Session or refresh cookies use `httpOnly`, `secure`, and `sameSite`.
- [ ] L1: Access tokens are short-lived and refresh tokens rotate on use.
- [ ] L1: Logout invalidates the active session server-side.
- [ ] L1: Session identifiers are never placed in URLs.
- [ ] L2: Session family invalidation runs after token reuse, password change, or privilege change.
- [ ] L2: Session scope is bounded by path, audience, and device or risk context where applicable.
- [ ] L2: Concurrency limits or re-auth requirements exist for privileged sessions.

## V4: Access Control
- [ ] L1: Every protected route checks authorization, not only authentication.
- [ ] L1: Resource access is scoped by tenant, owner, role, or policy.
- [ ] L1: Hidden fields and client-supplied role flags are ignored.
- [ ] L1: Response serializers exclude admin-only or internal fields.
- [ ] L2: Bulk actions, exports, admin tools, and background jobs re-check authorization.
- [ ] L2: Multi-tenant reads and writes are isolated in the query layer as well as the route layer.
- [ ] L2: Support tooling and back-office actions follow the same policy model.

## V5: Validation, Sanitization, and Encoding
- [ ] L1: All external input is schema-validated at the first trusted boundary.
- [ ] L1: Unknown fields are rejected by default.
- [ ] L1: Output is encoded for the correct sink: HTML, URL, header, log, shell, or SQL parameter.
- [ ] L1: Filenames, sort keys, and enum-like inputs use allowlists.
- [ ] L2: Rich text is sanitized with a maintained sanitizer before rendering.
- [ ] L2: Dangerous sinks such as shell commands, raw SQL, and template execution use allowlists or parameterization only.
- [ ] L2: File parsing, CSV import, and report generation flows validate size, type, and content assumptions.

## V6: Stored Cryptography
- [ ] L1: Sensitive data at rest uses approved platform crypto or managed encryption.
- [ ] L1: Secrets, keys, and certificates are not stored in source control.
- [ ] L1: Production traffic uses TLS and HSTS.
- [ ] L1: Browser session tokens are not stored in `localStorage`.
- [ ] L2: Key rotation, revocation, and secret ownership are documented and testable.
- [ ] L2: Encryption context, key scope, and data classification are defined for protected data.
- [ ] L2: Emergency key rollover is rehearsed or documented step by step.

## V7: Error Handling and Logging
- [ ] L1: Client errors are generic and avoid stack traces or internal identifiers.
- [ ] L1: Security-relevant events are logged with request correlation IDs.
- [ ] L1: Tokens, passwords, cookies, raw PII, and payment values are redacted.
- [ ] L1: Error responses preserve a stable contract for callers.
- [ ] L2: Alerts exist for brute force, repeated auth denial, signature failure, and abnormal webhook activity.
- [ ] L2: Audit logs are retained and access-controlled according to business policy.
- [ ] L2: Incident response owners know where to find redacted logs, traces, and audit records.

## V8: Data Protection
- [ ] L1: Data classification exists for secrets, credentials, PII, and sensitive business data.
- [ ] L1: Only the minimum required data is collected and stored.
- [ ] L1: Non-production data is masked or synthetic when sourced from real users.
- [ ] L1: Data retention has an owner and a stated purpose.
- [ ] L2: Retention, deletion, and right-to-erasure behavior are defined for protected data.
- [ ] L2: Exports, backups, and analytics sinks preserve masking and access control.
- [ ] L2: Payment, identity, and support data have separate access rules where needed.

## V9: API and Web Security
- [ ] L1: CORS is explicit per origin, method, and header; never wildcard in production for credentialed requests.
- [ ] L1: Security headers include CSP, HSTS, `nosniff`, referrer policy, and frame protection.
- [ ] L1: Webhooks verify signatures before processing.
- [ ] L1: Public endpoints are rate-limited and abuse-aware.
- [ ] L2: File uploads enforce size, type, storage isolation, and authorization on download.
- [ ] L2: Payments use idempotency keys, provider signature verification, and reconciliation checks.
- [ ] L2: Browser code respects CSP, XSS, cookie, and dependency-audit rules.

## Release Decision
- [ ] All applicable Level 1 items pass.
- [ ] All applicable Level 2 items pass for high-risk features.
- [ ] Exceptions are documented with owner, expiration date, and mitigation.
- [ ] Static analysis and secret scanning results are attached to the deploy or PR record.
- [ ] Open findings have a written rationale, follow-up issue, and temporary containment.
- [ ] Deployment notes include rollback steps for auth, payment, upload, and secret-related changes.
- [ ] Monitoring dashboards or alerts are ready before traffic is shifted to the new release.

## Evidence Pack
- [ ] Link the threat model or design review that covers the release.
- [ ] Link the CI run that contains SAST, dependency audit, and secret-scan results.
- [ ] Link the test evidence for auth, authorization, upload, payment, or webhook flows touched by the change.

Use this checklist together with `references/owasp-top10.md` for code examples and `references/static-analysis.md` for the enforcement pipeline.
`````

After:

`````text
# Application security release checklist — ASVS-informed, not a conformance certificate

This is a local risk checklist, not the complete OWASP ASVS and not an official L1/L2
mapping. Select the required assurance level from the product's threat model.
Passing these summaries alone does not establish ASVS compliance.

## Official baseline

For formal assessment, pin the official [ASVS 5.0.0 release](https://github.com/OWASP/ASVS/releases/tag/v5.0.0)
and use its full requirements, not a moving branch or this summary.
ASVS 5.0 Authentication is **V6**, Session Management **V7**; the old V2/V3 labels
must not be used for those chapters. Examples of traceable requirements:
- V6.3.3 (L2): assess the required multi-factor/combined authentication mechanism and documented exceptions.
- V7.2.1 (L1): session verification uses a trusted backend service.
- V7.4.1 (L1): terminated sessions cannot be reused.

These examples are not the full assessment. For each applicable requirement record:
version + ID + level, control owner, scenario, evidence, pass/fail/not-applicable
with rationale. Keep unresolved requirements visible. Use the complete pinned
standard to discover omissions; no compliance claim without full applicable coverage.

## Threat model and access

- Identify assets, attacker capability, entrypoints and trust boundaries.
- Check authentication and authorization separately, including tenant/object ownership.
- Cover admin, bulk, exports, jobs, uploads, webhooks and recovery paths.
- Password hashing and lifecycle follow the security router's current policy.
- Check token lifetime, revocation, reuse detection and session termination.
- Cookie flags do not replace CSRF protection on state-changing requests.
- Step-up and MFA requirements follow the threat model and selected ASVS level.

## Input, output, secrets and data

- Parse untrusted input once at ingress; enforce domain invariants in their owner.
- Bound payload/collection sizes and validate output context.
- Use parameterized queries and scoped command/file-path handling.
- Keep secrets out of source, logs, client bundles and screenshots.
- Redact PII, restrict access, and define retention/deletion requirements.
- Apply appropriate TLS, CSP, cookie, CORS and other header policies for the real app.

## Release evidence

- Attach control-level tests, dependency/secret scans, and threat-model evidence.
- Unresolved High/Critical safety findings block under the declared security policy.
- A permitted exception needs a predeclared policy, owner, expiry, mitigation and proof;
  this checklist cannot override a stricter image/artifact gate in dev-devops.
- Retain rollback/containment evidence for the actual release surface.
- Mark unavailable checks unverified, not passed. Report assessment coverage explicitly.

Implementation examples: `owasp-top10.md`; scanning recipes: `static-analysis.md`.
`````

## 40. MODIFY plugins/codexclaw/skills/dev-frontend/SKILL.md

Before:

`````text
| `../../../../.codexclaw/goalplans/design-award-research-skill-expansion-000-plan-010-crawl/devlog/090/090-synthesis.md` | Calibrating anti-slop rules against award evidence | Context-gated exemptions for centered/split heroes, one-hue fields, gradients, motion, oversized type, navigation, and media |
`````

After:

`````text
| `../dev-uiux-design/references/design-trends.md` | Calibrating a dated design example | Source provenance, surface-specific exceptions, and re-verification before promoting a sample to a default |
`````

## 41. MODIFY plugins/codexclaw/skills/dev-uiux-design/SKILL.md

Before:

`````text
| `../../../../.codexclaw/goalplans/design-award-research-skill-expansion-000-plan-010-crawl/devlog/090/090-synthesis.md` | Calibrating anti-slop rules against award evidence | Context-gated exemptions for centered heroes, split media, one-hue fields, gradients, motion, oversized type, navigation, and media |
`````

After:

`````text
| `references/design-trends.md` | Calibrating a dated design example | Source provenance, surface-specific exceptions, and re-verification before promoting a sample to a default |
`````

## 42. MODIFY plugins/codexclaw/skills/dev-frontend/SKILL.md

Before:

`````text
Award evidence does not repeal these rules. Use the context-gated calibrations in the award-research synthesis §5: an exception is valid only when the device expresses specific product, artifact, or narrative content and the surface remains accessible without the effect.
`````

After:

`````text
Award examples do not establish universal taste rules. Use the shipped design-trends
reference and reopen its sources; explain the product-specific role and preserve
accessibility. No private goalplan is required to justify a design decision.
`````

## 43. MODIFY plugins/codexclaw/skills/dev-frontend/SKILL.md

Before:

`````text
- **Visual verification**: after UI changes, exercise the flow per `cxc-dev-testing` §4.6 (TEST-CU-QA-01) — `browser:control-in-app-browser` on the dev server, screenshot, `view_image` — instead of claiming visual correctness from code alone.
`````

After:

`````text
- **Visual verification**: exercise the changed flow using the available capability selected by `dev/references/browser-routing.md` and `dev-testing` §4.7. Read rendered output and verify the interaction; no single optional browser is mandatory.
`````

## 44. MODIFY plugins/codexclaw/skills/dev-uiux-design/SKILL.md

Before:

`````text
- "Simple" in brief → decrease all three proportionally
`````

After:

`````text
- "Simple" in brief → determine whether it means fewer choices, less decoration, or less information; do not automatically decrease information density
`````

## 45. MODIFY plugins/codexclaw/skills/dev-uiux-design/SKILL.md

Before:

`````text
- "Simple" in brief: decrease variance and motion; density stays or increases
`````

After:

`````text
- "Simple" in brief: reduce the complexity the user actually names; derive density from the task, not a fixed arithmetic rule
`````

## 46. MODIFY plugins/codexclaw/skills/dev-uiux-design/SKILL.md

Before:

`````text
Presets are authoritative specializations that may exceed the inference ranges
above (e.g. Agency motion 8 exceeds the general landing 5-7 range). When a
preset exists for the exact use case, use it directly; adjust from Design Read.
`````

After:

`````text
Presets are illustrative starting points, not authoritative constraints. They may
fall outside the rough inference ranges. Prefer the brief, existing design system,
accessibility and task evidence; record a different choice without treating it as failure.
`````

## 47. MODIFY plugins/codexclaw/skills/dev-uiux-design/SKILL.md

Before:

`````text
Award evidence calibrates these defaults without reversing them: a normally generic device is defensible only when it is the minimum expression of a specific product, artifact, or narrative and remains accessible without the effect. Apply the context gates in the award-research synthesis §5 rather than treating any winner example as a blanket exemption.
`````

After:

`````text
Award evidence is a dated sample, not an exemption or universal prohibition. Consult
`references/design-trends.md` and its actual sources, explain the surface-specific
purpose, and retain accessibility. Do not depend on a private goalplan synthesis.
`````

## 48. MODIFY plugins/codexclaw/skills/dev-frontend/references/stacks/react.md

Before:

`````text
Use EXACTLY `@phosphor-icons/react` or `@radix-ui/react-icons` as import paths.
Standardize `strokeWidth` globally (e.g., exclusively `1.5` or `2.0`).
`````

After:

`````text
Use the icon system selected by the existing design system or Design Read. Follow
`dev-uiux-design` Icon Strategy and `dev-frontend` FE-ICON-01; this stack reference
must not replace Iconoir, Hugeicons, Lucide, or another approved library with a fixed pair.
Use the actual library's supported weight/stroke API consistently.
`````

## 49. MODIFY plugins/codexclaw/skills/dev-frontend/references/stacks/react.md

Before:

`````text
- `React.memo` for expensive pure components
- `useMemo` / `useCallback` only when measured, not preemptively
`````

After:

`````text
- Check the installed React version and whether React Compiler is enabled on this code.
- Compiler-optimized components already receive automatic memoization; do not add manual memo by reflex.
- Without the compiler, or for measured remaining work, use React.memo/useMemo/useCallback selectively.
- Validate profiler behavior before removing an existing optimization; memoization is not a correctness guarantee.
- Official guidance: https://react.dev/reference/react/memo
`````

## 50. MODIFY plugins/codexclaw/skills/dev-frontend/references/stacks/react.md

Before:

`````text
2. If missing, output `npm install <package>` BEFORE providing code
`````

After:

`````text
2. If missing, consider an existing equivalent and propose the pinned dependency only when needed; do not silently install it
`````

## 51. MODIFY plugins/codexclaw/skills/dev-frontend/references/stacks/react.md

Before:

`````text
Rules specific to React projects. Read `core/aesthetics.md`, `core/anti-slop.md`, and `core/visual-verification.md` first.
`````

After:

`````text
Rules specific to React projects. Load only the owning frontend references needed
by the actual surface; ordinary CRUD work does not require a marketing design survey.
`````

## 52. MODIFY plugins/codexclaw/skills/dev-security/references/asvs-checklist.md

Before:

`````text
https://github.com/OWASP/ASVS/releases/tag/v5.0.0
`````

After:

`````text
https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release
`````
