# Anti-Slop Backend — Banned Patterns

Specific patterns that mark backend code as amateur or "AI-generated." Avoid all of these.
Analogous to frontend anti-slop — but for server-side code quality.

---

## Banned Architecture Patterns

### God Classes
- **Symptom**: > 20 methods, mixed responsibilities
- **Fix**: Split by domain into focused classes
- **Example**: `UserService` doing auth + profile + billing → split into `AuthService`, `ProfileService`, `BillingService`

### Business Logic in Controllers
- **Symptom**: Controller methods > 20 lines with if/else chains
- **Fix**: Extract ALL logic to services. Controllers: parse → delegate → format.

### Raw SQL in Service Layer
- **Symptom**: `db.query('SELECT * FROM...')` inside business logic
- **Fix**: Repository pattern. Services call `repository.findByEmail(email)`, never raw queries.

### Missing Layer Boundaries
- **Symptom**: Controllers importing ORM models directly
- **Fix**: Route → Controller → Service → Repository → DB. No layer skipping.

---

## Banned Code Patterns

### `SELECT *` in Production
Always specify columns. `SELECT *` is a performance and security anti-pattern.

### Magic Numbers
```
// ❌ BAD
if (retries > 3) ...
setTimeout(fn, 86400000);

// ✅ GOOD
const MAX_RETRIES = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
```

### Hardcoded Secrets
```
// ❌ BANNED — any of these in source code
const API_KEY = "sk-abc123...";
const DB_URL = "postgres://user:pass@host/db";

// ✅ REQUIRED
const API_KEY = process.env.API_KEY;
const DB_URL = process.env.DATABASE_URL;
```

### Floating Promises
```javascript
// ❌ async call without await
sendEmail(user.email);

// ✅ Always await or handle
await sendEmail(user.email);
```

### Stringly Typed
```javascript
// ❌ Strings where enums belong
if (user.role === "admin") ...

// ✅ Explicit types/enums
enum Role { ADMIN = 'admin', USER = 'user' }
if (user.role === Role.ADMIN) ...
```

### Silent Failures
```javascript
// ❌ Empty catch
try { await save(data); } catch (e) {}

// ✅ Log with context
try { await save(data); }
catch (e) { logger.error('[UserService] save failed', { error: e.message, userId }); throw e; }
```

### Copy-Paste Code
Same logic in 2+ places → extract to shared function.

---

## Banned API Patterns

### Inconsistent Response Shapes
All endpoints MUST use the same envelope. Never mix `{ data: ... }` with `{ result: ... }` with `{ user: ... }`.

### Meaningless Error Messages
```
// ❌ "Something went wrong"
// ❌ "Error occurred"
// ❌ "Oops!"

// ✅ "Email already registered. Use POST /api/auth/login instead."
// ✅ "User not found. Verify the ID and try again."
```

### Missing Pagination
List endpoints without pagination → will crash in production when data grows.

### No Input Validation
Every endpoint MUST validate input at the boundary (Zod, Pydantic, JSON Schema).

### No Rate Limiting
Public endpoints without rate limiting → DDoS target.

---

## Banned Development Patterns

### No Tests
Every feature MUST have tests. Minimum: unit tests for service layer.

Testing distribution depends on project type. Web/API apps: see dev-testing §1.2 (Testing Trophy favors integration). Libraries: Testing Pyramid (Unit 70% → Integration 20% → E2E 10%).

### `console.log` Debugging in Production
Use structured logging (JSON) with levels:
- `error`: Unhandled exceptions, data corruption
- `warn`: Validation failures, deprecated usage
- `info`: Request start/end, state changes
- `debug`: Development only (disable in production)

### No Rollback Migrations
Every migration MUST have a reverse migration. Never modify applied migrations.

### Importing Nonexistent Packages
Verify EVERY import exists in `package.json`/`requirements.txt` before adding.

### `require()` in 2026
ES Modules (`import`/`export`) only. No CommonJS `require()`.

---

## Banned Security Patterns

### CORS `*` in Production
Configure specific allowed origins. Never `Access-Control-Allow-Origin: *`.

### Missing Security Headers
Always enable: HSTS, CSP, X-Content-Type-Options, X-Frame-Options.

### Passwords in Plain Text
Always hash with bcrypt/argon2 (cost ≥ 10). Never store, log, or return plain passwords.

### SQL Injection (Parameterized Only)
```
-- ❌ BANNED
`SELECT * FROM users WHERE email = '${email}'`

-- ✅ REQUIRED
`SELECT * FROM users WHERE email = $1`, [email]
```

### Network Calls Inside Transactions
Transactions must be SHORT. No HTTP calls, no external API calls inside a transaction.

---

## Fix Priority Order

When fixing an existing backend, apply in this order:

1. **Remove hardcoded secrets** → highest security risk
2. **Add input validation** → prevents injection
3. **Fix layer violations** → separates concerns
4. **Add error handling** → no silent failures
5. **Add missing indexes** → performance
6. **Add tests** → prevents regressions
7. **Structured logging** → production observability
