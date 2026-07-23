# 001 — codexclaw deploy-readiness audit (research)

Date: 2026-07-23. Auditor: Sol subagent "Nash" (read-only), main-agent spot checks.
Verdict: COMPLETE. Fresh `npm test`: **1,201 passed / 0 failed**.

## Manifest & marketplace

- Marketplace manifest: `.agents/plugins/marketplace.json` (repo root), marketplace
  name `codexclaw`, plugin `codexclaw`, local source `./plugins/codexclaw`,
  policy AVAILABLE / ON_INSTALL. This path is one of codex-rs's supported
  `MARKETPLACE_MANIFEST_RELATIVE_PATHS` (also `.claude-plugin/marketplace.json`).
- Plugin manifest `plugins/codexclaw/.codex-plugin/plugin.json`: name/version
  `codexclaw@0.1.0`, MIT, `skills: ./skills/`, **18** hook JSON registrations,
  `mcpServers: ./.mcp.json`, full interface block (displayName, brandColor #D7010F,
  screenshots, defaultPrompt). All referenced paths exist on disk — no dangling refs.
- Local install confirmed working: `~/.codex/config.toml` has marketplace source →
  this repo and `[plugins."codexclaw@codexclaw"]`; cache at
  `~/.codex/plugins/cache/codexclaw/codexclaw/0.1.0/`.

## Versioning / publish state

- Root `package.json`: `0.1.0`, `"private": true`. All 8 components, GUI, CLI
  workspace: `0.1.0` private. Docs site: `0.0.1` private.
- No CHANGELOG anywhere.
- Not npm-publishable as-is (private) — and not needed for the git-marketplace route.

## README accuracy (claim → verified)

| Claim | Verified | Status |
|---|---|---|
| 29 skills | 27 skill dirs (28 entries incl. `skills/README.md`) | WRONG |
| 14 hooks | 18 hook JSONs declared + on disk | WRONG |
| "13 surface-specific routers" | 12 `dev-*` routers + canonical parent `dev` | WRONG |
| 1,110 tests passing | 1,201 passing (fresh run) | STALE |
| 8 isolated components | 8 component dirs | OK |
| Architecture `plugins/codexclaw/cli/` | does not exist; CLI = root `bin/codexclaw.mjs` + root `cli/` + component entrypoints | WRONG |
| Hooks lifecycle list | omits recall + bg-terminal affordance hooks (4 newer) | STALE |
| Docs badge/section → `pabcd_initiative` | plugin docs site is `lidge-jun.github.io/codexclaw/` (Astro configured, Pages workflow live) | STALE |
| Logo `docs-site/public/logo.png` | exists, tracked | OK |
| CI badge → `ci.yml` | exists (ubuntu+windows, npm test + gate.mjs) | OK |
| `README.ko.md` / `README.zh.md` | both exist, 144 lines, section-parity with EN; same factual drift | STRUCTURALLY SYNCED |

## dist / build ship-state

- All 8 component `dist/` outputs are git-TRACKED (109 files) despite root
  `.gitignore` `dist/` (tracked-before-ignore). Hooks invoke
  `node ${PLUGIN_ROOT}/components/<name>/dist/cli.js` → clean clone works with no
  build step. Root `build.mjs` compiles components only.
- **Gap:** `plugins/codexclaw/gui/dist` exists locally (7 files) but is untracked →
  clean marketplace install lacks the dashboard; messenger-bridge resolves
  `gui/dist` at runtime and reports "GUI build missing" (`server.ts`).

## Release blockers (severity)

1. High — GUI dashboard cannot run from a clean install (gui/dist untracked).
2. High — README capability counts wrong in all 3 languages (27/18/12 vs 29/14/13).
3. Med — test badge stale (1,110 → 1,201), static badge with no SoT linkage.
4. Med — architecture tree mislocates CLI.
5. Med — docs branding split: badge/Documentation → pabcd_initiative, while plugin
   manifest homepage + Pages deployment = `/codexclaw/`.
6. Med — devlog is public (753 tracked files incl. 57 `_plan`) — needs explicit
   release decision (plugin payload is only `plugins/codexclaw/`, so devlog does not
   ship to installs; it is a repo-hygiene question, not a payload leak).
7. Low — no CHANGELOG.
8. Low — npm publication blocked by design (private); README must not imply npm install.
9. Low — docs deployment config coherent (Pages workflow → `docs-site/dist`,
   Astro base `/codexclaw`).

## A-phase addendum (main-agent verified 2026-07-23, reviewer Ampere findings)

10. High — CLI outside payload: `plugins/codexclaw/` contains `agents/ assets/
    components/ gui/ hooks/ scripts/ skills/ test/` — NO `bin/`, NO `cli/`.
    `bin/codexclaw.mjs` and the `cli/` workspace live at REPO ROOT, outside the
    marketplace source. Clean marketplace install → hooks/MCP run (they invoke
    `node ${PLUGIN_ROOT}/components/*/dist/cli.js`), but no `cxc` command reaches
    the user's PATH. README's CLI section is unsubstantiated for marketplace users.
11. High — docs-site more stale than README (the proposed NEW primary link):
    `docs-site/src/content/docs/index.mdx:137,194` "25 skills"; `index.mdx:162`
    "801 tests"; `getting-started/installation.md:60` + `reference/hooks.md:6`
    "twelve hooks"; GUI advertised as shipped. All confirmed by rg on 2026-07-23.
12. Med — rule-ID recount (supersedes the 240 artifact): file-prefix-stripped
    dedup yields **155** unique rule IDs in the dev family. Correct command:
    `rg -o -N "[A-Z][A-Z0-9]*(-[A-Z0-9]+)+-[0-9]{2}" plugins/codexclaw/skills/dev
    plugins/codexclaw/skills/dev-* | sed 's/^[^:]*://' | sort -u | wc -l` → 155.
    (Unstripped pipe counts file:line duplicates → 240; README's "146" is simply
    old. No substantiation exists for "33 cross-reference pairs" — drop the clause.)
13. Med — hook metric pinned: **18 active manifest registrations**; 21 JSON files
    on disk, the extra 3 under `hooks/_deprecated/` (post-tool-use-capturing-
    shell-friction, pre-tool-use-advising-on-friction,
    session-start-injecting-project-rules). All public counts must say 18.
