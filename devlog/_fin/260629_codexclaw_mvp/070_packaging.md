# 070 — Packaging & Marketplace (cross-phase)

Status: DONE (build aggregation) — Pass 7 B/C. Marketplace remote install documented, not executed.

## Goal
Make codexclaw installable as one plugin via the marketplace path.

## Behavior
- `scripts/build.mjs`: compile each component src→dist; aggregate skills/hooks/agents into the
  plugin root so it installs as one plugin (omo build pattern).
- Aggregation divergence from omo: codexclaw already keeps `skills/`, `hooks/`, `agents/` directly
  under the plugin root, so "aggregation" = (a) compile components→dist in place via
  `node:module.stripTypeScriptTypes` (zero external toolchain, Node 24), (b) validate the single-plugin
  layout. No component-dist→root copy step is needed (unlike omo's monorepo).
- Build is reproducible + idempotent (byte-identical across runs, asserted by `test/build.test.mjs`).
- Install:
  - `codex plugin marketplace add https://github.com/lidge-jun/codexclaw`
  - `codex plugin add codexclaw@personal`
  (documented for Phase 1; a real network `codex plugin add` is out of the offline gate scope.)

## Verify (Pass 7)
- `npm run build` → 12 files compiled, single-plugin layout validated, exit 0.
- `test/build.test.mjs`: idempotency, every manifest-referenced dist entry exists, `.ts`→`.js`
  specifier rewrite, compiled hook runs end-to-end, MCP server completes initialize handshake,
  no `[TODO]`/placeholder markers in manifest + component src/** + dist/**.
- `dist/` is committed so the marketplace install path works without a post-clone build (omo ships
  built artifacts the same way); the idempotency test guards against src/dist drift.
