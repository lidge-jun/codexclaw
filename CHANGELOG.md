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

## [0.2.0] - 2026-08-15

The first stable release since 0.1.0, and the first this project can point at and
say what is actually in it.

0.2.0-beta.1 shipped the release train but stayed a prerelease, so the releases
page still advertised 0.1.0 — 25 skills, 12 hooks, 801 tests — as the current
version. This release is that payload, verified and labelled honestly.

### Added

- **Scoped receipt requirements.** A release receipt now declares the release line
  it becomes mandatory in, so the nine MLB 1.0 tracks no longer block a 0.2.x
  release while still blocking the entire 1.0 line — including `1.0.0-rc.1`,
  because an rc of 1.0 owes 1.0 evidence.
- `cxc release classify`, one SemVer parser shared with the release workflow.
- `check-versions.mjs`: the published archive cannot claim a version other than the
  one being released.

### Fixed

- **An empty receipt array verified as ready.** The gate only inspected receipts
  that happened to exist, so a 1.0.0 candidate with `receipts: []` passed. The
  canonical set is now required, and omissions, duplicates and unknown names are
  rejected.
- **`requiredFrom` could have been self-authenticated.** `--candidate` accepts
  arbitrary JSON, so a manifest could have claimed its own evidence was out of
  scope. The canonical policy in code is authoritative and a disagreeing manifest
  is rejected.
- **The workflow's prerelease test was a substring match.** `case $VERSION in *-*)`
  classified the stable `1.0.0+build-with-hyphen` as a prerelease.
- **`--allow-deferred` no longer waives anything.** It would have cancelled out the
  scoping rule: an rc classified `prerelease` would have been handed the flag and
  skipped its due receipts. Exemption comes from scope alone; the flag survives only
  as manifest provenance.

### Notes

- Contents are identical in substance to 0.2.0-beta.1 plus the gate corrections
  above. Everything in that release ships here under an honest stable label.
- `v0.1.0` and `v0.2.0-beta.1` remain published and unmodified; both tags are
  protected by `protect-release-tags`.
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

[Unreleased]: https://github.com/lidge-jun/codexclaw/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/lidge-jun/codexclaw/compare/v0.2.0-beta.1...v0.2.0
[0.2.0-beta.1]: https://github.com/lidge-jun/codexclaw/compare/v0.1.0...v0.2.0-beta.1
[0.1.0]: https://github.com/lidge-jun/codexclaw/releases/tag/v0.1.0
