# Next.js / React Debugging

Covers Next.js 16 (Turbopack default), React 19.2, RSC, Server Actions,
hydration. The core split: client components debug in the browser, server
components/actions debug through the Node inspector + DevTools MCP.
Lineage: gpt-5.5 Tier-2 research (2026-07-07).

## Phase 0 — Environment Detection

```bash
node -v
npx next info
rg "cacheComponents|browserToTerminal|serverActions|reactCompiler" next.config.* 2>/dev/null
rg "'use client'|'use server'" app src 2>/dev/null | head
# hydration nondeterminism suspects:
rg "Date.now\(|Math.random\(|typeof window|new Date\(" app src 2>/dev/null | head
```

## Attach Recipes (server vs client)

**Server side** (Server Components, Route Handlers, Server Actions):
```bash
next dev --inspect                        # Next 16.1+: targets the app-code process
NODE_OPTIONS='--inspect-brk' next dev     # break before boot (all processes)
next dev --inspect=0.0.0.0                # Docker/remote
# then chrome://inspect -> attach to the Next.js Node target
```
Gotcha: pre-16.1 `NODE_OPTIONS=--inspect` attached to ALL spawned processes;
`--inspect` flag now targets the process actually running app code.

**Client side**: browser Sources tab breakpoints + `npx react-devtools`
(standalone) when no extension is available.

**Agent-first surface — DevTools MCP** (Next 16+): `next-devtools-mcp` exposes
`get_errors`, `get_logs`, route metadata, Server Action lookup. This is the
CLI-agent path to browser errors without copy/paste.

## Browser -> Terminal Log Forwarding

```js
// next.config.js — make browser logs visible to the agent
module.exports = {
  logging: {
    browserToTerminal: true,
    fetches: { fullUrl: true, hmrRefreshes: true },
  },
}
```
Server Function calls log name/args/duration by default. Journal this config
change; revert at cleanup.

## Hydration Mismatch Workflow

React 19 emits ONE message with a server/client diff (`+ Client` / `- Server`)
plus likely causes. Workflow:

1. Reproduce with dev server + browser open; read the diff via MCP `get_errors`.
2. Locate the first divergent value in the diff.
3. Search the implicated component for nondeterminism: `Date.now()`,
   `Math.random()`, locale formatting, `typeof window` branches, invalid HTML
   nesting, browser extensions mutating DOM.
4. Enable `browserToTerminal` and compare server log vs browser log.
5. Fix: deterministic first render, server snapshot as prop, browser-only work
   moved to an Effect or client-only leaf, or corrected markup.

## React 19.2 Debugging Notes

- `useEffectEvent`: callable only from Effects/Effect Events; identity is
  intentionally unstable — passing it to children or deps is the bug.
- `<Activity>`: hidden state preserves UI but DESTROYS Effects; "missing
  subscription" bugs — check Activity visibility before chasing stale closures.
- React Compiler: debug via compiler `logger` (CompileSuccess/CompileError/
  CompileSkip), temporarily raise `panicThreshold`, isolate with
  `"use no memo"` directive on the suspect component.
- `captureOwnerStack()` (dev-only): owner stacks in render/effects/event
  handlers for custom error overlays.

## RSC Silent-Failure Patterns

| Failure | Why it looks silent | Probe |
| --- | --- | --- |
| Server Action throws, UI shows fallback | Uncaught exceptions go to error boundaries | MCP `get_errors`, terminal Server Function log, `useActionState` |
| Action mutates but UI stale | No re-render without `revalidatePath`/`updateTag`/redirect | Check action response + cache invalidation calls |
| Streaming SSR section fails | HTTP stays 200 after first chunk | Nearest `error.js` renders it; inspect streamed UI |
| Wrong `use client` boundary | Non-serializable props cross the boundary | `rg "use client"`; check functions/classes passed as props |
| Cache poisoning / stale read | force-cache/tags/HMR cache hide fresh data | Fetch fullUrl + hmrRefreshes logs; inspect tags |
| Dev works, prod build fails | Suspense/cache rules stricter at build | Run `next build`; add explicit Suspense or `use cache` |

## Cleanup

```bash
unset NODE_OPTIONS
# stop next-devtools-mcp / react-devtools processes
# revert next.config.js logging block, panicThreshold, "use no memo" markers
git diff next.config.* | head
```
