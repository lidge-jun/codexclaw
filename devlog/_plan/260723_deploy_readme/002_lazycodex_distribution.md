# 002 — LazyCodex distribution research (reference)

Date retrieved: 2026-07-23. Researcher: Sol subagent "Heisenberg" (read-only;
local vendored snapshot `devlog/.lazycodex/` + live npm/GitHub/docs).
Verdict: COMPLETE.

## Distribution chain

1. Public entry: `npx lazycodex-ai install` — thin npm alias; its bin rewrites to
   `npx --yes --package oh-my-openagent omo install --platform=codex`.
   `doctor`/`update`/`uninstall` forward to the `omo` CLI.
2. Real payload = `oh-my-openagent` / plugin `omo`. The wrapper npm package ships
   only `bin`, `README.md`, `LICENSE`.
3. npx install builds/copies the plugin into
   `~/.codex/plugins/cache/sisyphuslabs/omo/<version>/`, writes a cached marketplace
   manifest, stamps `lazycodex-install.json` (provenance: npx-local flow), links
   executables + agent TOMLs, installs pinned ast-grep/MCP runtimes.
4. The installer DOES write `~/.codex/config.toml`: `[marketplaces.sisyphuslabs]`,
   `[plugins."omo@sisyphuslabs"]`, MCP enablement, hook trust hashes, `[agents.*]`.
5. Autonomous permissions are an explicit opt-in flag
   (`install --no-tui --codex-autonomous`); default install never touches permission
   policy.
6. Alternative path (documented experimental): native marketplace —
   `codex plugin marketplace add https://github.com/code-yeongyu/lazycodex` then
   `codex plugin add omo@sisyphuslabs`; a SessionStart bootstrap hook then provisions
   the non-static pieces.
7. Hooks are inert until Codex approval; after upgrades they show `Modified` and
   need re-approval (trusted content hashes change).
8. Runtime state is project-local/file-backed (`.omo/...`) via lifecycle hooks —
   same architecture family as codexclaw's `.codexclaw/`.
9. Uninstall via wrapper removes owned caches/config sections only, with a
   timestamped `config.toml` backup.

## Manifest format

- Marketplace manifest lives at repo-root `.agents/plugins/marketplace.json`
  (NOT `.codex-plugin/`): `{ name: "sisyphuslabs", interface.displayName, plugins:
  [{ name: "omo", source: "./plugins/omo", category, policy }] }`.
- Plugin manifest `plugins/omo/.codex-plugin/plugin.json`: identity + `skills`,
  `hooks` (23 files across 7 lifecycle families at v4.19.1), `mcpServers`, and a
  rich `interface` block — same shape codexclaw already uses.

## Versioning & updates (live, 2026-07-23)

- `lazycodex-ai` npm latest = `4.19.1`; `oh-my-openagent` latest = `4.19.1`;
  GitHub release `v4.19.1` (2026-07-22); tagged plugin manifest `4.19.1`.
  Vendored snapshot is older (wrapper 0.2.2 / omo 4.13.0).
- One OmO-aligned SemVer across npm + tag + manifest. (Visible `main` manifest
  lagged at 4.19.0 — tags/npm are the authority; a sync artifact worth avoiding.)
- npx-local updates: SessionStart hook checks `npm view lazycodex-ai version`
  (24h throttle), re-runs installer, replaces versioned cache atomically.
- Marketplace installs: self-updater detects marketplace provenance (absence of
  `lazycodex-install.json`) and defers to `codex plugin marketplace upgrade`.

## Takeaways for codexclaw (adopt / avoid)

1. Native plugin is the product identity; any npm package is only a convenience
   installer. → codexclaw already conforms.
2. Repo-root `.agents/plugins/marketplace.json` with stable marketplace name +
   relative source. → codexclaw already conforms.
3. Support native marketplace install from day one. → codexclaw already conforms
   (README install commands match the verified CLI surface).
4. Add an npm wrapper ONLY if post-install provisioning outgrows static install.
   codexclaw ships committed component `dist/`; the only dynamic gap is `gui/dist`.
   → defer wrapper (decision D4).
5. Static install vs approved bootstrap separation: skills/hooks/MCP static;
   generated agents/links/runtimes provisioned by first approved SessionStart.
6. Never silently change permission policy.
7. ONE SemVer across tag, plugin manifest, any npm package, hook status messages.
8. Encode install provenance when two update systems could race (not needed while
   codexclaw has no self-updater).
9. Idempotent, ownership-scoped install/uninstall with config backup.
10. Ship `doctor` early — codexclaw has `cxc-ops` doctor utilities + `gate.mjs`;
    surface them in docs.

## Open questions (UNVERIFIED upstream, resolved for codexclaw where noted)

- LazyCodex's 0.2.2→4.19.1 publish automation not located (their problem, not ours).
- Native uninstall command: RESOLVED for codexclaw — `codex plugin remove
  codexclaw@codexclaw` exists in the live CLI (verified 2026-07-23).
- `.agents/plugins/marketplace.json` longevity: it is the live, accepted format
  today (both LazyCodex and codex-rs's supported paths list).
