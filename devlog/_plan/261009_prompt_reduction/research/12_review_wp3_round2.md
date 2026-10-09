# WP3 independent C re-check, round 2

Previous review: `79239e8a4f605f8f7c8bd9275ee23cebb0f65a7a`; current HEAD: `ba8f5084d0081654e5c68fe2e7c5b27c64db4292`; base `a3001789`. Cwd `/Users/jun/.codex/worktrees/55e8/codexclaw`. `git diff HEAD` and initial status were empty: fixes were already committed. Reviewed the interdiff from the previous anchor and read the disposition evidence.

Fresh `node plugins/codexclaw/scripts/check-prompt-architecture.mjs`: exit 0, `[prompt-architecture] OK`. Virtual-filesystem probes reran earlier cases without disk writes. All ten unchanged architecture test callbacks pass with fixture writes redirected into memory; not a native suite run. A harness syntax error was corrected before execution.

## Eight dispositions

1. Resolved L033: `plugins/codexclaw/skills/loop/references/runtime-lifecycle.md:13-15` explicitly selects installed `node <pluginRoot>/bin/cxc.mjs` for stale development PATH and preserves the checkout.
2. Resolved L012: `plugins/codexclaw/skills/dev/SKILL.md:55` explicitly resolves links from the skill directory.
3. Resolved L029: same file `:158` distinguishes host listing/routers from external search/show. Updated all three ledger rows: zero remaining LOST.
4. Resolved ID/anchor cases: `plugins/codexclaw/scripts/check-prompt-architecture.mjs:98,167-178`. Inline-code heading duplicates, bold/colon classes and class-before-ID duplicates fail; valid inline-code anchors pass. Independently reconstructed 50 old definitions from changed core Markdown: each has one current owner. Supplied audit's larger 57-ID scope was not fully reconstructed. Unique-ID disappearance remains outside the gate's at-most-one contract; preservation review addresses it. Two baseline additions cover unchanged legacy files.
5. Partial: simple folded/literal description overflow and folded short_description overflow now fail. Valid YAML variants still evade the budget; finding below.
6. Resolved original reference-link case: checker `:159-165` rejects missing table reference targets and missing reference fragments; ordinary inline table links still fail correctly. Explicit `{#id}` anchors remain a supported custom dialect, used in print-provenance.md; rendered GitHub compatibility is not established.
7. Resolved: `plugins/codexclaw/test/lane-packet.test.mjs:411-425` compares each value on its call's row. The unchanged callback passes current text and fails each separate in-memory mutation of the four formerly dropped bounds. Other four pinned tests have no base-to-current diff.
8. Resolved: subagent-config src/dist aliases and date match base. Stubbed V1/V2 each call once with the original deepseek model; V2 retains task_name/fork_turns. RESOLVER_CELL equals the fence under delegation's card section. Cards measure 395/435 chars, below 450; test now binds equality to that section.

## Remaining finding

1. **Medium, verified — YAML budget false greens remain.** `plugins/codexclaw/scripts/check-prompt-architecture.mjs:58-68`. Trigger: `description: > # summary`, `description: >2-`, or a quoted scalar spanning two 200-character lines; likewise `short_description: | # label` with 150 characters. Impact: valid over-budget L2 text returns `ok:true`, because the first-line value is counted and continuation is ignored. Ruby's installed YAML parser independently accepts these fixtures and measures 401, 400, 401 and 151 characters respectively. Extend scalar parsing or reject unsupported continuation forms; add negative tests. This retains finding 5's correctness gap.

## blocking_issues

The remaining YAML false green conflicts with the hard L2 gate contract. No LOST obligation remains. Reviewed all changed product files, new baseline entries and disposition/audit evidence; prior review artifacts are historical, CHANGELOG editorial change checked for alias-claim removal. No builds, native suites, live providers, agent spawning or git writes. Only the ledger and this report were edited.

VERDICT: FAIL
