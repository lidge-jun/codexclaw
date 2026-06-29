# 01 — Repo & Plugin Skeleton

Status: DONE (2026-06-29)

## Goal
Stand up the codexclaw monorepo with a valid single-plugin scaffold + marketplace entry.

## Done
- `plugins/codexclaw/.codex-plugin/plugin.json` (skills + 3 hooks + mcpServers + interface).
- `.agents/plugins/marketplace.json` (personal marketplace, codexclaw entry).
- Component skeletons: `provider-bridge`, `pabcd-state`, `subagent-config` (package.json + src stub each).
- `skills/pabcd/SKILL.md` + `skills/README.md` (dev-* migration note).
- `agents/{explorer,reviewer,executor}.toml`.
- `gui/README.md`, `cli/` + `bin/codexclaw.mjs`, root `package.json`, root `README.md`, `build.mjs` stub.
- `devlog/.lazycodex` reference clone.

## Verify
- `python3 .../validate_plugin.py plugins/codexclaw` passes.

## Next
02_provider_bridge.
