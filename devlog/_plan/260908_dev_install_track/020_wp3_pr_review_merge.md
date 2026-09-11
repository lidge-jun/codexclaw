# wp3 — independent review and merge of PR 91/92/93 (diff-level)

Depends on wp1. Lands changes under `plugins/codexclaw/` through GitHub merges, not local patches.

## Inventory at plan time

| PR | Title | Head | +/- | Files | CI |
|---|---|---|---|---|---|
| 91 | fix: unify executor registration, dispatch and exit verification | `fix/executor-role-registration` | +506/-87 | 33 | 11 checks SUCCESS |
| 92 | test: cover Windows short-path source bindings | `codex/windows-short-path-regression` | +71/-4 | 5 | full matrix (see below) |
| 93 | fix(subagents): persist effort and add global defaults with live OCX models | `fix/subagent-settings-pr` | +1910/-791 | 57 | 11 checks SUCCESS |

All three target `dev` and report `MERGEABLE`. All three are cross-repository PRs from forks.

**PR 92 CI correction (AUDIT-A3).** The initial `enforce-target`-only state was NOT path filtering.
`.github/workflows/ci.yml:6`, `wsl.yml:6` and `packed-install.yml:15` all declare a bare
`pull_request:` with no `paths:` key; only `docs.yml` filters, and it triggers on push to
`main`. The GitHub API showed CI, WSL and Packed-install at `conclusion: action_required` — the
first-time-fork-contributor approval gate. Those three runs were approved from this session and the
matrix then executed: 10 of 11 checks pass including both Windows legs, with `wsl` still running.

**Merge gate for 92**: `gh pr checks 92` shows no `pending` and `mergeStateStatus` is
`CLEAN`, not `UNSTABLE`. `UNSTABLE` means a required check has not reported yet.

## Review method

One `anthropic/claude-opus-5` reviewer subagent per PR, dispatched in parallel as independent
lanes (DISPATCH-ISOLATION-01: each lane reads only its own PR diff; no lane writes the repo).
REVIEW-DECORRELATE-01 is satisfied at the family level — the reviewers are Claude, the integrating
session is the main agent.

Each lane receives a TASK packet with:

- **TASK**: review PR `<n>` for correctness, regression risk and scope discipline
- **SCOPE**: read-only; the PR diff plus the files it touches at `dev`
- **MUST DO**: identify real defects with `path:line` anchors; assess whether the PR's own
  validation claims are supported; check for scope creep beyond the stated problem
- **MUST NOT**: write files, run git mutations, comment on GitHub, merge
- **PROOF**: verbatim `path:line` quotations for every finding
- **RETURN FORMAT**: verdict (APPROVE / APPROVE-WITH-NITS / REQUEST-CHANGES) + numbered findings
  with severity + the exact anchors

## Merge order and rationale

Merge smallest-risk first so a failure is attributable:

1. **92 FIRST, and this is mandatory rather than merely lowest-risk.** PR 92 bumps the test-count
   badge from 2,670 to 2,671, and CI's inventory step fails when the published count does not match
   the measured suite total (`plugins/codexclaw/scripts/inventory.mjs`). 2,671 is correct only
   while `dev` still measures 2,670. If 91 or 93 lands first, 92's badge is stale on arrival and
   the inventory check reds `dev` itself. Merging 92 first keeps each badge correct at its own
   merge point; any residual drift after 91 and 93 is repaired by re-running the badge sync in wp4.
2. **91** — executor role registration, 33 files, full matrix green.
3. **93** — largest (57 files, +1910/-791), full matrix green, touches GUI + settings persistence.

After each merge, refresh the next PR's mergeability: `dev` has moved, so a previously
`MERGEABLE` PR can become `CONFLICTING`. Serialize; do not batch. All three PRs touch the
three README files, so a conflict on the later merges is expected rather than surprising — resolve
it by taking the later PR's badge value, since wp4 re-derives the final count anyway.

## Merge mechanics

```bash
gh pr view <n> --json state,mergeable,mergeStateStatus,headRefOid   # refresh immediately before
gh pr merge <n> --merge                                             # ordinary merge commit, matches history
gh pr view <n> --json state,mergedAt,mergeCommit                    # prove
```

Repository history uses merge commits (`Merge pull request #90 from ...`), so `--merge` matches
convention. No squash, no rebase, no branch deletion beyond what GitHub does by default.

## Handling a REQUEST-CHANGES verdict

A blocking finding does not auto-block the merge: the main session adjudicates. Record the finding,
decide whether it is a genuine defect or a reviewer misread, and either fix it on the branch, merge
with the finding recorded as a follow-up, or hold the PR and report it. Do not merge a PR whose
reviewer found a correctness defect without an explicit written rebuttal.

## Target — NEW `021_wp3_review_verdicts.md` (AUDIT-A6)

wp3 writes this file. Required contents: for each of PR 91, 92 and 93, the reviewer's verdict line,
every finding at MAJOR or above with its `path:line` anchor, and the main session's adjudication
(accepted, rebutted with reason, or deferred to a follow-up). A merged PR whose reviewer raised a
BLOCKER or MAJOR needs an explicit written rebuttal in this file.

## Proof for wp3

- three review verdicts recorded in `021_wp3_review_verdicts.md`
- `gh pr view <n> --json state,mergedAt` showing `MERGED` for 91, 92, 93
- `git log --oneline origin/dev` showing the three merge commits
