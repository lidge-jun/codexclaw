# 012 — Implementation record (2026-11-21)

Executes 011 plus the wp1-wp5 plans (010-050). Four parallel lanes ran as inherited-model forks
in this worktree, each with disjoint file ownership, and the parent integrated their results.

## Lanes

| Lane | Owned | Result |
|---|---|---|
| A: copy | `dev-design/references/copy/*`, `build/ux-writing-ko.md` | FE-COPY-PROCESS-01, FE-COPY-REGISTER-01 (owner register from A/B rounds 1-3, Apple KR n=241), FE-COPY-TELLS-01 (lint id table: FAIL residue / invented-figure / fake-proof / default-cast / stale-year / meta; second-generation tells are WARN caps), plus product microcopy |
| B: rules | `dev-design/references/{build,direction}` | FE-HERO-ALIGN-01 (centered by default, a left hero needs a counterweight, split 50:50); anti-center ban removed; FE-HERO-SPLIT-01 narrowed; weight-extremes advice corrected; FE-PLATFORM-2026-01; UX-AGENT-ACTION-01; HIG house adaptations; one-skill role boundaries; Korea and trend rows |
| C: lint | `dev-design/scripts/{ui-lint,copy-lint,lint-core}.mjs`, fixtures, `test/design-lint.test.mjs` | 20/20 tests; every emitted id exists in a reference file; `--render` reports NOT_RUN honestly; calibration on 10 Korean sites removed false positives (non-text hover contrast, skip links, off-screen text) |
| D: visualizer | `dev-visualizer/**` | `scripts/look.mjs` (390/1280 plus a print pass for `@page`), `diagram-types.md` (VIZ-FIGURE-01, 21 types), VIZ-BRAND-01 brand gate, source-patterns refresh; `report-locale` loses its side bar |

## Integration fixes by the parent

- Pointer lines from lane A went into `anti-slop.md`.
- The router's house-default line now states the counterweight and the 50:50 split.
- `port-provenance.json`:
  - new entry for `dev-design`;
  - the old names become `deprecated-redirect` entries.
- Skills catalog sorted and the stubs listed.
- `inventory.mjs --write --tests 3899`.
- READMEs: the downstream paragraph and the noslopdesign row were rewritten in EN/KO/ZH.
- A client server nickname in an example was replaced with `build-server-1`, folded into the
  unpushed commit (DEV-PRIVACY-01).

## Verification (codexclaw)

| Command | Result |
|---|---|
| `node plugins/codexclaw/scripts/check-prompt-architecture.mjs` | `[prompt-architecture] OK` |
| `node plugins/codexclaw/scripts/gate.mjs` | `[codexclaw gate] OK` |
| `npm test` | 3899 tests, 3893 pass, 0 fail, 6 skipped |
| `node plugins/codexclaw/scripts/inventory.mjs --check --tests 3899` | OK |
| `node --test plugins/codexclaw/test/design-lint.test.mjs` | 20/20 |
| `look.mjs` on both visualizer assets | 0 problems |

## Pushed

- **codexclaw:** branch `docs/visual-skill-refresh`, PR #341 into `dev`.
- **noslopdesign:** branch `codex/noslop-design`, PR #2 into `main`.
  - One skill, `noslop-design`; 0.3.0; old names kept as redirects.
  - Synced from `eca6b30e`.
  - `npm run check` OK, sloplint tests 4/4.
  - **Merge after codexclaw#341 reaches main.** The weekly sync clones codexclaw main.
- **aside-visualizer:** branch `codex/visualizer-look-diagrams`, PR #11 into `dev`.
  - New shared files: look.mjs, diagram-types.md, artifact-composition.md.
  - Shared assets and scripts refreshed, manifest re-hashed, `SKILL.md` adapted.
  - 248 pass, 0 fail.

## Installed in Aside (u/0, local, not a repo)

- `skills/user/dev-design` (cxc-dev-design) replaced `dev-frontend` and `dev-uiux-design`. It
  carries an Aside port note: the dev core is not installed, `file://` is blocked, and the
  Image Generation skill is the fallback.
- `skills/user/dev-visualizer` was refreshed from the aside-visualizer branch.
- The previous copies were moved to the session tmp `skill-backup/`.
