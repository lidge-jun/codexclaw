# Changelog

All notable changes to codexclaw are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Release truth

- Resolved the standing question about PR #1 ("harden runtime boundaries and resource
  lifecycles"). It was **squash-merged as `dac77cc7` on 2026-08-09**; the PR head
  `8f2efab` is not in `main` ancestry because GitHub rewrote it. The hardening —
  bounded JSON parsing, goalplan/recall/subagent validation, the evidence gate, runner
  backpressure, media/job/timer lifecycles, process-group shutdown, GUI route splitting,
  Discord/Telegram isolation, dependency security — has been on `main` since then but
  has **never appeared in a published release**. `v0.1.0` (2026-07-06) predates it.
- Corrected every published inventory number against the actual payload: 28 skills,
  21 hooks, 8 components, 1,631 tests. The previous claims (1,213 tests; 18 hooks and
  27 skills in the Korean and Chinese READMEs; 25 skills in the docs site) were all stale.
- Removed `cxc-ultraresearch` from the shipped-skill listings. It has not been a
  separate skill since the protocol was absorbed into `cxc-search` Tier 3; the docs
  site, `structure/INDEX.md` and the skill-hub catalog all still advertised it.
- Added the three managed-worktree hooks to every hook reference. They shipped in the
  manifest but appeared in no published table:
  `session-start-detecting-managed-worktree`,
  `user-prompt-submit-guiding-worktree-rename`,
  `pre-tool-use-guarding-managed-worktree-deletion`.
- Repaired dead references in `structure/INDEX.md`: `devlog/_plan/mvp_res/` and
  `devlog/_plan/mvp_hard/` moved to `_fin/` and were never updated. Added the missing
  `skill-search` component section.

### Build

- Committed the regenerated `cxc-ops` `dist` output. Committed build artifacts had
  drifted behind source for the doctor JSON and schema changes, so a clean checkout
  produced a dirty tree after `npm run build`.

## [0.1.0] - 2026-07-06

First public release. 25 skills, 12 hooks, 801 tests.

[Unreleased]: https://github.com/lidge-jun/codexclaw/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lidge-jun/codexclaw/releases/tag/v0.1.0
