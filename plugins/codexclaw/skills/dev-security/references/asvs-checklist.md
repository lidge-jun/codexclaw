# Application security release checklist — ASVS-informed, not a conformance certificate

This is a local risk checklist, not the complete OWASP ASVS and not an official L1/L2
mapping. Keep existing assurance requirements: the local baseline target is L1 for
ordinary authenticated apps and L2 for admin, multi-tenant, PII, payments, uploads,
and elevated internal tools. The threat model may require more; lowering an existing
target requires a separately approved policy, not this documentation rewrite.
Passing these summaries alone does not establish ASVS compliance.

## Official baseline

For formal assessment, pin the official [ASVS 5.0.0 release](https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release)
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
