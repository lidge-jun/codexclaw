# 010 — Release truth: ancestry, real counts, version coherence

Status: PLANNED — work-phase wp1 (issue #24)

## Loop spec

- Archetype: spec-satisfaction repair
- Trigger: published numbers disagree with the shipped payload (002); committed
  `dist` lags source (004 #7)
- Goal: every inventory number a reader can see, and every committed build output,
  matches what the repository actually contains
- Non-goals: generating those numbers automatically (020), release publication (050)
- Verifier: `npm test`, `node plugins/codexclaw/scripts/gate.mjs`,
  `git diff --exit-code plugins/codexclaw/components` after a rebuild, and the
  INDEX path check below
- Stop condition: zero drift rows from 002 remain; the dist diff is empty
- Memory artifact: this doc + `CHANGELOG.md`
- Terminal outcomes: DONE when both checks are clean
- Escalation: none expected

## Verifier reality check (PLAN-VERIFIER-REAL-01)

| Command | Exists | Exit today | Observes this change? |
| --- | --- | --- | --- |
| `npm test` | yes | 0 | partly — `skill-catalog.test.mjs` asserts README badges only |
| `gate.mjs` | yes | 0 | partly — hook cardinality + SKILL/structure prose; **not** docs-site or README prose |
| `build.mjs` then `git diff --exit-code .../components` | yes | **1** today | yes — directly |
| INDEX path check (below) | new, inline | n/a | yes |

Most documentation rows in this phase have **no machine verifier** and are human
review until 020 lands. Saying so is the point; claiming the gate protects
docs-site would be false.

## File change map

### 1. Committed build output (004 #7)

| File | Change |
| --- | --- |
| `plugins/codexclaw/components/cxc-ops/dist/cli.js` | commit the regenerated output |
| `plugins/codexclaw/components/cxc-ops/dist/doctor.js` | commit the regenerated output |

These two files are already modified in the working tree. Verified: running
`node plugins/codexclaw/scripts/build.mjs` reproduces exactly these two files and
nothing else, so the working copy is **correct** and HEAD is stale. Preserve the
existing content — regenerate and commit, never `checkout --` over it.

Activation evidence: `git diff --exit-code plugins/codexclaw/components` must exit 1
before and 0 after. Without the before-observation this step proves nothing.

### 2. Inventory corrections

| File | Change |
| --- | --- |
| `README.md:16` | tests badge 1,213 → 1,631 (URL + alt) |
| `README.ko.md:16,57,96,106` | tests 1,213 → 1,631; 18 hooks → 21 (x2); 27 skills → 28 |
| `README.zh.md:16,57,96,106` | same as ko |
| `docs-site/.../index.mdx:145,146,178,210` | 27→28 skills; 18→21 hooks; events 4/2/5/2/1/1/3 → 5/3/6/2/1/1/3; 1,213→1,631 |
| `docs-site/.../concepts/how-it-works.md:36,42-48` | 18→21; add the three worktree hooks |
| `docs-site/.../reference/hooks.md:3,6,22-39` | 18→21; add the three worktree hook rows |
| `docs-site/.../reference/plugin-manifest.md:14,19,25-43,48` | exact manifest version; 18→21; 27→28 |
| `docs-site/.../getting-started/installation.md:86` | 18→21 |
| `docs-site/.../guides/skills.md:78,84,88-112` | drop `cxc-ultraresearch`; 25→28; add `dev-diagram-viewer`, `kwrite`, `remote`, `worktree-guardian` |
| `docs-site/.../guides/native-tools.md:73` | drop the `cxc-ultraresearch` lane |
| `docs-site/.../development/build-test.md:25-34` | list all eight component test dirs |
| `structure/INDEX.md:100-132` | add `skill-search` to the component map |
| `structure/INDEX.md:142-167` | add three skills; remove `ultraresearch` |
| `structure/INDEX.md` (8 sites) | `devlog/_plan/mvp_*` → `devlog/_fin/mvp_*`; drop the missing `codex-inject.ts` reference |
| `structure/60_native_capabilities.md:155` | remove `cxc-ultraresearch` |
| `plugins/codexclaw/skills/skill-hub/references/catalog.md:30` | remove the row claiming `skills/ultraresearch/SKILL.md` ships — found while validating criterion 2; **not** in 002 original table |

### 3. New file

`CHANGELOG.md` — Keep-a-Changelog. `## [Unreleased]` records the ancestry finding
(PR #1 squash-merged as `dac77cc7` on 2026-08-09, never released) so release notes
are generated from a tracked artifact rather than a chat summary.

## Scope boundary

IN: the files above, the two dist files, and `CHANGELOG.md`.
OUT: the generator (020), workflows (040), version bumps (050).

## Accept criteria

```bash
# 1. no stale test counts anywhere
rg -n '1,213|1%2C213' README.md README.ko.md README.zh.md docs-site/src structure   # expect: no matches

# 2. no doc claims ultraresearch SHIPS as a skill.
#    Historical formerly/absorbed mentions are legitimate and stay:
#    skills/README.md:71-72, search/SKILL.md:118,285, lunasearch/SKILL.md:149,162-167.
rg -n 'skills/ultraresearch/' structure docs-site/src plugins/codexclaw/skills     # expect: no matches
rg -n 'cxc-ultraresearch' structure docs-site/src                                  # expect: no matches

# 3. the three worktree hooks are documented everywhere hooks are listed
for f in docs-site/src/content/docs/reference/hooks.md \
         docs-site/src/content/docs/reference/plugin-manifest.md \
         docs-site/src/content/docs/concepts/how-it-works.md; do
  for h in session-start-detecting-managed-worktree \
           user-prompt-submit-guiding-worktree-rename \
           pre-tool-use-guarding-managed-worktree-deletion; do
    grep -q "$h" "$f" || echo "MISSING $h in $f"
  done
done                                                                              # expect: no output

# 4. committed dist matches source
node plugins/codexclaw/scripts/build.mjs && git diff --exit-code plugins/codexclaw/components

# 5. every repo-root path INDEX.md names actually exists
rg -o '`((?:devlog|structure|plugins|docs|docs-site|scripts|cli|bin)/[A-Za-z0-9_./-]+)`' -r '$1' \
   structure/INDEX.md | sort -u | while read -r p; do [ -e "$p" ] || echo "MISSING: $p"; done

# 6. regression guards
npm test && node plugins/codexclaw/scripts/gate.mjs
```

### Criterion 5 scope — measured, not assumed

Two earlier drafts were wrong in opposite directions. Extracting every inline-code
token reported 103 false misses (plugin-relative `components/cxc-ops`,
component-relative `agents/openai.yaml`, illustrative paths). Extracting only
markdown **link targets** reported `miss_count=0` — a silent no-op, because the dead
references are inline code, not links.

The command above anchors inline-code tokens to known top-level directories. Run
against the current tree it extracts 33 candidates and reports exactly 7 misses:

```text
MISSING: devlog/_plan/mvp_hard/
MISSING: devlog/_plan/mvp_hard/000_INDEX.md
MISSING: devlog/_plan/mvp_hard/140_L14_loop_goal_routing_followup.md
MISSING: devlog/_plan/mvp_hard/141_L14_L19_contradiction_patch_plan.md
MISSING: devlog/_plan/mvp_hard/200_L20_gap_register.md
MISSING: devlog/_plan/mvp_res/
MISSING: devlog/_plan/mvp_res/000_INDEX.md
```

That is the intended class and nothing else. This pre-correction output is the
**before** observation; after the corrections the same command must print nothing.
Empty output in both runs would mean the check observes nothing and the criterion is
unmet.

Note: `../opencodex/src/codex-inject.ts` lies outside the repo root and is not
matched by this check; it is corrected by hand as a listed file-map row.
