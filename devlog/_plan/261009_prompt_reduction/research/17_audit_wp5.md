# wp5 A check — C4

HEAD d086b16c7746a912b7517265eb079ebb164c3f1e. Report-only; no release, SSH, install or Git writes. 040 means this unit's 040_wp5_release_deploy.md; paths are repository-relative.

Release sequence is executable: 040:14-17 covers versions, manifest stamp, inventory/badges, CHANGELOG, release/promotion PRs, exact-head CI, pinned dry run/READY then publish, checksums, archive comparison, tag and latest. It follows devlog/_plan/260930_issue_train/040_wp4_delivery.md:24-30. .github/workflows/release.yml:76-125 refuses moving main/existing publication; :174-265 checks versions/build/inventory/CI; :278-318 publishes and rereads assets. Fresh check-versions.mjs 0.2.41 passes the current tree only.

Blocking residuals:

1. SHA pin is checked too late. 040:33,40 promises the intended dev SHA and --no-build, but plugins/codexclaw/scripts/remote-dev-install.sh:82-84 pulls moving origin/dev and rebuilds. It has neither SHA nor no-build options. Later verification detects an already-installed unaudited revision. Fix: replace the install half with a sequence validating the fetched target against the frozen full SHA before advancing/installing, refusing divergence, and invoking scripts/dev-install.sh --no-build.

2. Payload proof misses extras. 040:33,40 compares only git ls-files paths; every expected file can match while obsolete/unexpected instructions remain in cache. Fix: compare both file sets and bytes against the frozen payload, with a named runtime-artifact allowlist; record zero missing, changed or unexpected files per host. Keep verification independent of installer exit status (scripts/dev-install.sh:130 masks doctor failure).

3. Rollback is absent. scripts/dev-install.sh:113-120 deletes older caches; 040 has no recovery capture or restore/check procedure. plugins/codexclaw/skills/dev-devops/SKILL.md:24 requires rollback evidence. Fix: preserve the prior verified payload and trust/config recovery evidence outside the checkout before installation; name a restore procedure and verify version, payload, trust and deny smoke. Report failed hosts separately.

Nit: check-versions.mjs:42-63 omits cli, GUI and package-lock. Keep 040:14's edits, and add an explicit check of those versions/owned lock entries (plus the precedent's npm ls) after bumping. Capture doctor from the installed binary with hook-trust PASS and a nonzero expected count, not exit 0 alone.

VERDICT: NEAR-PASS (R1 SHA pin/install mismatch; R2 payload extras; R3 rollback)
