# 020 — wp2: release pipeline (dev → main → deploy)

Diff-level build doc for work-phase wp2-release. User explicitly authorized:
push to origin, dev→main merge, and deploy/release completion.

## Preconditions

- wp1 done: skill edit committed on `dev`, gate green, C>D closed.
- Working tree contains only this unit's changes plus pre-existing untracked
  junk (do NOT touch unrelated untracked files: `id.txtnID=necho`, `mktemp:`,
  `output/`, `tmp/`, stray hash scripts, older devlog dirs).

## Steps

1. **Push dev** — `git push origin dev` (user-approved, DEV-GIT-PUSH-01
   satisfied by the goal text).
2. **Open PR dev → main** — `gh pr create --base main --head dev` with a
   release summary naming this unit's change. Check for a PR template first
   (`.github/PULL_REQUEST_TEMPLATE*`).
   - Note: `main` is far behind `dev` (677 commits at goal creation) — this
     repo's release train works by merging `dev` into `main` wholesale
     (precedent: PR #166 "chore(release): promote codexclaw 0.2.26 to main",
     base main ← head dev, merged). Follow that precedent; do not cherry-pick.
3. **Merge** — `gh pr merge --merge` (or the repo's ruleset-required method;
   if the ruleset demands checks, wait for them with `gh pr checks --watch`).
4. **Confirm deploy/release** — identify the release mechanism:
   `.github/workflows/` release dispatch (see commit `9d3159e4` "ci(release):
   guard the dispatch, fail closed on re-publish, attest the payload").
   Evidence: `gh run list` / release listing showing the post-main-merge
   release outcome. If release is tag-driven and out of this unit's scope,
   record that as the deploy boundary with the workflow file:line.
5. **Evidence** — PR URL, merge SHA, run/release URLs recorded in this doc's
   095_done.md successor and the goalplan criterion c-4.

## Failure handling

- Merge conflict on the PR: mechanical resolution only; anything semantic →
  NEEDS_HUMAN.
- Required check failure: diagnose; if caused by this unit's change, fix on
  dev and re-push (loop back to wp1 C). If pre-existing/flaky, document with
  run URL and report BLOCKED rather than force-merging.
- `gh` auth failure → BLOCKED, report exactly.
