# 260908 — dev-install track: real-copy dogfood, README documentation, open-PR merge

## Objective

Replace the retired symlink dogfood track with a documented real-copy install driven from the
`dev` checkout, document it in all three READMEs at reference depth, review and merge the three
open PRs into `dev`, then fast-forward locally and reinstall from the merged head.

## Why this unit exists

`scripts/dev-symlink.sh` rebuilt the plugin cache version directory as real directory full of
symlinks into the repo. Codex does not resolve those symlinked children reliably, so the plugin
could silently fail to load. Two further defects made it unusable in practice:

| Defect | Evidence |
|---|---|
| Hardcoded `VERSION="0.1.0"` | script line 19; the live cache directory is `0.2.24+codex.20260908031619` |
| Not actually in use | `find ~/.codex/plugins/cache/codexclaw -type l` returned 0 before this unit |

The marketplace was registered as a **git** source pinned to `bb85227` (= `origin/main`), so the
installed plugin was a snapshot of `main`, not the `dev` working tree. That is the actual gap the
user reported as "symlink을 거니까 코덱스 잘 인식을 하지 못해".

## Constraints

- No release to `main`, no npm publish, no tag.
- No force push, no force reset; `dev` must advance by ordinary merge and local fast-forward.
- No forging of hook trust. Re-approval is the user's action in the Codex UI.
- Marketplace/config edits are limited to the `codexclaw` entry.

## Work-phase map (dependency ordered)

| Phase | Title | Depends on | Doc |
|---|---|---|---|
| wp1 | docs-first roadmap (this cycle) | — | `000_plan.md` |
| wp2 | README x3 documentation + script/docs-site improvements | wp1 | `010_wp2_readme_documentation.md` |
| wp3 | independent opus-5 review + merge of PR 91/92/93 | wp1 | `020_wp3_pr_review_merge.md` |
| wp4 | dev sync, fast-forward, real reinstall, fresh proof | wp2, wp3 | `030_wp4_sync_and_reinstall.md` |

wp2 and wp3 are independent: wp2 touches `README*.md` / `docs-site/` / `scripts/`, wp3 lands
changes under `plugins/codexclaw/` through GitHub merges. They are executed as separate PABCD
cycles regardless, per the one-work-phase-one-cycle invariant.

## Baseline state at wp1

```
branch:        dev @ 6d70ef44 (= origin/dev)
origin/main:   bb852272
open PRs:      91, 92, 93 — all base dev, all MERGEABLE
plugin cache:  0.2.24+codex.20260908031619, 0 symlinks, byte-identical to plugins/codexclaw
marketplace:   codexclaw -> local /Users/jun/Developer/new/700_projects/codexclaw
doctor:        overall PASS, 24 hook hashes trusted
```

Uncommitted work already on disk from the preceding turn (carried into wp2, not re-derived):
`scripts/dev-install.sh` (new), `scripts/dev-symlink.sh` (deleted), the docs-site rename to
`dogfood-dev-install.md`, and the `astro.config.mjs` / `installation.md` / `troubleshooting.md` edits.

## Acceptance criteria (goalplan ids)

- c-1 roadmap docs precede any production patch
- c-2 three READMEs describe the real dev-install flow
- c-3 no live `dev-symlink.sh` reference outside the retrospective note
- c-4 `npm run gate` passes
- c-5/c-6/c-7 PR 91/92/93 independently reviewed and merged
- c-8 local `dev` fast-forwards to `origin/dev`
- c-9 full suite passes on the final head
- c-10 install byte-identical, zero symlinks, doctor PASS

## Out of scope

Remote host deployment (macmini-cf, suji), other worktrees, other plugins, the `main` promotion.
