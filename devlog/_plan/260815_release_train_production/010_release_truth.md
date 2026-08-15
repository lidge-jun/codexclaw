# 010 — Release truth: ancestry, real counts, version coherence

Status: PLANNED — work-phase wp1

## Loop spec

- Archetype: spec-satisfaction repair (the verifier defines done)
- Trigger: published numbers disagree with the shipped payload (002)
- Goal: every inventory number a reader can see is the number the repo actually has
- Non-goals: generating those numbers automatically (that is 020), release publication
- Verifier: `npm test` + `node plugins/codexclaw/scripts/gate.mjs` + `node plugins/codexclaw/scripts/sync-readme-badges.mjs` (check mode) + manual grep for the corrected strings
- Stop condition: zero drift rows remain from 002's table
- Memory artifact: this doc + `CHANGELOG.md`
- Terminal outcomes: DONE when the drift table is empty; NOOP impossible (drift proven)
- Escalation: none expected; pure documentation correction

## Verifier reality check (PLAN-VERIFIER-REAL-01)

| Command | Exists? | Exit today | Reads this change? |
| --- | --- | --- | --- |
| `npm test` | yes | 0 | yes — `skill-catalog.test.mjs` asserts README badges |
| `node plugins/codexclaw/scripts/gate.mjs` | yes | 0 | partially — only hook cardinality and SKILL/structure prose; **does not read docs-site or README prose** |
| `node plugins/codexclaw/scripts/sync-readme-badges.mjs` | yes | 0 | only the skills/hooks shields badges |

So the existing verifiers cannot protect most of this phase's edits. Those rows are
**human review** in this phase and become machine-checked in 020. Stating this
honestly is the point: claiming the gate protects docs-site would be false.

## File change map

### Corrections (drift closure)

| File | Change |
| --- | --- |
| `README.md:16` | tests badge `1%2C213` → `1%2C631`, alt text likewise |
| `README.ko.md:16,57,96,106` | tests 1,213→1,631; "18 hooks"→21 (×2); "27 skills"→28 |
| `README.zh.md:16,57,96,106` | same as ko |
| `docs-site/src/content/docs/index.mdx:145,146,178,210` | 27→28 skills; 18→21 hooks and event split 4/2/5/2/1/1/3 → 5/3/6/2/1/1/3; 1,213→1,631 tests |
| `docs-site/.../concepts/how-it-works.md:36,42-48` | 18→21; add the three worktree hooks to the event inventory |
| `docs-site/.../reference/hooks.md:3,6,22-39` | 18→21; add `session-start-detecting-managed-worktree`, `user-prompt-submit-guiding-worktree-rename`, `pre-tool-use-guarding-managed-worktree-deletion` rows |
| `docs-site/.../reference/plugin-manifest.md:14,19,25-43,48` | exact manifest version; 18→21 hooks incl. the three; 27→28 skills |
| `docs-site/.../getting-started/installation.md:86` | 18→21 |
| `docs-site/.../guides/skills.md:78,84,88-112` | drop `cxc-ultraresearch`; 25→28; add `dev-diagram-viewer`, `kwrite`, `remote`, `worktree-guardian` |
| `docs-site/.../guides/native-tools.md:73` | drop the `cxc-ultraresearch` lane reference |
| `docs-site/.../development/build-test.md:25-34` | list all eight component test dirs |
| `structure/INDEX.md:100-132` | add `skill-search` to the component map |
| `structure/INDEX.md:142-167` | add `dev-diagram-viewer`, `kwrite`, `remote`; remove `ultraresearch` |
| `structure/INDEX.md:11,71,75,169,210,313,319,335` | `_plan/mvp_res`,`_plan/mvp_hard` → `_fin/...`; drop the missing `codex-inject.ts` reference |
| `structure/60_native_capabilities.md:155` | remove `cxc-ultraresearch` from the gap map |

### New file

`CHANGELOG.md` — Keep-a-Changelog format, `## [Unreleased]` plus a
`## [0.1.0] - 2026-07-06` baseline. The Unreleased section records the ancestry
finding (PR #1 merged as `dac77cc7`, never released) so the eventual release notes
are generated from a tracked artifact rather than a chat summary.

## Scope boundary

IN: the files above plus `CHANGELOG.md`.
OUT: any generator (020), any workflow (040), version bump (050). This phase does
**not** change `package.json`/`plugin.json` versions — the release version is chosen
in 050 once the gate certifies a candidate.

## Accept criteria

1. `rg -n '1,213|1%2C213' README*.md docs-site/src` returns nothing.
2. `rg -n 'ultraresearch' structure docs-site/src` returns nothing outside historical
   devlog text.
3. Each of the three worktree hooks appears in `reference/hooks.md`,
   `plugin-manifest.md`, and `how-it-works.md`.
4. `npm test` and `gate.mjs` both exit 0 (regression guard).
5. Every path referenced by `structure/INDEX.md` passes `test -e`.

Activation scenario for (5): the check is a shell loop over extracted inline-code
paths — run it before and after; before must report the `_plan/mvp_*` misses,
after must report none. A check that reports nothing both times is not proof.
