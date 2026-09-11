# wp8 / integration — publish the chain on the existing `dev`, prove every layer

This work-phase adds no layer. It turns the seven branches into seven reviewable
pull requests, each green on its own CI, and stops there: merging belongs to the
user (DEV-STACK-04, ESCALATE).

## 1. Resolve the base branch — read it, do not write it

Revision 1 of this document assumed `dev` was still missing and told the
implementer to create it at `6aae1c97`. That is withdrawn. Peer session
`01a08fba` restored `dev` at `a267b398` while this unit was being written, and the
audit caught the stale instruction. Read the remote first, every time:

```powershell
git ls-remote --heads origin
git fetch origin
git rev-parse "origin/dev^{tree}" "HEAD^{tree}"
```

Observed at revision 2: `dev` = `a267b398`, `main` = `6aae1c97`, plus the peer's
`codex/win-sweep-roadmap` and `codex/fix-ocx-windows-detect`. `a267b398` and
`6aae1c97` share tree `904bbe09`, so the base this chain was written against and
the restored `dev` are the same tree.

Decision rule, in order:

1. **`origin/dev` exists and its commits are all contained in this chain's base**
   (`git merge-base --is-ancestor origin/dev HEAD` exits 0): rebase the chain onto
   `origin/dev` (section 4) and write nothing to `dev`. This is the current case.
2. **`origin/dev` has commits this chain does not contain**: rebase the chain onto
   the real `origin/dev` head, re-run every layer's tests, and record the
   divergence. Still write nothing to `dev`.
3. **`origin/dev` is absent again**: stop and tell the user. Recreating a deleted
   trunk-adjacent branch is a repository-level decision, and a peer session is
   basing its own stack on that branch. Do not race it.

Never force-update `dev`, and never fast-forward it merely to match this chain's
base: the tree is identical, so the move would buy nothing and would move a branch
another active session depends on.

## 2. Push the chain bottom-up

Order matters: a child pushed before its parent opens a PR whose base branch does
not exist yet.

The chain is already based on `origin/dev`: L0 was rebased onto `a267b398` at
revision 2, so `6aae1c97` is no longer an ancestor of any layer and must not be
used as a rebase base again. Re-run the cascade only if `origin/dev` MOVES:

```powershell
git fetch origin
git merge-base --is-ancestor origin/dev codex/fix-memory-write-gate; $LASTEXITCODE
# non-zero means dev moved; only then:
git rebase --update-refs --onto origin/dev <old-dev-sha> codex/fix-memory-write-gate
```

`--update-refs` moves every intermediate layer branch that points inside the
rebased range in one pass. Verify each layer afterwards with the ancestry check
below before pushing anything.

```powershell
git push -u origin codex/memory-recall-roadmap
git push -u origin codex/fix-recall-cwd-normalization
git push -u origin codex/fix-memory-search-semantics
git push -u origin codex/fix-recall-cli-arg-hygiene
git push -u origin codex/fix-chat-index-freshness
git push -u origin codex/fix-recall-intent-regex
git push -u origin codex/fix-memory-write-gate
```

Before each push, confirm the branch actually contains its parent:

```powershell
git merge-base --is-ancestor <parent> <child>; $LASTEXITCODE   # must be 0
git log --oneline <parent>..<child>                            # layer-only delta
```

## 3. Open one PR per layer, base = the layer below

`--base` is passed explicitly every time. Omitting it makes `gh` fall back to
`branch.<current>.gh-merge-base` and then to the repository default branch, which
would silently target trunk instead of the parent.

| # | head | base | title |
|---|---|---|---|
| L0 | `codex/memory-recall-roadmap` | `dev` (`a267b398`) | docs(plan): 260911 memory/recall sweep roadmap |
| L1 | `codex/fix-recall-cwd-normalization` | `codex/memory-recall-roadmap` | fix(recall): normalize extended-length and case-differing cwd in scan and index alike (#138) |
| L2 | `codex/fix-memory-search-semantics` | `codex/fix-recall-cwd-normalization` | fix(recall): keep cross-paragraph AND hits and forward synonyms to the chat fallback (#142, #143) |
| L3 | `codex/fix-recall-cli-arg-hygiene` | `codex/fix-memory-search-semantics` | fix(recall): answer --help before working and validate path flags (#139, #140) |
| L4 | `codex/fix-chat-index-freshness` | `codex/fix-recall-cli-arg-hygiene` | fix(recall): report index staleness from the source JSONL (#144) |
| L5 | `codex/fix-recall-intent-regex` | `codex/fix-chat-index-freshness` | fix(recall): match the advertised recall triggers and stop firing on write requests (#137) |
| L6 | `codex/fix-memory-write-gate` | `codex/fix-recall-intent-regex` | fix(pabcd-state): close the Windows memory-write-gate bypasses (#135, #136, #141) |

Every PR body carries the same stack map with a `<- you are here` marker, the
issues it closes, and the sentence `Review this PR's diff only.` Use
`Closes #N` only on the layer that actually fixes N, so a bottom-up merge closes
each issue exactly once.

The `Enforce PR target branch` workflow runs on `pull_request_target` and rewrites
the title of any PR whose base is not `dev`. Mid-stack layers legitimately base on
their parent, so expect that workflow to flag L1-L6. Read its comment rather than
retargeting: retargeting to `dev` would destroy the stack. If the workflow blocks
the layers outright, that is a repository-policy conflict with the requested
delivery shape — report it to the user instead of working around it.

## 4. Cascade rule

If any layer is amended after publication, or `dev` moves:

```powershell
git rebase --update-refs <new-base>
git push --force-with-lease origin <branch>
```

Never bare `--force`. After the cascade, re-verify for every layer above the edit:
ancestry (`git merge-base --is-ancestor`), the layer-only delta
(`git log --oneline parent..child`), and that the PR's base ref still names the
branch below. Review state is stale after a force-push; say what changed.

## 5. Receipts belong to the layers, not to this phase

Every implementation layer runs `cxc receipt test` at its own C phase and carries
its own `testReceiptPath` on its own C->D attest. This work-phase produces no
receipts on their behalf and cannot certify a layer whose receipt is missing. If a
layer reaches this phase without one, that layer is not done — send it back.

## 6. CI per layer

```powershell
gh pr checks <number> --repo lidge-jun/codexclaw
gh run list --repo lidge-jun/codexclaw --branch <branch> --limit 5
```

Four workflows apply: `CI`, `Packed install lifecycle`, `WSL`, and
`Enforce PR target branch`. Each layer needs its own green run at its own head SHA.
A missing, skipped or cancelled required check is not a pass. Record event, head
SHA, run id and conclusion per layer; do not read one green summary as the stack's
state.

## 7. Completion, and what is explicitly not done

DONE for this work-phase means: `origin/dev` was read and left untouched, seven
branches are pushed, seven PRs are open with the bases in the table above, and each
layer has its own green run recorded with its head SHA and its own test receipt.

Not done here, by instruction: merging any PR, enabling auto-merge, deleting any
branch, cutting a release, deploying docs, or reinstalling the plugin. The user
merges the stack bottom-up when they choose to.
