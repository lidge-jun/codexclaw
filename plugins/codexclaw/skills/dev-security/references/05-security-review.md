## 9. Pre-Flight Security Checklist

A security-sensitive change is complete only when every applicable item passes.

- [ ] Threat model names assets, attacker, trust boundary, and blast radius.
- [ ] All user input is validated at the first trusted boundary with unknown fields rejected.
- [ ] Authentication covers token TTL, cookie flags, reset flow, and revocation rules.
- [ ] Authorization is enforced per resource, not only per route.
- [ ] Queries, commands, templates, and serializers are protected from injection.
- [ ] Secrets are not committed, logged, embedded in screenshots, or exposed in client bundles.
- [ ] Security headers and CORS are explicit for the deployed environment.
- [ ] File upload, payment, logging, and PII changes pass their must-pass checks from the relevant reference.
- [ ] Rate limiting covers auth, public endpoints, and abuse-prone flows.
- [ ] Static analysis runs clean enough for the repository policy: Semgrep, CodeQL or equivalent, dependency audit, and secret scan.
- [ ] Error handling returns safe client messages and preserves structured server-side diagnostics.
- [ ] Applicable security requirements are mapped to the pinned ASVS version, requirement IDs, applicability decisions and evidence. The local checklist alone never certifies ASVS L1/L2 compliance.
- [ ] Agentic workflows resist prompt injection, tool misuse, exfiltration, and excessive agency.

### Must-Pass Addenda for High-Risk Changes

**Logging and PII**
- [ ] Raw email, phone number, access token, session cookie, recovery code, and payment data are redacted before logs and traces.
- [ ] Retention and deletion behavior are defined for the new data.

**File Uploads**
- [ ] Enforce file type, file size, storage path isolation, malware scanning policy, and download authorization.
- [ ] Validate server-side — the client-provided filename and MIME type are untrusted input.

**Payments**
- [ ] Idempotency, webhook signature verification, reconciliation, and failure-state handling are tested.
- [ ] Payment provider secrets stay out of logs, analytics, and client bundles.

If any item remains unknown, stop, investigate, and resolve the gap before proceeding.

## 10. Security Ownership Matrix

This matrix clarifies who defines, implements, and verifies each security control across the skill bundle:

| Control | Policy Owner | Implementation Owner | Verification Owner |
|---------|-------------|---------------------|--------------------|
| Input validation schema | `dev-security` §1 | Domain skill (backend/frontend/data) | `dev-testing` §2 |
| Auth flow (login, session, token) | `dev-security` §2 | `dev-backend` §4 middleware | `dev-testing` §1.3 risk priorities |
| Authorization (RBAC/ABAC) | `dev-security` §3 | `dev-backend` service layer | `dev-testing` §2 + `dev-code-reviewer` |
| Security headers (CSP, CORS, HSTS) | `dev-security` §5 | `dev-backend` middleware + `dev-frontend` compliance | `dev-testing` + static analysis |
| Rate limiting | `dev-security` §6 | `dev-backend` §4 middleware | Load testing + monitoring |
| PII/data classification | `dev-security` + `dev-data` §7 | `dev-data` pipeline + `dev-backend` API | `dev-testing` + audit logs |
| Secrets management | `dev-security` §4 | All skills (runtime env) | gitleaks + `dev-code-reviewer` |
| Dependency security | `dev-security` §7 | CI pipeline owner | `npm audit` / `pip-audit` in CI |
| Agentic AI safety | `dev-security` `../references/agentic-ai-security.md` | Agent builder | Scenario testing (`dev-testing`) |

Reference this matrix from `dev-backend` and `dev-frontend` when ownership is unclear.

## When to Activate

Activate this skill when you are:
- Writing auth, session, cookie, token, password-reset, or OAuth logic.
- Accepting user input from forms, URLs, headers, cookies, webhooks, file uploads, rich text, or AI prompts.
- Handling secrets, credentials, certificates, encryption keys, or third-party API keys.
- Reviewing code for security regressions or production-readiness.
- Auditing dependencies, CI pipelines, or release integrity.
- Designing logging, PII retention, masking, audit trails, or incident response rules.
- Building AI agents, tool-using workflows, or prompt-processing systems.

Use this skill together with the domain skill, not instead of it:
- Credential delivery, CI secret injection, image scan gates, signing execution, and release proof: load `dev-devops`.
- API architecture and middleware placement: See `../../dev-backend/SKILL.md` §4.
- Frontend rendering patterns and anti-slop UI guardrails: See `../../dev-frontend/SKILL.md` §§4-5.
- Test strategy and execution flow: See `dev-testing`.
- Review severity and review flow: See `../../dev-code-reviewer/SKILL.md` §§1-2.
- Security-sensitive RCA and incident forensics: see `dev-debugging`.
- Security middleware placement and initial security config: see `dev-scaffolding`.
- Data pipeline design: See `../../dev-data/SKILL.md` §§2-4.
