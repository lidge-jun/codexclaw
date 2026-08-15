# 050 — Publish 0.2.0-beta.1 and close the channel

Status: PLANNED — work-phase wp5 (issue #28). Rewritten after A-gate round 2.

## Loop spec

- Archetype: spec-satisfaction repair
- Trigger: `main` carries a month of unreleased work including the PR #1 hardening
- Goal: a published release whose manifest links green exact-head receipts, with
  `main` promoted and issues #24-#28 closed with evidence
- Verifier: the exact commands below
- Stop condition: release exists with assets; all five issues CLOSED with comments
- Terminal outcomes: DONE on published release; BLOCKED on auth failure or a
  missing install-lane receipt

## Version decision

`0.2.0-beta.1`. Minor bump because `main` diverged materially from `v0.1.0` —
runtime hardening, +3 hooks, +3 skills, +830 tests, the MLB 1.0 tracks. `-beta.1`
because the packed-install lane is brand new and the MLB receipts are deferred.
Shipping it as stable `0.2.0` would repeat the exact failure this unit is fixing:
publishing a claim the evidence does not carry.

`plugin.json` keeps its `+codex.<timestamp>` build metadata, regenerated at bump
time; `package.json` and the git tag carry the bare semver.

## Sequence

1. Bump `package.json`, `plugin.json`, and component `package.json` versions.
2. Regenerate inventory; `inventory.mjs --check` clean.
3. Write the `## [0.2.0-beta.1]` CHANGELOG section from the Unreleased block.
4. **Promote `dev` to `main` by fast-forward push — not a PR.**
   `enforce-pr-target.yml` drafts and prefixes any PR whose base is not `dev`, and
   the repo has never promoted by PR: `gh pr list --base main --state merged` returns
   `[]`, and `origin/main` and `origin/dev` are currently the same commit
   (`15b3d44a`). Fast-forward promotion is the established mechanism and touches
   no PR automation (004 #10).
5. Wait for exact-head CI + packed-install runs on the promoted commit.
6. Dispatch `release.yml` with that version.
7. Verify assets and tag binding.
8. Close #24-#28, each with a comment citing a run id or the release URL.

## Accept criteria — exact commands (004 #13, tightened round 2)

```bash
REPO=lidge-jun/codexclaw
TAG=v0.2.0-beta.1

# 1. assets present (expect >= 3: payload archive, SHA256SUMS, candidate manifest)
gh release view "$TAG" --repo "$REPO" --json tagName,assets,targetCommitish

# 2. tag -> commit, dereferencing an annotated tag
TAG_OBJ=$(gh api "repos/$REPO/git/ref/tags/$TAG" --jq .object.sha)
TAG_TYPE=$(gh api "repos/$REPO/git/ref/tags/$TAG" --jq .object.type)
if [ "$TAG_TYPE" = tag ]; then
  TAG_COMMIT=$(gh api "repos/$REPO/git/tags/$TAG_OBJ" --jq .object.sha)
else
  TAG_COMMIT=$TAG_OBJ
fi

# 3. the published manifest's candidateSha must equal that commit and origin/main
gh release download "$TAG" --repo "$REPO" --pattern 'candidate-*.json' --dir "$RELEASE_TMP"
MANIFEST_SHA=$(node -e "const fs=require('fs'),d=process.argv[1];const f=fs.readdirSync(d)[0];console.log(JSON.parse(fs.readFileSync(d+'/'+f,'utf8')).candidateSha)" "$RELEASE_TMP")
[ "$MANIFEST_SHA" = "$TAG_COMMIT" ] || echo 'MISMATCH: manifest vs tag'
[ "$MANIFEST_SHA" = "$(git rev-parse origin/main)" ] || echo 'MISMATCH: manifest vs main'

# 4. every issue closed AND carrying an evidence comment
for n in 24 25 26 27 28; do
  state=$(gh issue view "$n" --repo "$REPO" --json state --jq .state)
  ev=$(gh issue view "$n" --repo "$REPO" --json comments \
        --jq '[.comments[].body | select(test("actions/runs/[0-9]+|releases/tag/"))] | length')
  echo "#$n state=$state evidence_comments=$ev"
done
```

Passing means: at least three assets; `MANIFEST_SHA == TAG_COMMIT == origin/main`
with no MISMATCH lines; and all five issues `state=CLOSED` with
`evidence_comments >= 1`.

## Rollback

A bad release is superseded by `0.2.0-beta.2`, never by deleting the tag — deleting
a published tag breaks any installer that pinned `--ref`. Recorded here so the loop
does not improvise a destructive fix under pressure.
