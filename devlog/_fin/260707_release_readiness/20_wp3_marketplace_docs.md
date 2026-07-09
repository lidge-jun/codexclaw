# 260707 release readiness — WP3 plan (marketplace prep + docs consistency)

Class: C3 (public contract metadata + docs). Archetype: spec-satisfaction.
Verifier: gate.mjs (plugin.json is gate-checked), npm test, docs-site build,
`codex plugin marketplace add` smoke against the public repo, checklist doc
exists with Tier-2 URLs.

## File change map (grounded in 01_research_marketplace_ci.md, Tier-2 proven)

| Path | Change |
|---|---|
| `.agents/plugins/marketplace.json` | `name: personal -> codexclaw` (collision with users' default personal marketplace); `interface.displayName -> Codexclaw`; plugin entry `category: Productivity -> Developer Tools` (align with plugin.json). |
| `plugins/codexclaw/.codex-plugin/plugin.json` | Add `repository`/`homepage`; `interface.defaultPrompt` string -> array (<=3 prompts, <=128 chars each); add `interface.websiteURL` (docs site). |
| `README.md` | Install line `codexclaw@personal -> codexclaw@codexclaw`. |
| `scripts/dev-symlink.sh` | `MARKETPLACE="personal" -> "codexclaw"` (line 17; cache path line 24 follows the var). Local-dev migration note goes in the checklist — the user's live `~/.codex/config.toml` still registers `personal`; we do NOT touch it (outside goal write scope). |
| `structure/INDEX.md` | Factual drift fix: "17 hook JSON files" + stale hook rows (lines ~174-195) -> 12 active manifest hooks (+_deprecated note). In scope per A-audit blocker 3. |
| `devlog/_plan/260707_release_readiness/30_marketplace_checklist.md` | NEW — submission checklist with Tier-2 source URLs + current status (public directory "coming soon"; git-marketplace is the live path). |
| docs-site content | Fix factual drift found by the docs-drift explorer (hook count, implicit set, install marketplace name, component list). Scope: factual fixes only. |

## Accept criteria

1. gate.mjs OK after plugin.json edits (gate checks counts/consistency).
2. `python3 -c json.load` passes on both JSON files; npm test green.
3. `codex plugin marketplace add https://github.com/lidge-jun/codexclaw.git`
   + `codex plugin list --marketplace codexclaw --available` shows codexclaw
   (activation scenario for the rename — local smoke via real codex CLI).
   Collision resolution (A-audit blocker 2): run the smoke under a TEMP
   `CODEX_HOME=$(mktemp -d)` so the live `personal` registration +
   `codexclaw@personal` install in `~/.codex/config.toml` are untouched; the
   checklist records the local-dev migration steps instead.
4. Checklist doc exists, cites opened URLs, and marks the OpenAI public
   directory as "coming soon" (not a fabricated submission flow).
5. docs-site build exit 0 after content fixes; drift items closed or logged.
