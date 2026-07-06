# Vite / Vitest Debugging

Covers Vite 8 (Rolldown/Oxc era), Vitest 4 (browser mode, visual regression),
HMR diagnosis, build-time silent failures.
Lineage: gpt-5.5 Tier-2 research (2026-07-07).

## Phase 0 — Environment Detection

```bash
vite --version; vitest --version
# Rolldown-powered Vite (8+)? Plugins see this:
#   this.meta.rolldownVersion is defined
rg "rolldownOptions|rollupOptions|forwardConsole|oxc" vite.config.* 2>/dev/null
rg "pool|browser|inspect" vitest.config.* vite.config.* 2>/dev/null | head
```

Vite 8 renames: `build.rollupOptions` -> `build.rolldownOptions`,
`worker.rollupOptions` -> `worker.rolldownOptions`; `esbuild` options are
still converted compatibly but deprecated in favor of `oxc`.

## Agent-First: Terminal-Visible Browser Errors

Vite 8 `server.forwardConsole` forwards browser runtime events to the dev
server terminal. Default is AUTO: `true` when an AI coding agent is detected
(`@vercel/detect-agent`), else `false`. Forwards unhandled errors +
`console.error`/`console.warn`; object form takes `unhandledErrors` and
`logLevels`. Wire this BEFORE debugging rendered behavior.

## Debug Recipes

**Plugin/transform latency**
```bash
vite --debug plugin-transform      # transform timings per module
# deeper: add vite-plugin-inspect, visit /__inspect/
```

**Source maps**
```bash
# dev: css.devSourcemap: true for CSS; server.sourcemapIgnoreList to tune
# build: build.sourcemap defaults to FALSE — set true|inline|hidden deliberately
vite preview                        # debug built output (never file://)
```

**Vitest stepping** (single worker required)
```bash
vitest --inspect-brk --no-file-parallelism --test-timeout=0
vitest --inspect-brk --browser --no-file-parallelism   # browser mode
```

**Visual regression failures** (Vitest 4 `toMatchScreenshot`)
Inspect reference/actual/diff images at the printed paths. Stabilize: capture
specific elements, mask dynamic content, disable animations, explicit
viewport, `--browser.trace=retain-on-failure`.

**Worker pools**: default pool is `forks`. Native module segfaults or workers
failing to terminate under `threads` -> switch `--pool=forks`. Reduce
parallelism (`--no-file-parallelism`) before changing pools.

## HMR Silent Failures

| Symptom | Likely cause | First probe |
| --- | --- | --- |
| Full reload / state resets | No HMR boundary, circular import, bad `import.meta.hot.accept` chain | `vite --debug hmr`; break the cycle |
| HMR not firing | Case-mismatched import path; WSL/Docker watcher | Check import casing; watcher config |

## Build-Time Silent Failures

| Symptom | Likely cause | First probe |
| --- | --- | --- |
| Live code disappears in build | Tree-shaking / `sideEffects` annotations / minifier assumptions | Compare with `build.minify: false`; check `package.json` sideEffects |
| CSS differs dev vs build | CSS code splitting, Lightning CSS minification, import order | Diagnostic: `build.cssCodeSplit: false`; inspect emitted chunks |
| Dynamic import fails after deploy | Cached HTML points at deleted hashed chunks | Keep old chunks briefly; fix cache/SW strategy |
| Env branch differs | `import.meta.env.*` statically replaced; only `VITE_*` reaches client; values are strings | Log resolved mode; coerce booleans/numbers |
| Oxc migration breakage | Unsupported `esbuild.supported`, decorator lowering gaps, changed CJS default import semantics, deprecated `manualChunks` | Isolate: try `rolldown-vite` on Vite 7 first, then Vite 8 |

## Cleanup

```bash
# remove debugger-only flags: --inspect-brk, --test-timeout=0, --no-file-parallelism, --debug
# revert temporary forwardConsole overrides, forced sourcemaps, diagnostic plugins
rm -rf .vitest-attachments test-results *.cpuprofile
# final proof: normal build + focused test without debug flags
vite build && vite preview
```
