# OWASP Top 10:2025 — Unsafe and Safe Patterns

Use this reference when a change touches auth, data access, secrets, templates, dependencies, CI, or production configuration.
Each section gives a problem statement, one unsafe pattern, one safe pattern, and a concrete checklist.
JavaScript and TypeScript are primary examples.
Python appears where it clarifies a common secondary stack.

## A01: Broken Access Control

### The Problem
A caller is authenticated but can act outside their intended scope.
Typical failures include reading another tenant's record, escalating privileges through hidden fields, or calling an admin-only route with a regular session.

### Unsafe Pattern
```ts
app.get('/api/orders/:id', requireUser, async (req, res) => {
  const order = await db.order.findUnique({ where: { id: req.params.id } });
  res.json(order);
});
```

### Safe Pattern
```ts
app.get('/api/orders/:id', requireUser, async (req, res) => {
  const order = await db.order.findFirst({
    where: { id: req.params.id, tenantId: req.user.tenantId },
  });
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});
```

### Checklist
- [ ] Enforce authorization for every read, write, export, and delete.
- [ ] Scope database access by tenant, owner, or role.
- [ ] Default deny when the rule is unclear.
- [ ] Never trust hidden form fields, query parameters, or client-side role flags.

## A02: Security Misconfiguration

### The Problem
The app is correct in source code but unsafe in runtime configuration.
Typical failures include debug mode in production, wildcard CORS, public cloud buckets, verbose stack traces, and unneeded network exposure.

### Unsafe Pattern
```python
DEBUG = True
ALLOWED_HOSTS = ["*"]
CORS_ALLOW_ALL_ORIGINS = True
SECURE_SSL_REDIRECT = False
```

### Safe Pattern
```python
DEBUG = False
ALLOWED_HOSTS = ["api.example.com"]
CORS_ALLOWED_ORIGINS = ["https://app.example.com"]
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

### Checklist
- [ ] Debug mode is disabled outside local development.
- [ ] CORS and host allowlists are explicit.
- [ ] Error pages do not expose stack traces to clients.
- [ ] Unused ports, services, and admin routes are disabled.

## A03: Software Supply Chain Failures

### The Problem
The app becomes unsafe because the build pipeline, dependency graph, or release process is compromised.
This includes poisoned transitive packages, mutable CI actions, unsigned artifacts, and unreviewed dependency jumps.

### Unsafe Pattern
```yaml
- uses: actions/checkout@v4
- run: npm install
- run: npm test
- run: npm publish
```

### Safe Pattern
```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
- run: npm ci
- run: npm audit --audit-level=high
- run: npx license-checker --production
- run: npm test
```

### Checklist
- [ ] Commit and honor the lockfile with `npm ci`, `pip-compile`, `poetry lock`, or equivalent.
- [ ] Pin CI actions to commit SHA, not mutable tags.
- [ ] Run dependency audit in CI and fail on high or critical findings.
- [ ] Track artifact provenance, SBOM, and release ownership.

## A04: Cryptographic Failures

### The Problem
Sensitive data is exposed because encryption, hashing, key management, or transport security is weak.
Common failures are home-grown crypto, raw password hashing, storing tokens in browser storage, and exposing secrets in URLs.

### Unsafe Pattern
```ts
import crypto from 'node:crypto';

const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
localStorage.setItem('access_token', token);
```

### Safe Pattern
```ts
import argon2 from 'argon2';

