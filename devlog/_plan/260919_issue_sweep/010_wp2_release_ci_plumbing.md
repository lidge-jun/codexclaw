# 010 — wp2: release and CI plumbing (#175, #184)

Delivery order note: wp3 (`020`) executes before this phase, because #196 blocks
`apply_patch` on Markdown and every phase here is documentation-heavy. The dependency
registered in the goalplan is unchanged; only the execution order moved.

## #175 — `dev` can still be deleted

The code is already correct. `.github/scripts/closed-pr-branch-cleanup.cjs:17` lists
`dev` in `PROTECTED_BRANCHES`, `:160` rejects protected names before examining PRs, and
`:172` independently rejects merged heads. `cleanup-closed-pr-branches.yml:116` also
respects GitHub protection. `release.yml` contains no branch deletion. The issue's
accusation against the cleanup workflow is therefore false.

What remains is live repository configuration: `delete_branch_on_merge` is `true`,
`dev.protected` is `false`, and `rules/branches/dev` is empty. When the wp8 promotion PR
`dev -> main` merges, GitHub itself can delete the head.

**MODIFY** `docs-site/src/content/docs/development/release.md`

- Before: `Open the promotion PR from \`dev\` to \`main\` and merge it once checks are green.`
- After: the same instruction, preceded by a precondition that deletion protection for
  `dev` is verified active, and followed by a postcondition that `dev` still exists.
  Name the two read-only checks:
  `gh api repos/lidge-jun/codexclaw/rules/branches/dev` and
  `gh api repos/lidge-jun/codexclaw/branches/dev --jq '{name,protected}'`.

**CONFIGURATION (not a file change)** — a `protect-dev` repository ruleset:
`target:"branch"`, `enforcement:"active"`,
`conditions.ref_name:{include:["refs/heads/dev"],exclude:[]}`, `rules:[{type:"deletion"}]`,
`bypass_actors:[]`. Deliberately narrow: extending `protect-main` instead would also
impose its unrelated status-check requirements on `dev`. Ordinary merged-feature cleanup
stays enabled.

This is a repository-settings mutation rather than a code change, so it is surfaced to
the user rather than assumed. It is protective, reversible and scoped to the branch this
unit ships through.

**Verification.** `node --test .github/scripts/closed-pr-branch-cleanup.test.cjs`
(existing coverage at `:44,:57,:67,:146`) proves the code path; it cannot prove GitHub's
live configuration. The configuration proof is the two `gh api` reads above, repeated
after the wp8 promotion. The prose change is human review.

## #184 — lanes are isolated but not mergeable

`dispatch-surfaces.md:108` stops at "N independent lanes means N worktree threads, N
checkouts, N FSMs. The parent coordinates with `wait_threads` and integrates." There is
no lane identity record, no duplicate-ownership check and no merge handoff. The pieces
that do exist are in `stacked-prs.md` at `:99`, `:124`, `:206` and `:240`; what is
missing is the recipe joining them across tasks.

Host confirmation that subagents cannot serve as lanes:
`codex-rs/core/src/tools/handlers/multi_agents_common.rs:223` copies the parent cwd, and
at `78245b47af` `codex-rs/core/src/agent/child_config.rs:182-183` does the same, called
from `:84` and `:154`.

**MODIFY** `plugins/codexclaw/skills/pabcd/references/dispatch-surfaces.md` at `:110`

- Before: the two-sentence coordination paragraph quoted above.
- After: that paragraph plus a lane-handoff recipe recording repository identity, lane,
  task and host IDs, worktree, branch, base ref and SHA, head SHA, issue and PR, owner,
  scope and status. Before writing, refresh the integration ref and compare open PRs,
  worktrees and manifests for a duplicate issue, branch or overlapping scope. Define the
  host as the coordinating task: it decides rebase and merge sequencing, each lane
  executes only inside its assigned checkout, and subagents never manage another lane's
  branch. Require hosted evidence carrying PR head SHA, the actually tested SHA, workflow
  event, run and check IDs, attempt, conclusion and required-shard coverage. After a
  timeout or compaction, recover the existing task and worktree from the manifest and
  resume; a timeout alone never authorizes replacement and never proves completion.

**MODIFY** `plugins/codexclaw/skills/dev/references/stacked-prs.md` at `:139`

- Before: `See \`cxc-pabcd\` \`references/dispatch-surfaces.md\`.`
- After: a pointer naming the lane manifest, preflight and handoff recipe specifically,
  plus a note that a `[WRONG BRANCH]` verdict can be a repository enforcer rejecting a
  legitimate parent base. Inspect that policy and preserve the dependency topology
  instead of retargeting children to `dev`. Changing `enforce-pr-target.yml:192` is
  separate scope and is not done here.

**NEW** `plugins/codexclaw/scripts/check-lane-manifest.mjs` — a small read-only JSON
validator requiring lane identity, base and head records, and rejecting duplicate active
issue ownership unless explicitly partitioned into disjoint scopes under one coordinating
owner. It is coordination evidence, not a lock, and it grants no branch-rewrite or
peer-message authority.

**NEW** `plugins/codexclaw/test/lane-manifest.test.mjs` — in-memory fixtures: valid,
duplicate owner, permitted partition, missing base, missing head.

**Verification.** `node --test plugins/codexclaw/test/lane-manifest.test.mjs`. The
existing `package.json` test glob already covers `plugins/codexclaw/test/*.test.mjs`, so
the new test joins `npm test` without a glob change. Ownership wording, recovery
instructions and hosted-only compatibility are human review; a JSON validator cannot
prove live collision freedom.

## Out of scope here

Changing `enforce-pr-target.yml`, mutating OpenCodex PRs, and any host-runtime change.
