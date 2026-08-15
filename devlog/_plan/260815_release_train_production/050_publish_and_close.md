# 050 — Publish 0.2.0-beta.1 and close the channel

Status: PLANNED — work-phase wp5

## Loop spec

- Archetype: spec-satisfaction repair
- Trigger: `main` carries a month of unreleased work including the PR #1 hardening
- Goal: a published release whose manifest links green exact-head receipts, with
  `main` updated and the tracking issues/PRs closed with evidence
- Verifier: `gh release view v0.2.0-beta.1`, `gh issue list --state open`
- Stop condition: release exists with assets; issues closed
- Terminal outcomes: DONE on published release; BLOCKED on auth failure

## Version decision

`0.2.0-beta.1`. Rationale: `main` has diverged materially from `v0.1.0` — runtime
hardening, +3 hooks, +3 skills, +830 tests, the MLB 1.0 tracks — which is a minor
bump; `-beta.1` because the packed-install lifecycle lane is brand new and the MLB
receipts are deferred. Shipping it as stable `0.2.0` would repeat the exact failure
this unit is fixing: publishing a claim the evidence does not carry.

`plugin.json` keeps its `+codex.<timestamp>` build metadata, regenerated at bump
time; `package.json` and the git tag carry the bare semver.

## Sequence

1. Bump `package.json`, `plugin.json`, and component `package.json` versions.
2. Regenerate inventory; `--check` clean.
3. Write the `## [0.2.0-beta.1]` CHANGELOG section from the Unreleased block.
4. Promote `dev` to `main` by fast-forward push. **Not a PR**:
   `enforce-pr-target.yml` drafts and prefixes any PR whose base is not `dev`, and the
   repo has never used one: `gh pr list --base main --state merged` returns `[]`, and
   `origin/main` and `origin/dev` are currently the same commit (`15b3d44a`).
   Fast-forward promotion is the established mechanism and touches no PR
   automation (004 #10).
5. Wait for exact-head CI and packed-install runs on the merge commit.
6. Dispatch `release.yml` with that version.
7. Verify `gh release view` shows the tag, payload archive, `SHA256SUMS`, and the
   candidate manifest.
8. Close the issues created in wp0, citing run ids and the release URL.

## Accept criteria (exact commands — 004 #13)

```bash
gh release view v0.2.0-beta.1 --repo lidge-jun/codexclaw --json tagName,assets,targetCommitish
gh api repos/lidge-jun/codexclaw/git/ref/tags/v0.2.0-beta.1 --jq .object.sha
for n in 24 25 26 27 28; do gh issue view "$n" --repo lidge-jun/codexclaw --json number,state; done
git rev-parse origin/main
```

1. The release lists at least three assets: payload archive, `SHA256SUMS`, candidate manifest.
2. The tag object SHA equals the attached manifest `candidateSha` and equals `origin/main`.
3. Issues #24-#28 all report state CLOSED, each with an evidence comment.

## Rollback

A bad release is superseded by `0.2.0-beta.2`, never by deleting the tag — deleting
a published tag breaks any installer that pinned `--ref`. Recorded here so the loop
does not improvise a destructive fix under pressure.