const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
res.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/auth/refresh',
});
```

### Checklist
- [ ] Use `argon2id` or `bcrypt` for passwords, never generic hash functions.
- [ ] Enforce HTTPS and HSTS in production.
- [ ] Store browser session tokens in secure cookies, not `localStorage`.
- [ ] Keep keys in Vault, KMS, or environment delivery, not source files.

## A05: Injection

### The Problem
Untrusted input is interpreted as code, query syntax, shell syntax, template syntax, or HTML.
This includes SQL injection, command injection, NoSQL injection, template injection, and stored or reflected XSS.

### Unsafe Pattern
```ts
const user = await db.$queryRawUnsafe(
  `SELECT id, email FROM users WHERE email = '${req.query.email}'`
);
const html = `<div>${req.body.bio}</div>`;
```

### Safe Pattern
```ts
const user = await db.$queryRaw`
  SELECT id, email FROM users WHERE email = ${req.query.email}
`;
const safeBio = DOMPurify.sanitize(req.body.bio);
const html = `<div>${safeBio}</div>`;
```

### Checklist
- [ ] Use parameterized queries or ORM query builders.
- [ ] Never pass user input into `eval`, shell strings, or template engines unsafely.
- [ ] Sanitize rich text before rendering and defend it with CSP.
- [ ] Validate allowlists for filenames, sort keys, and command arguments.

## A06: Insecure Design

### The Problem
The app ships a fundamentally unsafe flow even when the code is clean.
Examples include password reset without rate limits, multi-tenant data export without ownership checks, and agent tools with unrestricted file or network access.

### Unsafe Pattern
```ts
app.post('/admin/invite', requireUser, async (req, res) => {
  await inviteAdmin(req.body.email);
  res.sendStatus(204);
});
```

### Safe Pattern
```ts
app.post('/admin/invite', requireUser, requireRole('owner'), async (req, res) => {
  await ensureStepUpAuth(req.user.id, req.headers['x-reauth-token']);
  await inviteAdmin(req.body.email);
  res.sendStatus(204);
});
```

### Checklist
- [ ] Write the threat model before implementing the flow.
- [ ] Name assets, attacker, trust boundary, and blast radius.
- [ ] Require step-up auth for admin, payout, and identity changes.
- [ ] Design file upload, payment, and export flows before coding them.

## A07: Authentication Failures

### The Problem
The login and session system is weak enough to be bypassed, guessed, replayed, or abused.
Examples include weak password policy, infinite login attempts, long-lived bearer tokens, URL-based session IDs, and missing session revocation.

### Unsafe Pattern
```python
session["user_id"] = user.id
response.set_cookie("session", session_id)
return {"token": create_token(user.id, ttl_days=30)}
```

### Safe Pattern
```python
response.set_cookie(
    "refresh_token",
    refresh_token,
    httponly=True,
    secure=True,
    samesite="Strict",
    path="/auth/refresh",
)
return {"access_token": create_access_token(user.id, ttl_minutes=15)}
```

### Checklist
- [ ] Rate limit login, password reset, and MFA verification.
- [ ] Use short-lived access tokens and rotated refresh tokens.
- [ ] Revoke sessions on password change and suspicious reuse.
- [ ] Return generic auth failure messages to block user enumeration.

## A08: Software and Data Integrity Failures

### The Problem
Trusted code, configuration, or data is modified without validation.
Examples include unsigned webhooks, unsafe deserialization, trusting client-generated totals, and loading deployment artifacts without integrity checks.

### Unsafe Pattern
```ts
app.post('/webhooks/stripe', express.json(), async (req, res) => {
  await processStripeEvent(req.body);
  res.sendStatus(200);
});
```

### Safe Pattern
```ts
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.header('stripe-signature') ?? '';
  const event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  await processStripeEvent(event);
  res.sendStatus(200);
});
```

### Checklist
- [ ] Verify webhook signatures before parsing trusted business events.
- [ ] Reject unsafe deserialization formats for untrusted input.
- [ ] Recompute server-side prices, permissions, and transitions.
- [ ] Track integrity of build artifacts and releases.

## A09: Security Logging and Monitoring Failures

### The Problem
The system either misses important security events or logs them in a harmful way.
Common failures include no audit trail, no request correlation, no alerting, and logging raw tokens or PII.

### Unsafe Pattern
```ts
logger.info('login_failed', {
  email: req.body.email,
  password: req.body.password,
  authHeader: req.headers.authorization,
});
```

### Safe Pattern
```ts
logger.warn('login_failed', {
  requestId: req.id,
  emailHash: hashIdentifier(req.body.email),
  ip: req.ip,
  reason: 'invalid_credentials',
});
```

### Checklist
- [ ] Log auth failures, admin actions, permission denials, and secret-rotation events.
- [ ] Redact tokens, cookies, passwords, raw PII, and payment values.
- [ ] Propagate `requestId` or trace IDs through services.
- [ ] Alert on replay storms, brute force, signature failures, and repeated access denials.

## A10: Mishandling of Exceptional Conditions

### The Problem
Errors, timeouts, null cases, and partial failures reveal data or produce unsafe side effects.
Typical failures include stack traces sent to clients, double-charged payments after retries, partial writes, and retry loops that amplify incidents.

### Unsafe Pattern
```python
@app.post("/payouts")
def create_payout():
    payout = payout_service.send(request.json)
    return {"status": "ok", "payout": payout}
```

### Safe Pattern
```python
@app.post("/payouts")
def create_payout():
    try:
        payout = payout_service.send(request.json, idempotency_key=request.headers["Idempotency-Key"])
        return {"status": "ok", "payout_id": payout.id}
    except DomainError:
        return {"error": "Unable to process payout"}, 400
```

### Checklist
- [ ] Return safe client errors and keep stack traces server-side.
- [ ] Use idempotency for payment, payout, and external side-effect operations.
- [ ] Define retry behavior for queues, webhooks, and third-party calls.
- [ ] Test timeout, race, duplicate, and partial-failure scenarios.

## Frontend Security Reminders

Frontend work is not exempt from these categories.
When a feature includes browser code, apply these mappings:
- A02: CSP, CORS, cookie flags, and dependency configuration.
- A04: token storage and transport rules.
- A05: React auto-escaping, `dangerouslySetInnerHTML`, DOM sanitization, URL construction, and client-side template safety.
- A08: webhook dashboards, signed payload displays, and user-visible state that must come from server-verified values.
- A09: redact analytics payloads, replay tools, and client error reports.

## Review Shortcut

When time is tight, review in this order:
1. A01 authorization and tenancy boundaries.
2. A05 injection surfaces and unsafe rendering.
3. A07 token, cookie, and reset flow.
4. A03 dependency and CI integrity.
5. A09 logging and audit behavior.
