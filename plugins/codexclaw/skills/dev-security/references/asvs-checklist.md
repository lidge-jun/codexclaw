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
