# 002 — Inventory drift map

Status: ANALYZED

Source: dedicated read-only audit pass (2026-08-15, branch `dev`). Every number
below came from a command, not from a document.

## Ground truth

| Inventory | Truth |
| --- | --- |
| Skills (dirs with `SKILL.md`) | 28 |
| Hooks on disk (excl. `_deprecated`) | 21 |
| Manifest hooks | 21, identical set |
| Hook events | SessionStart 5, UserPromptSubmit 3, PreToolUse 6, PostToolUse 2, Stop 1, SubagentStop 1, PostCompact 3 |
| Components | 8, all at `0.1.1` |
| Tests | 1,631 pass / 0 fail |
| Manifest version | `0.1.1+codex.20260807170050` |
| Package version | `0.1.1` |
| Latest tag | `v0.1.0` |
| Implicit-visible skills | 8 |

## Drift, by severity

**High — wrong facts in public reference material**

| File:line | Claimed | Actual |
| --- | --- | --- |
| `README.ko.md:57,106` / `README.zh.md:57,106` | 18 hooks | 21 |
| `docs-site/.../index.mdx:146` | 18 hooks; events 4/2/5/2/1/1/3 | 21; 5/3/6/2/1/1/3 |
| `docs-site/.../concepts/how-it-works.md:36,42-48` | 18 active hooks | 21; all three worktree hooks missing |
| `docs-site/.../reference/hooks.md:3,6,22-39` | complete 18-hook table | missing `session-start-detecting-managed-worktree`, `user-prompt-submit-guiding-worktree-rename`, `pre-tool-use-guarding-managed-worktree-deletion` |
| `docs-site/.../reference/plugin-manifest.md:19,25-43` | 18 hook files | 21; same three missing |
| `docs-site/.../getting-started/installation.md:86` | 18 active hooks | 21 |
| `docs-site/.../guides/skills.md:78,84,88-112` | 25 skills incl. `cxc-ultraresearch` | 28; `ultraresearch` **does not exist** (absorbed into `search`); missing `dev-diagram-viewer`, `kwrite`, `remote`, `worktree-guardian` |
| `structure/INDEX.md:142-167` | 26 skill rows incl. `ultraresearch` | 28; missing `dev-diagram-viewer`, `kwrite`, `remote` |

**Medium — stale counts and omissions**

| File:line | Claimed | Actual |
| --- | --- | --- |
| `README.md:16`, `README.ko.md:16`, `README.zh.md:16` | 1,213 tests | 1,631 |
| `README.ko.md:96`, `README.zh.md:96` | 27 skills | 28 |
| `docs-site/.../index.mdx:145,178,210` | 27 skills / 1,213 tests | 28 / 1,631 |
| `docs-site/.../reference/plugin-manifest.md:14,48` | version `0.1.1`, 27 skills | `0.1.1+codex.20260807170050`, 28 |
| `docs-site/.../development/build-test.md:25-34` | five component test dirs | eight |
| `structure/INDEX.md:100-132` | component map | omits `skill-search` |
| `structure/60_native_capabilities.md:155` | gap map lists `cxc-ultraresearch` | not a shipped skill |

**Dead paths in `structure/INDEX.md`** — `devlog/_plan/mvp_res/` and
`devlog/_plan/mvp_hard/` references (lines 11, 71, 75, 169, 210, 313, 319, 335)
all moved to `_fin/`; `../opencodex/src/codex-inject.ts` has no matching source;
`skills/ultraresearch/` does not exist.

**Correct today (must not regress):** all three README skill/hook badges (28/21),
`README.md` prose, `structure/INDEX.md:175-199` hook list, docs-site component
counts, the documented 8-skill implicit set.

## Why the existing gates missed all of it

`gate.mjs:277` compares **cardinality only**:

```js
const declared = Array.isArray(manifest.hooks) ? manifest.hooks.length : 0;
const onDisk = readdirSync(hooksDir).filter(f => f.endsWith(".json")).length;
if (declared !== onDisk) violations.push(\`hook count mismatch: ...\`);
```

So an equal-count substitution passes, a duplicated manifest path passes, and one
undeclared file plus one missing declaration cancel out numerically. Its prose scan
only looks for false-enforcement phrases in `SKILL.md` and `structure/*.md` — it
parses no inventory numbers, tables, or paths. The live run says
`OK — no status drift, false-enforcement prose, or count mismatch`, which is much
narrower than "no inventory drift".

`sync-readme-badges.mjs` derives only the `skills` and `hooks` shields badges for
the three READMEs. It does not touch the tests badge, prose counts, tree comments,
docs-site, `structure/`, or `docs/`.

Tests do enforce two exact sets — `skill-catalog.test.mjs:49`
(`assert.deepEqual(catalogFolders(), shippedSkillFolders())`) and
`port-provenance.test.mjs:34` — plus a hardcoded `manifest.hooks.length === 21` in
`hook-e2e.test.mjs:122`. None compare the manifest hook **set** against the
filesystem set, and none look at published documentation.

## Requirements carried into 020

1. Generate identities, never counts: store arrays and derive lengths, so a
   "count" cannot be updated independently of the list it describes.
2. Compare sets, not cardinalities, across filesystem ↔ manifest ↔ documentation.
3. Cover every publication surface: 3 READMEs, `structure/*.md`, docs-site content,
   `docs/*.md`, plus the skills catalog README.
4. Record the test total with its measuring commit and timestamp so a stale number
   is detectable rather than merely wrong.
5. Validate that every path a generated block references still exists.
6. Wire `--check` into `gate.mjs` so `npm run gate` cannot be green while public
   docs are stale.
