# messenger_bridge — Phase 1: serve + state substrate

Status: SHIPPED (D closed 2026-07-03; messenger-bridge suite 14/14, full suite
554/556 — the 2 fails are pre-existing astgrep-WIP artifacts, see D record;
gate OK; live smoke: health/static/subagents-parity/404/db-600/SIGINT-clean)
· class C3 · zero new runtime deps

## D record (2026-07-03)

- Built: `components/messenger-bridge/` (`src/db.ts` 340 lines, `src/server.ts`
  190, `src/api-compat.ts` 120, `src/cli.ts` 120; `test/db.test.ts` 7 tests,
  `test/server.test.ts` 7 tests). Wired: `scripts/build.mjs` COMPONENTS,
  `bin/codexclaw.mjs` serve delegator + usage, root `package.json` test glob.
- Verification: `npm run build` OK (62 files); component suite 14/14;
  `npm run gate` OK; live smoke on :7717 — `/api/health`
  `{"ok":true,...,"activeChannel":null}`, static index 200 text/html,
  `/api/subagents` returns real role config (GUI parity confirmed against the
  actual gui/dist), unknown api 404 JSON, `bridge.db` mode `-rw-------`,
  SIGINT → clean exit.
- Pre-existing failures NOT from this phase (evidence): full-suite fails are
  `WP7/G19 manifest hook count` (expects 16, manifest has 17 — the 17th is
  `post-tool-use-detecting-edit-shapes.json` from the astgrep session) and
  `L19 dist git-tracked` (untracked `pabcd-state/dist/edit-shape.js`, compiled
  from the astgrep session's uncommitted `src/edit-shape.ts` when this phase
  rebuilt). Both reference only astgrep-WIP files; owned by that track.
- Follow-up for the user's commit step: messenger-bridge `dist/` must be
  git-added so it ships on clone (same rule L19 enforces for hook dists).

## Audit findings incorporated (A gate, 2026-07-03)

1. `DatabaseSync` has NO `.transaction()` helper on Node v24.14.1 — repo
   convention is `db.exec("BEGIN"/"COMMIT"/"ROLLBACK")`
   (`components/recall/src/ingest.ts:113,145,147`). db.ts uses exec-style
   transactions.
2. The GUI's fetch surface (`gui/src/api.ts:77,86`) expects
   `GET/POST /api/subagents`, `GET /api/catalog`, `GET /api/provider` — today
   served only by the Vite dev middleware (`gui/src/server/middleware.ts`).
   Served statically by cxc serve those would 404 and saves would silently
   fail. Fix: NEW `src/api-compat.ts` mirrors the middleware routes by
   importing the already-compiled component dists
   (`../../subagent-config/dist/store.js`, `.../catalog.js`,
   `../../provider-bridge/dist/detect.js` — relative `.js` specifiers pass the
   build rewrite untouched and resolve identically from src and dist). The
   ~40-line detectDeps/providerToCatalogInput glue is mirrored from
   `gui/src/server/{middleware,handlers}.ts` with a source-of-truth comment;
   Phase 6 unifies the GUI middleware onto this module to remove the
   duplication.

## Part 1 — plain

`cxc serve` becomes a real command: it boots one HTTP port that serves the GUI
build statically and exposes `/api/health`. Underneath it opens
`<cwd>/.codexclaw/bridge.db` (node:sqlite) with schema v1 — channels (telegram/
discord rows, token, single-active flag), allowlist (handshaked chat ids),
bindings (chat ↔ codex thread), jobs (run log). Everything later phases need to
persist already has a home, and restarting serve loses nothing.

## Part 2 — diff-level

### NEW `plugins/codexclaw/components/messenger-bridge/package.json`

```json
{
  "name": "@codexclaw/messenger-bridge",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "codexclaw messenger bridge — cxc serve HTTP server + SQLite state substrate (zero third-party deps).",
  "scripts": { "test": "node --test" }
}
```

### NEW `plugins/codexclaw/components/messenger-bridge/src/db.ts`

- `openBridgeDb(cwd: string): BridgeDb` — mkdir `.codexclaw/`, open
  `DatabaseSync` at `.codexclaw/bridge.db`, `chmod 600`, run migrations gated
  by `PRAGMA user_version` (v1 creates channels/allowlist/bindings/jobs as in
  00_plan Contracts; bindings UNIQUE(channel_kind, chat_id)).
