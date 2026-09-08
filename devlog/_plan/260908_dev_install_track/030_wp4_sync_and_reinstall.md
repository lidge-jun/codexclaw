# wp4 — dev sync, fast-forward, real reinstall, fresh proof (diff-level)

Depends on wp2 and wp3. No new source changes; this phase integrates and proves.

## Sequence

### 1. Order: merge FIRST, then write the documentation (AUDIT-A1, BLOCKER)

**The two orderings are not equivalent.** PR 92 and PR 93 both modify `README.md`, `README.ko.md`
and `README.zh.md` — the same three files wp2 rewrites — and both bump the test-count badge at
`README.md:16`. Verified with `gh pr view 92 --json files` and `gh pr view 93 --json files`.
Pushing a large README rewrite to `dev` first would turn those PRs' README hunks into conflicts and
flip their `mergeable` state, which is exactly the hazard 020 warns about for PR-to-PR ordering.

**Mandated order**, no alternative:

1. wp3 merges 92, then 91, then 93 into `dev`
2. `git fetch origin && git merge --ff-only origin/dev`
3. write the wp2 README sections on the merged head, re-deriving every anchor by content
4. commit and push

```bash
git add README.md README.ko.md README.zh.md scripts/ docs-site/ devlog/_plan/260908_dev_install_track/
git commit -m "docs: replace the symlink dogfood track with a real dev install"
git push origin dev
```

The user authorized `dev` push in this session ("dev 상태해놓고 원격 상태도 해놓고"). `dev` is the
integration branch, so a documentation commit landing there directly is ordinary. A force push is not.

### 2. Fast-forward local `dev`

```bash
git fetch origin
git merge --ff-only origin/dev
git rev-parse HEAD origin/dev          # must be equal
git merge-base --is-ancestor <pre-ff-sha> HEAD && echo FF_PROVEN
```

`--ff-only` is the safety: if the local branch has diverged, this fails loudly instead of
creating a surprise merge. A failure here is BLOCKED, not a reason to reset.

### 3. Rebuild and reinstall

```bash
npm run build
scripts/dev-install.sh
```

**Corrected rationale (AUDIT-A2).** The shipped `dist/` is TRACKED, not ignored:
`git ls-files 'plugins/codexclaw/components/*/dist/*'` returns 160 files and `git check-ignore`
exits 1 on them. The bare `dist/` line at `.gitignore:2` does not apply to already-tracked files.
PR 91 and 93 each ship their own compiled output, so after both merge the committed `dist/` is the
concatenation of two separately-built trees.

The rebuild therefore proves that the merged SOURCES compile to the committed ARTIFACTS. The real
acceptance signal is that `git status --porcelain plugins/codexclaw/components/*/dist/` is EMPTY
after `npm run build`. A non-empty result means the two PRs' builds disagree with the merged
source and must be reconciled and committed before the install.

### 4. Fresh proof on the final head

| Criterion | Command | Expected |
|---|---|---|
| c-8 | `git rev-parse HEAD origin/dev` | identical SHAs |
| build | `git status --porcelain plugins/codexclaw/components/*/dist/` | empty after `npm run build` |
| c-9 | `npm test` | 0 failures on the merged head |
| c-4 | `npm run gate` | OK |
| c-10 | `diff -rq plugins/codexclaw <cache>/<version>` | exit 0 |
| c-10 | `find <cache> -type l | wc -l` | 0 |
| c-10 | `node <cache>/<version>/bin/cxc.mjs doctor` | `overall: PASS` |

Every one of these runs AFTER the final merge, not before. Evidence gathered at the wp1 baseline
does not certify the merged head.

## Expected complications

**Hook trust.** PR 91 changes hook matchers; its own description says "doctor reports the changed
matcher hash as drifted" and that delivery is unverified until reapproval. After reinstall, expect
`cxc doctor`'s `hook-trust` line to report untrusted hashes. That is NEEDS_HUMAN, not a
failure to fix: the user re-approves in the Codex UI. Record the exact doctor line and say so.

**Version directory.** The manifest version is unchanged (`0.2.24+codex.20260908031619`), so the
reinstall reuses the same cache directory. That is intended — `codex plugin add` re-copies and
prunes at the same version, verified in the preceding turn with a probe file.

**Test count.** PR 91 reports 2681 total and PR 93 reports 2692; the pre-merge suite was 2670. The
merged total will differ from all three. Report the actual number rather than matching a PR claim.

## Proof for wp4

All six rows above, captured on the final `dev` head, plus the recorded doctor output.
