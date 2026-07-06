# Node Backend Debugging (Express / Fastify / NestJS)

Covers Express 5, Fastify 5, NestJS 11, plus cross-cutting Node server
diagnostics (AsyncLocalStorage, diagnostics_channel, heap snapshots).
Lineage: gpt-5.5 Tier-2 research (2026-07-07).

## Phase 0 — Environment Detection

```bash
node -v
npm ls express fastify @nestjs/core pino 2>/dev/null
npm pkg get scripts
env | grep -E 'DEBUG|NODE_OPTIONS|NODE_ENV'
```

## Express 5

- **Async rejections now auto-forward** to error middleware (as if `next(err)`
  was called) — legacy `asyncHandler` wrappers are redundant and can
  double-handle.
- **Router debug namespace moved**: router internals live in a separate
  `router` package, so `DEBUG=express:*` alone is incomplete:
  ```bash
  DEBUG=express:*,router,router:* node index.js
  ```
- **Route syntax trap**: bare `*` wildcards fail after migration — named
  wildcards `/*splat` or `/{*splat}`; optional `?` markers move to braces.

## Fastify 5

- **Logging is off by default and CANNOT be enabled later** — construct with
  `Fastify({ logger: { level: 'debug' } })` (pino).
- **Lifecycle tracing**: hooks run `onRequest -> preValidation -> preHandler ->
  onSend -> onResponse` (onResponse fires after bytes sent — timing home):
  ```js
  fastify.addHook('onRequest', async req => { req.start = performance.now() })
  fastify.addHook('onResponse', async (req, reply) => {
    req.log.debug({ ms: performance.now() - req.start, status: reply.statusCode })
  })
  ```
- **Native diagnostics_channel** (v5): subscribe to
  `tracing:fastify.request.handler:start/end/error` for low-intrusion traces.
- **Schema validation vs serialization are separate failure paths**: request
  validation errors -> `attachValidation: true` + inspect
  `req.validationError.validation`; response serialization SILENTLY DROPS
  fields not in the response schema — compare raw handler return vs schema.
  v5 requires full JSON Schema with `type` everywhere.
- Repro without a socket: `fastify.inject()`.

## NestJS 11

- **DI errors workflow** (UnknownDependenciesException): read the exact
  provider/module/index in the message; check the provider is in `providers`,
  the exporting module is imported, no circular file imports via barrels, no
  duplicate `@nestjs/core` copies. `Object` as unknown token = interface/
  type-only injection — use a concrete class or `@Inject(TOKEN)`.
- **Debug launch**: `nest start --debug --watch` (`--debug [hostport]` =
  `--inspect`), or `npm run start:debug`.
- **REPL**: `npm run start -- --entryFile repl` — poke providers directly.
- **Devtools graph**: `@nestjs/devtools-integration` + `snapshot: true`;
  never in production.
- `forwardRef` is a design smell escape hatch — only when the cycle is valid.

## Cross-Cutting Node Server Diagnostics

```bash
node --trace-uncaught --unhandled-rejections=strict index.js   # rejection origins
node --heapsnapshot-signal=SIGUSR2 app.js                      # then: kill -USR2 <pid>, diff snapshots
```

- **AsyncLocalStorage context loss**: log `als.getStore()` after suspect
  awaits/callbacks; wrap non-promise callbacks with `AsyncResource`.
- **diagnostics_channel** is the vendor-neutral instrumentation surface
  (Fastify native; Sentry tracing channels ride it).
- Clinic.js is no longer actively maintained — prefer built-in heap snapshots
  and `--cpu-prof`.

## Silent-Failure Patterns

| Symptom | Likely cause | First probe |
| --- | --- | --- |
| Express async route skips custom handling | Express 5 auto-forwards rejections | Confirm error middleware receives it |
| Fastify: no logs at all | Logger disabled at construction | Check `Fastify({ logger })` |
| Fastify: `request.body` undefined in early hook | Body not parsed until preValidation | Move probe to `preValidation`/`preHandler` |
| Fastify: response fields disappear | Response schema drops unlisted fields | Compare raw return vs response schema |
| Nest: `Object` unknown token | Type-only injection | Concrete class or `@Inject(TOKEN)` |
| Request ID disappears mid-flow | Async context loss | `als.getStore()` probes after each await |
| Promise failure lacks origin | Default rejection mode | `--unhandled-rejections=strict --trace-uncaught` |
| Memory grows only in prod server | Retained request data/listeners/cache | Heap snapshot diff via SIGUSR2 |

## Cleanup

```bash
unset DEBUG NODE_OPTIONS
# remove temporary hooks, diagnostics_channel subscribers, attachValidation,
# verbose logger levels, inspector ports, Devtools registration
git diff | rg 'addHook|attachValidation|logger.*debug|--inspect' | head
```
