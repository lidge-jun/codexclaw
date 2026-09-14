# 020 — wp3: prepare codexclaw 0.2.28 on dev

## Goal

Every version surface reads `0.2.28`, the CHANGELOG describes the change, and the
inventory is regenerated from the measured hosted test count.

## Version surfaces — the exact list `check-versions.mjs` enumerates

`collectSurfaces()` builds this set. Build metadata (`+codex.<stamp>`) is permitted
ONLY where marked; a plain surface carrying `+` is a violation.

| # | Surface | Path | `0.2.27` -> `0.2.28` | Metadata |
|---|---|---|---|---|
| 1 | root package | `package.json` | `"version": "0.2.28"` | no |
| 2 | plugin manifest | `plugins/codexclaw/.codex-plugin/plugin.json` | `"version": "0.2.28+codex.<stamp>"` | **yes** |
| 3-11 | 9 components | `plugins/codexclaw/components/{bg-wake,config-guard,cxc-ops,messenger-bridge,pabcd-state,provider-bridge,recall,skill-search,subagent-config}/package.json` | `"version": "0.2.28"` | no |
| 12 | inventory package | `plugins/codexclaw/inventory.json` -> `plugin.packageVersion` | `"0.2.28"` | no |
| 13 | inventory manifest | `plugins/codexclaw/inventory.json` -> `plugin.manifestVersion` | `"0.2.28+codex.<stamp>"` | **yes** |

`plugins/codexclaw/gui/package.json` and `cli/package.json` are declared workspaces
(`workspaces: ["plugins/codexclaw/components/*", "plugins/codexclaw/gui", "cli"]`)
but are NOT enumerated by `collectSurfaces()` — it walks `components/` only. Both
read `0.2.27` today. Bump both to `0.2.28` for consistency with the rest of the
workspace; the checker will not complain either way, so this is a tidiness rule,
not a gate. Do not invent a surface the checker does not read.

Verify with:

    node plugins/codexclaw/scripts/check-versions.mjs 0.2.28

## Inventory regeneration

    node plugins/codexclaw/scripts/inventory.mjs --write --tests 3150

`3150` is the `tests` line from hosted CI run 34790437740, job 103813520900, at
head `7036f9b8` — NOT a local run and NOT the `pass` count, which is
environment-dependent because CI skips the repo-map live smoke.

The published badge in `README.md`, `README.ko.md` and `README.zh.md` already reads
`3,150`, so this change adds no tests and the badge should not move. If
`--write` moves it, the count is wrong — re-measure rather than editing by hand.
`--write` also refreshes the inventory hash the release gate compares against.

## CHANGELOG

Insert a `## [0.2.28] - 2026-09-14` section directly under `## [Unreleased]`, in
the existing `### Fixed` / `### Added` voice. It must name all four issues and say
what an agent could not do before:

- `add-criterion` missing from the documented CLI surface (#170)
- generated `c-N` criterion ids vs. the `--id` the doc implies (#171)
- in-lane workers are subagents, stated inside DISPATCH-SURFACE-01 (#172)
- DELEGATE-MODEL-LIST-01: the advertised override list is a hint (#173)

## Delivery

A single commit on a topic branch off `dev`, PR to `dev`, merged once green.
Do not commit directly to `dev`.

    Title: chore(release): prepare codexclaw 0.2.28

## Exit

wp3 closes when the prep PR is merged and the new `dev` head is green on CI, WSL
and Packed install.
