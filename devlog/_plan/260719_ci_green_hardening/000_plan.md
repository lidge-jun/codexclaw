# 260719 CI Green Hardening — Plan

Loop archetype: spec-satisfaction repair. Verifier: GitHub CI `test (ubuntu-latest)` + `test (windows-latest)` both `success` on `main`, plus local `npm test` green on macOS. Trigger: 2026-07-19 push (d51d3848) CI failure. Terminal: DONE = both lanes green; anything less is reported honestly.

## Failure inventory (CI run 29688404179)

- ubuntu (3): `uninstall/status are safe no-ops when not installed`, 2 spawn-hook e2e tests.
- windows (~45): same 3 + EPERM teardown mass-failures (telegram/discord adapter, 55 EPERM), retrustHooks x5, ast-grep/skill frontmatter x2, multiline TOML, F1 dist-freshness, L18 structure scan, L19 runtime graph, L15 SURFACE_SKILL, dispatcher bootstrap ladder, servicePaths, v2 mention normalization compose.

## Root causes (grounded in code)

1. **Stale test contracts (both OS)** — 260713 WP2 surface-split (`devlog/_plan/260713_subagent_injection_audit/00_overview.md`) made v1 spawns take `V1_SCOPE_BLOCK` (`[CXC-SUBAGENT-SCOPE]`), but wip commit 3a10095b never updated `hook-e2e.test.mjs`, which still expects aa227ffc parity (`[CXC-LEAF-GUARD]` on v1). `service.test.ts` still asserts "non-darwin = unsupported" although `service.ts` grew systemd (linux) + Task Scheduler (win32) branches in 23e2fee2.
2. **CRLF (windows)** — repo has NO `.gitattributes`; Windows checkout uses CRLF. `dist-freshness.test.mjs` F1 compares `compileSource(src)` byte-exact against committed LF dist; frontmatter/TOML/structure-scan regexes expect `\n`. Single fix: enforce LF at checkout.
3. **Illegal filename (windows)** — `hook-trust.ts:423` backup path `${targetPath}.bak-${new Date().toISOString()}` contains `:` (illegal on NTFS) -> ENOENT on copyfile. 5 retrust tests + CLI test.
4. **EPERM teardown (windows)** — adapter tests `rmSync(cwd)` in `finally` while SQLite db / poller handles are still open (only 1 of ~12 tests calls `db.close()`). NTFS refuses directory delete with open handles.
5. **Path separators (windows)** — L19 runtime-graph walker, L15 SURFACE_SKILL, v2-mention-compose, dispatcher ladder assertions assume `/`.

## Tasks (dependency-ordered)

- **T1 e2e surface-split sync** — `plugins/codexclaw/test/hook-e2e.test.mjs`: the two `260710:` tests expect `[CXC-SUBAGENT-SCOPE]` prefix for v1-surface payloads (`spawn_agent` + no `task_name`), keep `[CXC-LEAF-GUARD]` for v2 payloads; rename tests `260710:` -> `260713:` and fix assertion messages. Local-verifiable.
- **T2 service test platform contract** — `messenger-bridge/test/service.test.ts`: `servicePaths` asserts per-platform paths (darwin plist / linux systemd unit / win32 Task Scheduler shape per `servicePaths()` impl); `uninstall/status no-op` asserts the real per-platform "not installed" contract from `service.ts` branches. Local(mac)-verifiable for darwin branch; linux/win branches verified via CI.
- **T3 backup filename sanitize** — `cxc-ops/src/hook-trust.ts:423`: `.bak-${toISOString()}` -> `.bak-${toISOString().replace(/[:.]/g, "-")}`; update `hook-trust.test.ts` backup-path assertions if they pattern-match the suffix; rebuild dist.
- **T4 `.gitattributes` LF enforcement** — new root file: `* text=auto eol=lf`. Expected to close F1, both frontmatter tests, multiline TOML, L18 structure scan, dispatcher ladder. (Verify on CI; residual path-separator items go to T5.)
- **T5 EPERM + path-separator sweep** — messenger-bridge adapter tests: close `BridgeDb`/abort pollers before `rmSync`, add retrying rm helper (`rmRfRetry`, ~5 attempts, 100ms backoff) shared per test file; inspect and fix L19 walker / L15 SURFACE_SKILL / v2-mention-compose separator assumptions if T4 didn't already fix them.

## Scope boundary

- IN: test files, `hook-trust.ts` backup naming + dist rebuild, `.gitattributes`, adapter test teardown helpers.
- OUT: production behavior changes beyond T3's filename sanitize; messenger-bridge feature work; any push not to `origin main`; macOS-local-only "green" claims (Windows verified via CI runs only).

## Acceptance

- Local: `npm test` exit 0 on macOS.
- CI: one run with both lanes `success` on `main` (push authorized by user for this CI-green scope; iterate until green or report BLOCKED with evidence).

## Amendments (A-gate round 1, reviewer GO-WITH-FIXES blockers=5 — all folded)

- **T1+**: also normalize skill-link path assertions in both e2e tests — runtime emits `skill://D:\...` on Windows; use `[\\/]`-tolerant regexes for every `skill://` expectation (hook-e2e.test.mjs:713, :729 and siblings). Reviewer confirmed `v1Model` case IS v1-surface (no `task_name`).
- **T2 narrowed**: do NOT invent platform path exports (`unitPath`/`windowsScriptPath` are private). `servicePaths` test gates plist-literal assertions to darwin; `uninstall/status no-op` asserts exact current per-platform returns: darwin/linux/win32 all `{ok:true,"cxc service: not installed."}` when absent; linux status may be `"cxc service: systemd not available."` when systemctl missing.
- **T5 broadened + reordered**: covers ALL messenger-bridge tests using `openBridgeDb(cwd)` + `rmSync(cwd)` (incl. `gateway-commands.test.ts`, not just the two adapters). Teardown order: `adapter.stop()` -> `db.close()` -> retrying rm (retry is only the last-resort NTFS grace, never the primary fix).
- **NEW T6 Windows path normalization** (owns every separator/import failure T4 does not):
  - `scripts/gate.mjs:172` — replace `f.replace(repoRoot + "/", "")` with `relative(repoRoot, f).split(sep).join("/")` (fixes L18 checkForbiddenClaims).
  - `subagent-config/test/spawn-attach-hook.test.ts:512` — skill-link regex separator-tolerant (v2 mention normalization compose).
  - `subagent-config/test/spawn-wrapper.test.ts:172` — L15 SURFACE_SKILL `/skills/` expectation separator-tolerant.
  - `plugins/codexclaw/test/packaging.test.mjs:93-99` — runtime-graph keys normalized to POSIX (L19 walker sanity).
  - `plugins/codexclaw/test/repo-map-packaging.test.mjs:80-82` — dynamic import via `pathToFileURL(...)` (fixes `d:` URL scheme).
  - `messenger-bridge/test/server.test.ts:342-348` — parseServeArgs expectation platform-aware.
  - `pabcd-state/test/goal-active.test.ts:28-30` — resolveGoalsDbPath expectation platform-aware.
- **Acceptance+**: pre-CI grep gate — no hardcoded POSIX-absolute path expectations left in the test files touched by T1/T5/T6 (evidence: rg output in C attest).
