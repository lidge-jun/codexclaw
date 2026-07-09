# 260707 release readiness — research capture (Tier-2 proven, 2026-07-07 KST)

Two gpt-5.5(xhigh) explorers with `$cxc-search` attached. All claims below were
source-opened (Tier 2) by the explorers unless marked unverified.

## A. Codex plugin marketplace / distribution (explorer "Boyle")

Verified claims (URL = opened source):

- Plugins are packaged capabilities; `.codex-plugin/plugin.json` is required and
  may bundle skills, MCP servers, apps, hooks, commands, assets.
  https://developers.openai.com/codex/plugins/build , openai/plugins README.
- Distribution today = in-app Plugin Directory, workspace sharing, default local
  marketplaces, configured local/Git marketplaces. **Public OpenAI-operated
  directory self-publishing is "coming soon"** — not currently available.
  https://developers.openai.com/codex/plugins ,
  https://help.openai.com/en/articles/20001256-plugins-in-codex
- Git marketplace install flow (the real public distribution path for us):
  `codex plugin marketplace add <owner/repo|https-git-url>` then
  `codex plugin add <plugin>@<marketplace>`. Verified against docs and local
  `codex-cli 0.142.5` help.
- `marketplace.json` shape: `name`, optional `interface.displayName`, ordered
  `plugins[]` with `name`/`source`/`policy`/`category`.
  plugin-json-spec.md (openai/codex repo, raw) + openai/plugins marketplace.json.
- Recommended manifest metadata: `interface.displayName`, descriptions,
  `developerName`, `category`, `capabilities`, URLs, `defaultPrompt`,
  `brandColor`, icons/logos, screenshots.
- `defaultPrompt` is documented as **up to 3 starter prompts, each <=128 chars**
  (array), not a single string (plugin-json-spec.md).
- No documented signing requirement for Git marketplace distribution.
- openai/plugins is curated; PR creation is collaborators-only (GitHub API) —
  not a public submission funnel.
- Docs/tooling mismatch: Build docs allow top-level `hooks` in plugin.json but
  the plugin-creator `validate_plugin.py` rejects unknown top-level `hooks`.
  Our runtime (codex-cli 0.142.x) loads our hooks today; keep `hooks`, note the
  validator drift in the checklist.

Unverified leads (do NOT act on): `codex plugin publish` (no such command in
CLI help), codex-marketplace.com "Submit Plugin" (explicitly not affiliated
with OpenAI).

### Actionable deltas for codexclaw (feeds WP3)

1. Rename marketplace `name` from `personal` (collides with users' default
   personal marketplace) -> `codexclaw`.
2. Align categories: marketplace.json says `Productivity`, plugin.json says
   `Developer Tools` — pick `Developer Tools` in both.
3. Add `repository`/`homepage` (+ optional `interface.websiteURL`) to
   plugin.json.
4. Convert `interface.defaultPrompt` string -> array of <=3 prompts, <=128
   chars each.
5. Optional polish: `composerIcon`/`logo`/`logoDark`/screenshots under
   `./assets/`.
6. Post-publish smoke: `codex plugin marketplace add
   https://github.com/lidge-jun/codexclaw.git`, `codex plugin list
   --marketplace codexclaw --available --json`, `codex plugin add
   codexclaw@codexclaw`.

## B. Release hygiene + Actions versions (explorer "Bernoulli")

Verified claims (all opened 2026-07-07):

- gitleaks latest v8.30.1 (2026-03-21), `gitleaks git` is the current command
  family (we ran 8.x: history scan `--log-opts` available). trufflehog latest
  v3.95.8 (2026-07-02), `trufflehog git file://... --results=verified,unknown`.
- Current action majors: `actions/checkout@v7` (2026-06-18),
  `actions/setup-node@v6` (2026-04-20), `withastro/action@v6` (2026-04-20),
  `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`,
  `actions/deploy-pages@v5` (2026-03/04). Astro's own Pages guide uses
  checkout@v7 + withastro/action@v6 + deploy-pages@v5 with permissions
  `contents: read, pages: write, id-token: write` and environment
  `github-pages`. https://docs.astro.build/en/guides/deploy/github/
- Pages on a custom workflow requires source = GitHub Actions; enable via
  Settings or `gh api --method POST /repos/<o>/<r>/pages -F build_type=workflow`
  (PUT to update). https://docs.github.com/en/rest/pages/pages
- Visibility flip: `gh repo edit <o>/<r> --visibility public
  --accept-visibility-change-consequences` (flag verified in gh manual + local
  help).
- Community health files for public repos: README, LICENSE, CODE_OF_CONDUCT,
  CONTRIBUTING, SECURITY, issue templates (GitHub community profile docs).

## Local evidence (main session, fresh 2026-07-07)

- `gitleaks git .` — 346 commits, **no leaks** (report:
  `.codexclaw/evidence/release_readiness/gitleaks_history.json`).
- `gitleaks dir .` — 1045 findings, all in gitignored paths (1037 `.codexclaw/`
  state, 5 reference clones under devlog, 3 `plugins/codexclaw/.codexclaw/`);
  `git check-ignore -v` + `git ls-files` confirm zero tracked hits.
- `npm test` — 798 pass / 0 fail. `gate.mjs` — OK.
- `(cd docs-site && npm run build)` — 25 pages, exit 0.
