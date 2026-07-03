# 30 — Phase 3: ocx models surface in the catalog (DOD 5)

- Class: C2 (one component + tests) · B verification: CLI sub-agent + throwaway serve e2e
- Root cause (00_research §1b): `readNativeCacheDefault` (catalog.ts) reads ONLY
  `env.CODEX_MODELS_CACHE_PATH`, which nothing sets → falls back to 4 hardcoded
  natives; the ocx-synced routed slugs never load. Ground truth verified on this
  machine: `~/.codex/models_cache.json` exists, shape `{models:[{slug,…}]}`, 11
  entries incl. `anthropic/claude-*` and `opencode-go/*` routed slugs. opencodex
  resolves the path as `join(CODEX_HOME, "models_cache.json")`
  (opencodex/src/codex-paths.ts:30), CODEX_HOME defaulting to `~/.codex`.

## Part 1 — plain

The model dropdown finally shows the ocx-routed models (claude etc.) whenever the
Codex models cache exists — no env var required. Catalog state reports "ocx-active"
when routed models actually surfaced.

## Part 2 — diff-level

### MODIFY `plugins/codexclaw/components/subagent-config/src/catalog.ts`
- `readNativeCacheDefault(env)`: resolve path as
  `env.CODEX_MODELS_CACHE_PATH ?? join(env.CODEX_HOME ?? join(homedir(), ".codex"), "models_cache.json")`.
  Import `homedir` from `node:os`, `join` from `node:path`. Read/allowlist logic unchanged.
- `buildCatalog()`: when provider mode is "provider" with `ocxModels === undefined`,
  return state `"ocx-active"` if any built entry has `source === "ocx"` (routed slugs
  arrived via the cache sync channel — "unsupported" is a lie then); otherwise keep
  `"unsupported-ocx-catalog"`.

### MODIFY `plugins/codexclaw/components/subagent-config/test/catalog.test.ts`
- New cases: (a) env CODEX_HOME pointing at a tmp dir containing models_cache.json
  with native + routed slugs → routed entries labeled (ocx), natives first;
  (b) no env + no file → 4-native fallback unchanged (pass explicit fake env, never
  the real home); (c) provider mode + cache-borne routed slugs → state "ocx-active".

### Rebuild + e2e
- `npm run build` (dists) — running user serve keeps OLD module (restart needed,
  user-owned terminal process; deferred). E2E instead via a THROWAWAY
  `cxc serve --port 7733 --cwd <tmpdir>` child: GET /api/catalog → expect 11 entries
  incl. anthropic/* → kill child. Proves the fix live without touching the user's process.

## Risks
- `readNativeCacheDefault` currently takes `env = process.env` — keep signature;
  homedir fallback only when both env vars absent. Tests must inject fake env so CI
  machines with a real ~/.codex don't flake.
- catalog.test.ts existing fixtures use `readNativeCache` injection — unaffected.