- `BridgeDb` methods (all synchronous, prepared statements):
  `getChannel(kind)`, `setChannelToken(kind, token)`,
  `setActiveChannel(kind | null)` (transaction: zero all, set one),
  `getActiveChannel()`, `addAllowlist(kind, chatId, label)`,
  `isAllowed(kind, chatId)`, `listAllowlist(kind)`,
  `getOrCreateBinding(kind, chatId, workdir)`,
  `setBindingThread(id, threadId)`, `setBindingStatus(id, status)`,
  `listBindings()`, `createJob(bindingId, promptPreview)`,
  `updateJob(id, patch)`, `listJobs(bindingId, limit)`, `close()`.
- Types exported for later phases: `ChannelKind = "telegram" | "discord"`,
  `ChannelRow`, `BindingRow`, `JobRow`.

### NEW `plugins/codexclaw/components/messenger-bridge/src/server.ts`

- `createBridgeServer(opts: { cwd; guiDir; version }): { server: http.Server; routes }`
  — node:http. Routing:
  - `GET /api/health` → 200 `{ ok: true, version, activeChannel }` (reads db).
  - `/api/*` unknown → 404 JSON `{ error }`.
  - Static: resolve under `guiDir` ONLY (path-traversal guard: resolved path
    must start with guiDir), content-type map (html/js/css/svg/png/json/ico),
    SPA fallback → `index.html`; if guiDir/index.html missing → 200 plain page
    "GUI build missing — run: npm run build in plugins/codexclaw/gui".
- Extensibility seam for later phases: exported `ApiRoute` registry
  (`method`, `path` prefix, handler(req, url, ctx) → {status, body}) so Phase 5
  adds connect/manage endpoints without rewriting the server.

### NEW `plugins/codexclaw/components/messenger-bridge/src/cli.ts`

- Pattern-copy of `cxc-ops/src/cli.ts` (main(argv, metaUrl), direct-exec
  guard). Subcommand `serve [--port <n>] [--cwd <path>]`:
  default port 7717, cwd = process.cwd(). Resolves guiDir =
  `<pluginRoot>/gui/dist` from compiled file location. Prints
  `cxc serve: listening on http://127.0.0.1:<port>` and stays up (SIGINT →
  graceful close of http + db). Binds 127.0.0.1 ONLY (loopback; remote access
  is the messengers' job, not the HTTP port's).

### NEW tests `plugins/codexclaw/components/messenger-bridge/test/db.test.ts`, `test/server.test.ts`

- db: schema creates once + user_version=1; token set/get; single-active
  invariant (activating discord deactivates telegram); allowlist add/check;
  binding get-or-create idempotent per (kind, chatId); job lifecycle patch;
  reopen persists (state survives restart).
- server: health 200 shape; unknown api 404; static index served from a temp
  guiDir; traversal `GET /../../etc/passwd` stays inside guiDir (404/SPA);
  missing guiDir → degraded message. Ephemeral port (listen 0).

### MODIFY `plugins/codexclaw/scripts/build.mjs`

```diff
-export const COMPONENTS = ["pabcd-state", "config-guard", "provider-bridge", "subagent-config", "cxc-ops", "recall"];
+export const COMPONENTS = ["pabcd-state", "config-guard", "provider-bridge", "subagent-config", "cxc-ops", "recall", "messenger-bridge"];
```

### MODIFY `bin/codexclaw.mjs`

- Header comment: add `codexclaw serve` line.
- New const `messengerBridgeCli` (same join pattern) + `runServe(args)`
  delegator using `spawnSync(process.execPath, [messengerBridgeCli, ...args], { stdio: "inherit" })`.
- `case "serve": process.exit(runServe(process.argv.slice(2)));`
- Usage string: add `serve`.

### MODIFY root `package.json`

- test script: append `"plugins/codexclaw/components/messenger-bridge/test/*.test.ts"` glob.

## Verification (C gate)

- `npm run build` → messenger-bridge compiles, layout validation OK.
- `node --test plugins/codexclaw/components/messenger-bridge/test/*.test.ts` → green.
- Live: `node bin/codexclaw.mjs serve --port 7717` → curl health 200; curl
  static; Ctrl-C clean exit; `.codexclaw/bridge.db` mode 600.

## Notes / accepted quirks

- node:sqlite ExperimentalWarning on stderr — cosmetic on Node 24.14; not
  suppressed (no --disable-warning plumbing through the delegator yet).
- `jobs.state` values fixed in Phase 2 (queued|running|done|error) — schema is
  TEXT, no CHECK, so Phase 2 needs no migration.
