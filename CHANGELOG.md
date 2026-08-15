# Changelog

All notable changes to codexclaw are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Enforcement for the release gates.** Two repository rulesets:
  `protect-release-tags` (`v*`: no deletion, no update, no non-fast-forward) and
  `protect-main` (no deletion, no force-push, and eight required GitHub Actions
  contexts). Until now every gate shipped in 0.2.0-beta.1 was an early warning:
  `gh api rulesets` returned `[]`, so nothing stopped a direct push to `main` or a
  moved tag.

  Proven by refusal rather than by reading the configuration back — an unchecked
  commit pushed to a protected branch was rejected with *"8 of 8 required status
  checks are expected"*, and force-push and deletion were rejected by name.

  Scope, stated precisely: rulesets protect refs, not the Releases API, so
  `gh release create` by hand still skips the release gate. What it buys is that a
  published tag can no longer be re-pointed or deleted, which is what 050's rollback
  policy depends on. A repository admin can still edit a ruleset — the cleanup step
  in `devlog/_plan/260815_release_train_production/060_enforcement_layer.md` does
  exactly that, on purpose, so the residual is demonstrated instead of described.

## [0.2.0-beta.1] - 2026-08-15

The first release cut by the release train rather than by hand, and the first to
carry the runtime hardening merged as `dac77cc7` on 2026-08-09.

### Added

- **Inventory source of truth.** `plugins/codexclaw/scripts/inventory.mjs` derives
  the shipped skill/hook/component inventory from the payload and gates on SET
  equality in both directions. The previous gate compared cardinality only, so an
  equal-count manifest substitution passed while published docs drifted to 18
  hooks and 25 skills. `inventory.json` stores identities only — no counts, no
  commit SHA — so a number cannot be edited independently of the list it
  summarizes.
- **An executable release gate.** `cxc release init|receipt|platform|tests|
  inventory|verify` assembles a candidate manifest and refuses publication when a
  receipt is missing, stale, or captured on another commit. Schema v2 adds
  `capturedSha`/`capturedAt`, `testSuite`, `inventoryHash`, and `publishedCounts` —
  the last binds the published test badge to the measured suite, so a release
  cannot ship a fresh green run beside a stale public number.
- **A release train.** `release.yml` (tag or dispatch) measures, builds, reads
  exact-SHA CI conclusions, records receipts, verifies fail-closed, publishes with
  a payload archive plus `SHA256SUMS` and the candidate manifest, then re-reads the
  release to confirm the assets exist.
- **Packed-install lifecycle CI.** `packed-install.yml` proves the installed
  product, not just the source tree: an artifact lane (build, dist freshness,
  archive, dispatcher smoke with `cxc` absent from PATH) and a real `codex` lane
  (clean `CODEX_HOME`, `marketplace add --ref <sha>`, retrust, doctor, downgrade to
  v0.1.0, upgrade back with an asserted version change, remove, residue check).
- **macOS CI.** The primary development platform was previously untested.

### Fixed

- Every published inventory number now matches the payload: 28 skills, 21 hooks,
  8 components, 1,659 tests. The READMEs claimed 1,213 tests, the Korean and
  Chinese ones claimed 18 hooks and 27 skills, and the docs site claimed 25 skills.
- The three managed-worktree hooks shipped in the manifest but appeared in no
  published hook table.
- `cxc-ultraresearch` was advertised as a shipping skill across the docs site,
  `structure/INDEX.md` and the skill-hub catalog. It has not shipped since the
  protocol was absorbed into `cxc-search` Tier 3.
- Dead `devlog/_plan/mvp_*` references in `structure/INDEX.md`, and the missing
  `skill-search` component section.
- Committed `cxc-ops` build output had drifted behind source.

### Notes

- PR #1 was squash-merged as `dac77cc7`; the PR head `8f2efab` is not in `main`
  ancestry because GitHub rewrote it. That hardening ships publicly for the first
  time here.
- Marked a prerelease: the packed-install lane is new, and the MLB 1.0 receipts are
  recorded as deferred in the published candidate manifest rather than quietly
  omitted.
## [0.1.0] - 2026-07-06

First public release. 25 skills, 12 hooks, 801 tests.

[Unreleased]: https://github.com/lidge-jun/codexclaw/compare/v0.2.0-beta.1...HEAD
[0.2.0-beta.1]: https://github.com/lidge-jun/codexclaw/compare/v0.1.0...v0.2.0-beta.1
[0.1.0]: https://github.com/lidge-jun/codexclaw/releases/tag/v0.1.0
