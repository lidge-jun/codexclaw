# codexclaw — Codex plugin marketplace submission checklist

Status date: 2026-07-07 (KST). All requirement claims below were Tier-2 proven
(source opened) by the marketplace research explorer on 2026-07-07; see
`01_research_marketplace_ci.md` for the full claim ledger.

## Distribution reality (2026-07)

- There is **no OpenAI-operated public directory submission flow yet** — the
  official docs say "Public Directory (coming soon)".
  Source: https://developers.openai.com/codex/plugins
- The live public distribution path is a **Git marketplace**: users run
  `codex plugin marketplace add lidge-jun/codexclaw` (or the https URL), then
  `codex plugin add codexclaw@codexclaw`.
  Source: https://developers.openai.com/codex/plugins/build + codex-cli 0.142.5 help.
- openai/plugins is curated, collaborators-only PRs — not a submission funnel.
  Source: https://api.github.com/repos/openai/plugins
- No signing requirement documented for Git marketplace distribution.
  Source: https://help.openai.com/en/articles/20001256-plugins-in-codex

## Readiness checklist

- [x] Repo public: `gh repo view` -> PUBLIC (2026-07-07).
- [x] `.codex-plugin/plugin.json` present with `name`, `version`,
      `description`, `author`, `license`, `skills`, `hooks`, `mcpServers`,
      `interface` (displayName, descriptions, developerName, category,
      capabilities).
- [x] `repository` + `homepage` + `interface.websiteURL` added (this WP).
- [x] `interface.defaultPrompt` converted string -> array of 3 prompts,
      each <=128 chars (spec: plugin-json-spec.md, openai/codex repo).
- [x] Marketplace renamed `personal` -> `codexclaw`
      (`.agents/plugins/marketplace.json`), categories aligned to
      `Developer Tools` in both manifests.
- [x] LICENSE (MIT + third-party notices) at repo root; README public pass.
- [x] CI green + Pages docs site live (https://lidge-jun.github.io/codexclaw/).
- [ ] Optional polish (not blocking): `composerIcon` / `logo` / `logoDark` /
      screenshots under `plugins/codexclaw/assets/` for directory presentation.
- [ ] When the OpenAI Public Directory opens: re-check manifest requirements
      against the submission form; the `hooks` top-level field currently has a
      docs/validator mismatch (Build docs allow it; plugin-creator
      validate_plugin.py rejects unknown top-level `hooks`) — re-verify against
      the runtime you target before submitting.

## Install smoke (fresh CODEX_HOME)

Run under a temp home so the live `personal` dev registration is untouched:

```bash
CODEX_HOME=$(mktemp -d) codex plugin marketplace add https://github.com/lidge-jun/codexclaw.git
CODEX_HOME=<same dir> codex plugin list --marketplace codexclaw --available
CODEX_HOME=<same dir> codex plugin add codexclaw@codexclaw
```

Result: recorded in WP3 C-phase evidence (see goalplan ledger).

## Local-dev migration (this machine, manual, OUT of automated scope)

The live `~/.codex/config.toml` still registers this repo as marketplace
`personal` with `codexclaw@personal` installed. After this rename lands, when
convenient: `codex plugin remove codexclaw@personal`, `codex plugin
marketplace remove personal`, re-add via `codex plugin marketplace add
<repo-root>` (now named `codexclaw`), `codex plugin add codexclaw@codexclaw`,
then re-run `scripts/dev-symlink.sh` (now targeting the codexclaw cache path).

## Update flow for users

`codex plugin marketplace upgrade codexclaw` then reinstall/upgrade the plugin
as needed.
