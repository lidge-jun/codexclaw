# Node.js / tsx / Bun / Deno Debugging

Covers Node 18+, tsx, ts-node, Bun, Deno. Phase 0 detection, launch recipes,
inspector protocol, the tsx source-map silent-failure, and cleanup.
Lineage: lazycodex `runtimes/node.md`, adapted for codexclaw.

## Framework-Level References (js/)

This file owns RUNTIME-level debugging (inspector, launch, source maps).
Framework-specific depth lives in `js/`:

| File | When |
| --- | --- |
| `js/nextjs-react.md` | Next.js 16 / React 19: server-vs-client attach split, DevTools MCP, hydration workflow, RSC silent failures |
| `js/vite-vitest.md` | Vite 8 / Vitest 4: forwardConsole, plugin/transform debug, HMR failures, build-time silent failures |
| `js/node-backend.md` | Express 5 / Fastify 5 / NestJS 11: router debug namespaces, lifecycle hooks, DI errors, AsyncLocalStorage loss |

## Phase 0 — Environment Detection

Run before attaching anything:

```bash
node --version
ls node_modules/.bin/tsx 2>/dev/null && echo 'has tsx'
ls node_modules/.bin/ts-node 2>/dev/null && echo 'has ts-node'
ls node_modules/.bin/vitest 2>/dev/null && echo 'has vitest'
which bun 2>/dev/null && bun --version
which deno 2>/dev/null && deno --version
grep -E '"sourceMap"|"inlineSources"' tsconfig.json 2>/dev/null
lsof -iTCP:9229 -sTCP:LISTEN -nP 2>/dev/null
```

## tsx + `node inspect` Silent-Failure

tsx transpiles on the fly with inline source maps. V8 Inspector registers the
`.ts` path, but `node inspect` CLI breakpoints (`sb('file.ts', N)`) show
"pending" and **never fire**. The breakpoint list displays them — you think
they are set; they are not.

Reliable workarounds: (1) insert a JS break statement (`debugger` keyword) in
source (journal the edit, revert at cleanup), (2) Chrome DevTools GUI via
`chrome://inspect`, (3) debug built `dist/` JS where source maps work E2E.

## Launch Recipes

**Node (plain JS / compiled TS)**
```bash
node --inspect-brk=9229 dist/index.js     # break on first line
node --inspect=9229 dist/index.js         # attach any time
node --inspect-wait=9229 dist/index.js    # wait for attach (Node 20.15+)
node --enable-source-maps --inspect dist/index.js
```

**tsx**
```bash
node --inspect-brk=9229 --import tsx index.ts
# avoid tsx watch + inspector (inspector reloads per file change)
```

**Bun** (WebKit Inspector, NOT V8 — `chrome://inspect` cannot connect)
```bash
bun --inspect src/index.ts        # opens debug.bun.sh
bun --inspect-brk src/index.ts
bun test --inspect-brk
```

**Deno** (native V8, smoothest TS debugging)
```bash
deno run --inspect-brk --allow-all src/main.ts
deno test --inspect-brk --filter "auth"
```

**Vitest** (single worker required for breakpoints)
```bash
vitest --inspect-brk --no-file-parallelism
```

## `node inspect` CLI Essentials

```bash
node inspect 127.0.0.1:9229    # attach to --inspect process
```

Key commands: `c` continue, `n` next, `s` step, `o` out, `bt` backtrace,
`scripts` list loaded modules, `exec('expr')` evaluate in paused frame
(the most powerful command — use heavily), `repl` full REPL with frame scope.

## `exec()` Patterns for Fast Hypothesis Resolution

```js
exec('process.env.RELEVANT_VAR')
exec('JSON.stringify(req.body).length')
exec('res.statusCode')
exec('res.headersSent')
exec('process.version')
exec('process.cwd()')
```

## Silent-Failure Patterns

| Signal | Meaning |
| --- | --- |
| HTTP 200 + empty body | Error swallowed |
| Response in <1s for LLM call | Short-circuited, not real |
| `usage: { totalTokens: 0 }` | SDK stub, no actual call |
| Unhandled promise rejection, no log | Missing `await` or `.catch(() => {})` |
| `try { await x(); } catch {}` | Error eaten |
| `void somePromise()` | Explicit error suppression |

## Cleanup

```bash
# revert any debug logging lines from modified files
git diff | grep -E 'console\.log.*DEBUG'
pkill -f 'node --inspect' || true
pkill -f 'bun --inspect' || true
lsof -iTCP:9229 -sTCP:LISTEN -nP 2>/dev/null
```
