# L19 / 190 — dist packaging contract (E8)

Status: DONE (contract + fix shipped + tested) · 2026-06-30 · mvp_hard loop L19 · class C3 (packaging + test)

Register row: C8 (build compiles every `src/*.ts` -> `dist/*.js`; `.gitignore:2` ignores `dist/`;
only a subset of `dist/` is git-tracked; several runtime `dist/*.js` that `bin`/hooks load are
untracked — install relies on a local build, not the repo).

## Diagnosis (ground truth)

- `.gitignore` line 2 ignores `dist/` wholesale; 28 `dist/*.js` were force-added, 34 exist on disk.
- Runtime entrypoints: `bin/codexclaw.mjs` spawns each component's `dist/cli.js`
  (config-guard, cxc-ops, pabcd-state, subagent-config, provider-bridge); the 6 hook JSONs invoke
  `pabcd-state/dist/cli.js` and `provider-bridge/dist/cli.js`. Each `cli.js` then `import`s sibling
  `dist/*.js` modules.
- The 6 untracked dist files: `pabcd-state/dist/{interview-ledger,orchestrate-cli,orchestrate-grammar,rescan-coordinator}.js`,
  `subagent-config/dist/cli.js`, and `gui/dist/assets/index-*.js`.
- Aquinas A-gate correction: only **4** of those are runtime-reached —
  `pabcd-state/dist/{interview-ledger,orchestrate-cli,orchestrate-grammar}.js` +
  `subagent-config/dist/cli.js`. `rescan-coordinator.js` is NOT imported by any runtime
  entrypoint (it is the L17 directive-reachable helper), so it is intentionally left untracked.
- `pabcd-state/dist/cli.js` imports `./orchestrate-cli.js` (was untracked) and that imports
  `./orchestrate-grammar.js` (was untracked); `subagent-config/dist/cli.js` itself was untracked but
  is the `cxc subagents` entrypoint, AND `subagent-config/dist/mcp.js` (the `.mcp.json` MCP server
  entry) imports it too. So a fresh clone WITHOUT a local build had a broken
  `cxc orchestrate` / `cxc subagents` / MCP server.
- `gui/dist/assets/index-*.js` is NOT a runtime dependency: `cxc gui` runs `npm run dev` (Vite dev
  server), so the built gui bundle is out of the packaging contract.

## Decision: track all RUNTIME dist; exclude gui build output

The package is `private: true` and ships by repo clone/symlink (the Codex plugin loads
`${PLUGIN_ROOT}/components/*/dist/cli.js`). So the repo IS the artifact. Tracking every runtime
dist file is the honest, reproducible-install topology (vs. a build-on-install hook, which adds a
toolchain dependency to a plugin that is supposed to be load-and-go).

Work-phases (as shipped):
1. L19.1 — Force-added the **4** runtime dist files the import graph reaches; left `gui/dist/`
   ignored (dev-server only) and `rescan-coordinator.js` untracked (not runtime-reached). Kept
   `.gitignore dist/` + explicit `git add -f` (the existing convention; lower surprise than a
   negation that would auto-track non-runtime dist).
2. L19.2 — Packaging test (`plugins/codexclaw/test/packaging.test.mjs`): roots at the **6** runtime
   entrypoints (5 component `dist/cli.js` + `subagent-config/dist/mcp.js`), resolves the relative
   import graph with a whole-file (multi-line-safe) regex, and asserts every reached file is present
   and git-tracked via `git ls-files --error-unmatch`. Fails if any runtime dist file would not ship.

## Aquinas A-gate findings folded in

- HIGH: added `subagent-config/dist/mcp.js` as an entrypoint root (`.mcp.json` launches it).
- HIGH: dropped `rescan-coordinator.js` from the force-add set (not runtime-reached).
- MED: whole-file regex (not per-line) so multi-line `import { ... } from "./x.js"` blocks resolve.
- LOW (separate follow-up): no test proves committed `dist/` matches current `src/` before a build;
  `build.test.mjs` proves post-build idempotency only. Tracked as a future hardening item, not L19.

## DONE when

Every dist file transitively loaded by `bin` + the hook JSONs is git-tracked; the packaging test
fails if a runtime dist file is untracked; register C8 resolved. `gui/dist/` stays excluded with a
recorded rationale.

## Non-goals

- No npm publish pipeline (package is private; repo clone is the install vector).
- No build-on-install hook.
- gui production bundle is not tracked (dev-server runtime only).
