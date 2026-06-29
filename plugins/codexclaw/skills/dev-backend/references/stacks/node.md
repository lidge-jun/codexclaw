# Node.js / TypeScript Backend

Stack-specific rules for Node.js backend projects.
Extends core rules with Express/Fastify patterns, Zod validation, ESM, and Node-specific gotchas.

---

## Framework Selection

| Framework | Best For                         | Performance |
| --------- | -------------------------------- | ----------- |
| Express   | Existing projects, ecosystem     | Good        |
| Fastify   | New projects, performance focus  | Excellent   |
| NestJS    | Enterprise, complex DI           | Good        |
| Hono      | Edge/serverless, small footprint | Excellent   |

Default: **Fastify** for new projects, **Express** for existing.

---

## Project Setup

```bash
# TypeScript + Fastify
npm init -y
npm install fastify @fastify/cors @fastify/rate-limit
npm install -D typescript @types/node tsx

# tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "declaration": true
  }
}
```

**Mandatory**: `"strict": true` in tsconfig. No `any` without `@ts-expect-error` + justification.

---

## ES Module Rules

- `import`/`export` only. **No `require()`** in 2026.
- `"type": "module"` in `package.json`
- File extensions in imports: `import { foo } from './foo.js'`

---

## Input Validation with Zod

```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100).trim(),
  age: z.number().int().positive().optional(),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

// In route handler
const data = CreateUserSchema.parse(req.body); // throws on invalid
```

---

## Error Handling Pattern

```typescript
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: unknown[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Usage
throw new AppError('VALIDATION_ERROR', 'Email is required', 400);
throw new AppError('NOT_FOUND', 'User not found', 404);

// Global error handler (Express)
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
      meta: { requestId: req.id }
    });
  }
  // Unhandled → 500
  logger.error('[UNHANDLED]', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
});
```

---

## Structured Logging

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: { level: (label) => ({ level: label }) },
});

// Request logging middleware
app.use((req, res, next) => {
  req.log = logger.child({ requestId: req.id });
  req.log.info({ method: req.method, path: req.path }, 'Request started');
  next();
});
```

---

## Common Node.js Anti-Patterns

| Anti-Pattern                   | Fix                                     |
| ------------------------------ | --------------------------------------- |
| `callback` hell                | `async`/`await` everywhere              |
| Missing `await`                | Always `await` or handle `.catch()`     |
| `process.exit(1)` in libraries | Throw errors, let caller handle         |
| Blocking the event loop        | Use `worker_threads` for CPU-heavy work |
| Global mutable state           | Pass config via dependency injection    |
| `JSON.parse` without try/catch | Always wrap with error handling         |
| No graceful shutdown           | Handle `SIGTERM`, close connections     |

---

## Testing

```bash
# Vitest (50% faster than Jest, ESM-native)
npm install -D vitest @vitest/coverage-v8

# Run
npx vitest run
npx vitest run --coverage
```

Testing: see dev-testing §1.2 for ratio guidance (Trophy for web/API, Pyramid for libraries).

---

## Performance

- Use connection pooling (pg `Pool`, mongoose `createConnection`)
- Enable HTTP keep-alive
- Compress responses (`@fastify/compress` or `compression`)
- Use `worker_threads` for CPU-intensive tasks
- Profile with `--inspect` + Chrome DevTools
- Monitor with Prometheus + Grafana or OpenTelemetry

---

## Dependency Verification

Before importing ANY package:
1. Check it exists in `package.json`
2. If not, recommend adding: `npm install <package>`
3. Verify the import path is correct
4. Never hallucinate package names
