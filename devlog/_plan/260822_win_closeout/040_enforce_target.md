# 040 - wp04: the enforce-target check blocks its own release path

## Two defects in one workflow

`.github/workflows/enforce-pr-target.yml` requires every PR to target `dev`. It has
been failing on every PR, including PR #38.

### Defect 1 - the release promotion path is not exempt

`main` exists precisely to receive `dev` promotions, and the workflow's own comment
text says so: "main receives only release promotions". But the check is a flat
`pr.base.ref !== "dev"`, so the promotion PR gets prefixed `[WRONG BRANCH]`, converted
to draft, and told to retarget itself to the branch it is being promoted FROM. The
release path cannot pass its own gate.

Fix: treat `dev -> main` from the same repository as exempt.

```js
const isPromotion =
  pr.base.ref === PROMOTION_BASE &&
  pr.head.ref === PROMOTION_HEAD &&
  pr.head.repo?.full_name === `${owner}/${repo}`;
const wrongBase = pr.base.ref !== EXPECTED_BASE && !isPromotion;
```

The same-repo condition matters: a fork whose branch happens to be named `dev` must
not inherit the exemption.

### Defect 2 - an unavailable mutation fails the whole check

```
GraphqlResponseError: Resource not accessible by integration
  data: { convertPullRequestToDraft: null }
##[error]Unhandled error
```

`permissions: pull-requests: write` is declared, but `convertPullRequestToDraft` is
not granted to the default `GITHUB_TOKEN` in every repository configuration. The
mutation throws, nothing catches it, and the step exits non-zero - so the check is red
even when the enforcement it exists to perform (title prefix + explanatory comment)
already succeeded.

Fix: wrap both mutations, return a boolean, and downgrade a refusal to
`core.warning`. When drafting was refused, rewrite the stored state with
`autoDraftedByBot: false` so a later corrective run does not try to "restore" a draft
status this workflow never set, and say so in the comment.

## Verification

### Two more defects the audit found in the first draft of this fix

**`botComment` was captured once and never refreshed.** `upsertComment` closes over a
handle resolved before any write. On a FRESH wrong-base PR no bot comment exists, so
the first upsert CREATES comment #1 and the corrective upsert created a SECOND comment
instead of updating it. The next run's `comments.find` then returned the first comment,
whose state still said `autoDraftedByBot: true` - so the correction never applied, and
on retarget the workflow undrafted a PR it never drafted. Fix: `createComment` returns
the created comment and `botComment` is reassigned to it. The two nearly identical
comment bodies also collapsed into one `wrongBaseComment(draftExplanation)` builder.

**`markReadyForReview()` returned a boolean nobody read.** `convertToDraft` got both
the try/catch AND the call-site handling; its sibling only got the try/catch. So a
FORBIDDEN restoration cleared the state to `active: false` and posted "The pull request
has been marked ready for review again" while the PR sat there still drafted, with no
record. Fix: capture the result. On refusal the state stays `active` so a rerun can
retry, and the comment says restoration failed.

### How it was verified

`.codexclaw/wf-sim.mjs` extracts the embedded script body, wraps it in an async
function, and runs it against mocked GitHub REST/GraphQL APIs. Six scenarios, 18
assertions, all passing:

1. `dev -> main` promotion: no prefix, no mutation, no comment.
2. A FORK branch named `dev` targeting `main`: enforcement still fires.
3. Fresh wrong-base PR with drafting refused: exactly ONE comment, updated in place,
   `autoDraftedByBot` corrected to false, check does not throw.
4. Retarget after a refused draft: no `markReadyForReview`, prefix removed.
5. Normal cycle: drafted, then undrafted on retarget, one comment, state closed.
6. Retarget with restoration refused: no success claim, state stays active, warning
   recorded.

The promotion PR opened in wp06 is the live confirmation.
