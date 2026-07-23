# 010 — codexclaw deployment path (design, phase 1)

Consumes: `001` (readiness audit), `002` (lazycodex reference).
This doc is a design/decision record. File changes it prescribes inside this
loop: README changes land via `020`; docs-site synchronization lands via `030`.
Everything else is a flagged user decision.

## Verdict: codexclaw is already marketplace-native

The deployment path = **git marketplace primary, npm wrapper deferred (see D6
reassessment below)**.
codexclaw already matches every structural convention LazyCodex validates:

| Convention | codexclaw state |
|---|---|
| Repo-root `.agents/plugins/marketplace.json`, relative source | ✅ present, `codexclaw` / `./plugins/codexclaw` |
| Plugin manifest with skills/hooks/mcpServers/interface | ✅ complete, 0 dangling refs |
| Runs from clean clone without build step | ✅ 109 committed component `dist/` files; hooks call `node ${PLUGIN_ROOT}/components/*/dist/cli.js` |
| Single aligned version | ✅ 0.1.0 everywhere (root, components, plugin manifest) |
| Permission policy untouched by install | ✅ no installer exists; marketplace add writes only marketplace/plugin config |

## Deploy blockers (A-phase, must clear before calling a release)

- **B-CLI (High):** `cxc` does not ship in the marketplace payload — `bin/` and
  `cli/` sit at repo root, outside `plugins/codexclaw/`. Marketplace users get
  working hooks/MCP (component dist CLIs) but no PATH-level `cxc`. Resolution =
  decision D6. Until then, public docs must scope the CLI to repo checkouts.
- **B-GUI (High, RELEASE GATE):** `gui/dist` untracked → dashboard cannot run
  from a clean install. Not waivable by prose: every GUI/dashboard claim in
  README + docs-site must be true or marked unavailable before release.
- **B-DOCSSITE (High):** the primary docs site is factually staler than the
  README (001 #11). WP3 (`030_docssite_sync.md`) syncs it; the README link
  switch (E5) is only honest once WP3 lands.

Verified live CLI surface (2026-07-23):

```
codex plugin marketplace add <git-url>     # register marketplace
codex plugin add codexclaw@codexclaw       # install plugin
codex plugin marketplace upgrade codexclaw # refresh git snapshot (update path)
codex plugin remove codexclaw@codexclaw    # uninstall plugin
codex plugin marketplace remove codexclaw  # remove marketplace source
```

## Update UX to document (from LazyCodex mechanics)

- Update = `codex plugin marketplace upgrade codexclaw` (git snapshot refresh).
- After an upgrade, hook content hashes change → Codex marks hooks `Modified` →
  user must re-approve hooks. This must be one line in the README, it is the
  single most confusing part of the marketplace update flow.
- Doctor surface: `cxc` exposes doctor/reset via `cxc-ops`; CI gate =
  `node plugins/codexclaw/scripts/gate.mjs`. Mention `cxc help` as the entry.

## Release mechanics (when the user pulls the trigger — NOT this loop)

1. Land D1 (gui/dist) decision.
2. `git tag v0.1.0` + GitHub release; from then on one SemVer across tag ↔
   plugin.json ↔ any future npm artifact (LazyCodex takeaway #7; their
   0.2.2-vs-4.19.1 skew is the anti-pattern).
3. Optional D3 CHANGELOG starting at v0.1.0.

## Decision register (user calls; recommendations attached)

- **D1 — gui/dist shipping (High, RELEASE GATE).** Options: (a) commit the 7-file production
  bundle, matching the component-dist precedent — RECOMMENDED; (b) document
  `npm run build` in gui/ as a post-install step (bad: marketplace install has no
  build hook); (c) drop the GUI mention from public docs until shipped.
  While unresolved, E6 marks every GUI/dashboard claim as repo-checkout-only;
  release is blocked until (a) or (c) lands.
- **D2 — devlog public (Med).** 753 tracked files. Plugin payload is only
  `plugins/codexclaw/`, so installs never receive devlog. RECOMMENDED: keep public
  (provenance is a project value); no action.
- **D3 — CHANGELOG (Low).** RECOMMENDED: add `CHANGELOG.md` at first tag.
- **D4 — npm wrapper (Low).** RECOMMENDED: defer. No provisioning need beyond
  committed dist; wrapper adds a second update system to keep honest (takeaway #8).
- **D5 — install provenance stamp (Low).** RECOMMENDED: defer; no self-updater
  exists, so no update race exists.
- **D6 — cxc CLI distribution (High, new at A).** Options: (a) ship a thin
  `plugins/codexclaw/bin/cxc.mjs` dispatcher in the payload and document
  `node "$PLUGIN_ROOT/bin/cxc.mjs" ...` — works everywhere, no PATH, ugly;
  (b) npm wrapper that links `cxc` onto PATH (lazycodex model) — REASSESS D4
  if PATH-level `cxc` is a release requirement; (c) document the CLI as
  repo-checkout-only for v0.1.0 — RECOMMENDED for this release: hooks, MCP,
  skills, PABCD all function without `cxc`; the CLI is a power surface.
  E3/E4 wording follows (c) unless the user picks (a)/(b).

## Risks

- `codex plugin marketplace upgrade` re-approval UX is Codex-side; if upstream
  changes the flow, README line must be re-verified at each release.
- Badge counts are static; consider generating them in gate.mjs later (out of scope).
