# 060 - wp06: the 0.2.7 release

## What shipped

`v0.2.7`, published from `main` at `0fe656d` with the payload tarball, SHA256SUMS,
and the `candidate-0.2.7.json` evidence record attached.

## Two things the release path itself was wrong about

**The tag was immutable and pointed at the wrong commit.** `v0.2.7` already existed
on `f00185d` from an earlier failed attempt, and a repository ruleset forbids both
force-updating and deleting it. Retagging was not an option, so the release ran through
`workflow_dispatch` on `main` instead of the `push: tags` trigger. Worth knowing before
the next release: a failed release attempt leaves a tag that cannot be reused.

**`enforce-target` could not pass on the PR that fixes it.** `pull_request_target`
always executes the workflow file from the BASE branch, so PR #38 - the promotion that
introduces the exemption - was still judged by `main`'s old copy. This is structural,
not a bug in the fix: the first promotion after a change to that workflow can never
benefit from it. #38 was merged with `--admin`; PR #41, the very next promotion,
showed `enforce-target pass` in 4 seconds and kept its title unprefixed. That is the
live confirmation.

## Test count

The release gate refused twice, and it was right both times.

First: `platform-ci is missing` plus `published tests=1900 but the measured suite
reported 1901` - both stale from the earlier attempt's SHA. Second, on the new commit:
`published tests=1901 but the measured suite reported 1924`. The closeout added three
cases (the home-directory project-root regression, the win32 path-casing regression,
and the evidence-root realpath coverage from the symlink sweep). Badges regenerated to
1,924 in `5e5317c` and promoted through PR #41.

## Issues

- #32 closed - symlink guards run on a stock non-admin Windows checkout.
- #33 closed - both halves: the resolution ladder, and doctor's remediation text for
  the trust entries only the host Codex binary may write.
- #40 filed, deliberately not fixed here - `cxc receipt test -- npm test` hits the
  same Windows spawn class as #33 (`ENOENT` bare, `EINVAL` for `.cmd`), which blocks
  the documented C->D receipt path on Windows. It wants `codex-bin.ts` generalized past
  the `codex` binary, which is wider than a release should carry.

## Final state

| surface | result |
|---------|--------|
| native Windows, Node 24 | 1923 tests, 1923 pass, 0 fail, 6 skip |
| WSL Ubuntu, Node 24 | 1923 tests, 1922 pass, 0 fail, 1 skip |
| CI (ubuntu / windows x2 crlf / macos) | green on `071eb40` and `0fe656d` |
| WSL workflow (drvfs + native ext4) | green |
| Packed install lifecycle | green on all three runners |
| release gate | passed, published |
