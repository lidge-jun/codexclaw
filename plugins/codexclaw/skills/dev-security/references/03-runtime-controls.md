## 4. Secrets Management

Secrets are values that grant access, identity, or decryption capability.
Treat API keys, database credentials, signing keys, OAuth client secrets, webhook secrets, certificates, and recovery codes as secrets.

| Rule | Required Practice |
| --- | --- |
| Source control | Commit `.env.example`, never commit `.env`, real keys, tokens, or private certs |
| Local development | Load secrets from environment variables or a local secret store |
| Production | Use Vault, cloud secret manager, or KMS-backed delivery |
| Rotation | Document owner, rotation cadence, and emergency revocation path |
| Logging | Redact secrets before logs, traces, analytics, error reports, and screenshots |
| Testing | Use dedicated non-production keys with least privilege |

If a repository change touches secrets, run gitleaks before claiming done.
If a feature adds webhook verification or JWT signing, treat key rollover as part of the feature.
For scanning recipes, read `../references/static-analysis.md`.
For agent workflows and exfiltration risk, read `../references/agentic-ai-security.md`.

## 5. Security Headers

This skill owns header policy values.
`dev-backend` owns middleware ordering and integration points.

**Minimum production header baseline**
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy` with explicit `default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `frame-ancestors`, and `base-uri`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` with unused capabilities disabled
- `X-Frame-Options: DENY` when CSP `frame-ancestors` is not sufficient for legacy support
- `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` where required by the app

Apply these via the framework's standard header middleware (Helmet for Express, equivalents elsewhere). Exact directive values are environment-specific — CSP especially must be designed around the app's real script/style/asset/connect origins, not copied from a template.

**Frontend touchpoints that must stay aligned**
- CSP compliance: no inline scripts, no unsafe event handlers, no surprise third-party script injection.
- CORS: explicit origin allowlist and correct credential mode for cookie-based auth.
- Avoid `dangerouslySetInnerHTML` unless sanitized with a maintained sanitizer and defended by CSP.
- Prefer cookies over browser storage for session tokens.

See `../references/owasp-top10.md` A02 and A05.
See `dev-frontend/SKILL.md` §§5-7 for performance and accessibility guardrails that still apply after security changes.

## 6. Rate Limiting

Apply rate limiting per IP and, where available, per user, tenant, and credential target.
Return `429 Too Many Requests` with `Retry-After`.
Log repeated abuse without logging secrets or raw PII.

Treat the limits below as risk-based starting defaults, not fixed gates — tune them to real traffic, abuse risk, and threat model.

| Surface | Default starting limit |
| --- | --- |
| Login | ~5 requests per minute per IP and account identifier |
| Password reset request | ~3 requests per hour per account identifier |
| Registration | ~10 requests per hour per IP |
| MFA verification | ~10 requests per 10 minutes per session |
| Public API | ~100 requests per minute per user or API key |
| File upload start | ~20 requests per hour per user |
| Webhook verification failures | Alert after burst anomalies and repeated signature failures |

Rate limiting is not only for brute force.
Use it for enumeration, abuse, accidental loops, webhook replay storms, and AI-triggered runaway automation.
