# 001 — PR #1 ancestry and the real test count

Status: ANALYZED

The assessment could not tell from public snapshots whether PR #1 was merged or
closed, and flagged the README test badge as suspicious. Both are now resolved
with local git evidence.

## PR #1 ancestry

```
$ git fetch origin refs/pull/1/head:refs/remotes/origin/pr1head
$ git log --oneline -1 origin/pr1head
8f2efabf fix: harden runtime boundaries and resource lifecycles

$ git merge-base --is-ancestor origin/pr1head origin/main; echo $?
1                      # the PR head commit itself is NOT an ancestor

$ git log --oneline --all --grep='harden runtime boundaries'
dac77cc7 fix: harden runtime boundaries and resource lifecycles (#1)
8f2efabf fix: harden runtime boundaries and resource lifecycles

$ git merge-base --is-ancestor dac77cc7 origin/main; echo $?
0                      # the squashed commit IS on main

$ git log -1 --format='%H %ci %s' dac77cc7
dac77cc762edd3588f28d66acb4590bff85420ee 2026-08-09 10:18:41 +0900 fix: harden runtime boundaries and resource lifecycles (#1)
```

**Verdict: MERGED via squash.** The PR head `8f2efab` is not in `main` ancestry
because GitHub rewrote it as `dac77cc7`, which is. `gh pr view 1` reports
`mergedAt: 2026-08-09T01:18:41Z` with merge commit `dac77cc7`. The runtime
hardening (bounded JSON parsing,
goalplan/recall/subagent validation, evidence gate, backpressure, lifecycle
shutdown, GUI splitting, messenger isolation, dependency security) is present in
the current tree, not pending.

Consequence for release truth: the hardening may be counted as shipped code on
`main`, but it has never appeared in a published release — the only release is
`v0.1.0` (2026-07-06), predating the merge by a month.

## Real test count

```
$ npm test 2>&1 | tail -8
ℹ tests 1631
ℹ suites 0
ℹ pass 1631
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 32817.714708
```

Published claims: `v0.1.0` release notes say 801; all three READMEs say 1,213;
the assessment's PR-derived figure was 1,453. **None of them match the current
1,631.** The badge is hand-written: `sync-readme-badges.mjs` derives only the
`skills` and `hooks` badges (`replaceBadge(updated, "skills", …)` /
`("hooks", …)`) — the tests badge has no generator and no gate, so it drifts
silently with every new test file.

## Why the count matters beyond cosmetics

The test badge is the only public signal of suite size. A stale badge means an
installer cannot distinguish "codexclaw ships 800 tests" from "codexclaw ships
1,631 tests", and the release gate has no receipt binding a published version to
a measured suite. The 010 phase corrects the number; the 020 phase removes the
class of failure by generating it.

## Carried into implementation

- 010 records `dac77cc7` as the ancestry answer in the release notes/changelog.
- 020 must generate the test count, not just skills/hooks.
- 030's candidate manifest needs a `test-suite` receipt carrying the measured
  pass count and the SHA it was measured on.
