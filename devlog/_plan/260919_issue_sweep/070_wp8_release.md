# 070 — wp8: promotion and release

## Preconditions

1. wp2-wp7 merged into `dev`, each with its own green PR checks captured fresh via
   `gh pr checks <n>`.
2. `CODEXCLAW_SKIP_REPOMAP_SMOKE=1 npm test` and `npm run gate` green on the final `dev`
   tree, with output captured rather than remembered. Baseline for comparison:
   3149 tests / 3144 pass / 1 fail / 4 skipped before `npm ci`, and the single failure was
   the missing-`react` install artifact described in `001`.
3. `dev` deletion protection verified active per `010`, before the promotion PR is merged.

## Steps

Corrected after the A-phase audit. The original version of this document assumed that
merging `dev` into `main` releases. It does not. See `002_audit_dispositions.md` B1/B2.

**1. Bump every version surface, not just the root.**
`plugins/codexclaw/scripts/check-versions.mjs` `collectSurfaces()` reads all of:

- `package.json`
- `plugins/codexclaw/.codex-plugin/plugin.json` (build metadata allowed here)
- every `plugins/codexclaw/components/*/package.json`
- `plugins/codexclaw/inventory.json` (`plugin.packageVersion`)

Then run `node plugins/codexclaw/scripts/check-versions.mjs <version>` and require exit 0
**before** the promotion PR is opened, not after.

**2. Regenerate the published test count.** `.github/workflows/ci.yml:62` runs
`inventory.mjs --check --tests "<measured total>"`, and the count is rendered as a badge
in `README.md`, `README.ko.md` and `README.zh.md` (`README.md:16` currently reads
`tests-3,150_passing`). Every phase in this unit that adds tests must do this in its own
PR, or that PR's CI fails on its own. At release, confirm the final count matches.

**3. MODIFY `CHANGELOG.md`** — one section for this release listing the landed clusters
by issue number. `.github/scripts/changelog-section.test.cjs` constrains the section
shape, so run it.

**4. Commit** as `chore(release): prepare codexclaw <version>`, matching `ca326d9e`.

**5. Open the promotion PR `dev -> main`.** `enforce-pr-target.yml:25,188` exempts this
same-repository promotion, so it is the sanctioned path. Before merging, confirm `dev`
deletion protection is active per `010`.

**6. Merge, then immediately re-read**
`gh api repos/lidge-jun/codexclaw/branches/dev --jq '{name,protected}'` to confirm `dev`
survived the merge. This is the live test of `010` and it only happens once.

**7. Wait for CI and the packed-install lifecycle on the resulting `main` SHA.**
`release.yml` verifies exact-head conclusions at `:191` by querying
`actions/runs?head_sha=<SHA>` and taking the last run **per workflow name** — a green run
from another commit cannot vouch for this one. So the release cannot be dispatched until
those runs exist and are green for that exact SHA.

**8. Dispatch the release explicitly.** `release.yml:12-30` triggers only on
`workflow_dispatch` or a `v*` tag push. The dispatch inputs `version` and
`expected_sha` are both **required**, and `expected_sha` fails the run if `main` moved:

```sh
gh workflow run release.yml --repo lidge-jun/codexclaw --ref main \
  -f version=<version> -f expected_sha=<main SHA> -f prerelease=false -f dry_run=true
```

Run it with `dry_run=true` first: the gate runs without publishing, which is the cheapest
way to discover a missing receipt. Then repeat with `dry_run=false`.

**9. Observe that dispatch's own run.** Capture the run ID returned by
`gh run list --workflow release.yml --repo lidge-jun/codexclaw --limit 5` and confirm it
is the dispatch just made, not the latest unrelated run. The deploy claim requires that
run's own conclusion from `gh run view <id>`, and `release.yml:278` is where assets are
published.

## Issue closure

An issue closes only when its substance landed. Where a remainder exists, the remainder is
**opened as a new tracked issue** and linked from the original before the original closes.
A remainder described in prose is not a disposition (`002` B6).

| Issue | Closure |
| --- | --- |
| #186 | Close the diagnostic defect; open a remainder for unverified hook execution evidence. |
| #188 | Close the missing-recovery-command half; open a remainder for the 35 context-window failures, which a requeue cannot repair. |
| #191 | **Stays open.** Only the diagnostic improvement is referenced; the routing/auth mismatch is untouched. |
| #193 | Close the documentation half; open a remainder for the desktop-wrapper transition, which is not in this repository. |
| #199, #200 | If the `60a07328` recovery is not completed, these stay open. Size is not a closure reason. |

Every other issue closes referencing the PR that landed it.

## Rollback

The release is additive: a version bump, a changelog section and a merge commit. If the
release run fails, `main` is already promoted, so recovery is a follow-up patch release
rather than a revert of the promotion. Do not force-push `main`.
