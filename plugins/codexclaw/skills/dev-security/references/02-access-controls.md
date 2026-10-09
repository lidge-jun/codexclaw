## 1. Input Validation

Input validation is the first line of defense.
Validate at the first trusted boundary, reject unknown fields, enforce limits, and escape or sanitize on output for the target context.
Client-side validation improves UX only — it is never a security boundary.

**Required rules**
- Validate shape, type, format, enum membership, length, and numeric range.
- Reject unknown fields by default.
- Canonicalize before validation when encoding differences matter.
- Distinguish parsing failures from authorization failures.
- Sanitize HTML only when rich text is explicitly allowed.
- Re-validate on the server even when frontend uses the same schema.

Validate all input at trust boundaries with schema validation (Zod strict, Pydantic `extra="forbid"`, or equivalent). Reject unknown fields. For injection cases, rich text, and output encoding, read `../references/owasp-top10.md` A05 and `../references/language-quirks.md`.

## 2. Authentication Checklist

Use this checklist for login, session, token, password reset, magic link, OAuth, and admin access:
- [ ] Passwords hashed with `argon2id` (preferred); `scrypt` next if unavailable; `bcrypt` mainly for legacy; PBKDF2 only for FIPS-140 contexts. MD5/SHA1/raw SHA256 never for passwords. (OWASP ordering, checked 2026-07-02.)
- [ ] Access tokens are short-lived with reduced scope (RFC 9700). Exact TTLs are risk-based org policy — 15-60 minutes is a common starting range, not a standard-mandated number.
- [ ] Refresh tokens rotate on use and support family invalidation after reuse detection.
- [ ] Browser session tokens use an appropriate httpOnly/secure/SameSite cookie strategy; keep session tokens out of localStorage. For cookie-authenticated state changes, verify framework CSRF protection or an appropriate token/origin/Fetch-Metadata defense; SameSite alone is not sufficient in most deployments.
- [ ] OAuth uses Authorization Code + PKCE; avoid implicit flow (deprecated, token-in-URL exposure).
- [ ] Sensitive actions such as email change, MFA reset, payout change, and password change require step-up auth.
- [ ] Failed logins are rate-limited and delayed progressively.
- [ ] Session invalidation runs after password reset, password change, and privilege change.
- [ ] Password reset tokens are one-time, short-lived, and stored hashed server-side.
- [ ] Auth errors are generic — avoid revealing whether a specific email exists.

See `../references/owasp-top10.md` A07 for implementation patterns.
See `../references/asvs-checklist.md` for the local release checklist and the distinction
from formal ASVS 5.0.0 evidence (Authentication V6, Session Management V7).

## 3. Authorization and Sensitive Flows

Authentication says who the caller is.
Authorization says what the caller may do.
Security failures happen when a route checks only the first.

**Required rules**
- Default deny.
- Enforce RBAC or ABAC before business logic.
- Perform ownership checks on every resource read and write.
- Scope queries by tenant and actor, not only by route.
- Re-check authorization on bulk actions, background jobs, exports, and webhooks.
- Keep internal flags, role names, and hidden fields out of response serializers.

See `../references/owasp-top10.md` A01 for code pairs.
See `../../dev-backend/SKILL.md` §4 for middleware execution order.
