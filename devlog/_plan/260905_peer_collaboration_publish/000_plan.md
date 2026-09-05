# Publish verified peer collaboration guidance

Session: 01a07026-2e97-7b53-9234-9e8aae6b15c2. HOTL delivery follow-up.
User explicitly authorized PR creation, inspection and merge.
Initial HEAD: 260f3efcd2cecc87926295fdc81a686dd8905ac1.
Fetched dev: 0445e50a49d5b150f335e2949a22f1661e02dded (ancestor; no rebase needed).
Repository: lidge-jun/codexclaw. Branch: codex/peer-collaboration-guidance.

## Scope and cycle

One spec-satisfaction PABCD cycle, workPhaseId=publish. P records this delivery plan.
A independently rechecks the committed change and publishing boundary.
B adds 010_delivery_preparation.md, commits only these records, pushes this branch
and creates/reuses its PR targeting dev. C checks the actual PR head/CI/review,
then performs the requested normal merge and verifies ancestry. D records actual
evidence in the session-bound ledger and completes this delivery goal.

This is one cohesive peer guidance change (eight product files, about178 added
lines) with its raw audit data. Splitting that evidence into a PR stack adds no
independently shippable feature. Full prior verification is archived at
devlog/_fin/260905_peer_collaboration_upgrade/022_closeout.md.

Allowed: branch push, PR metadata, narrowly necessary review/CI corrections and
ordinary dev merge. Excluded: main promotion, release/install, force push, admin
or protection bypass, branch deletion, repository settings and other worktrees.
The dev branch protection API returned 'Branch not protected'; this is not a reason
to omit checks. All current PR checks and review findings are inspected regardless.

## Verification and resources

Use current GitHub API/gh data, not prior local test claims, to verify the final PR.
Existing CI runs the full suite on Linux, macOS, Windows LF and Windows CRLF.
Also inspect applicable docs/packed-install/target checks. Expected conditional
skips are identified from workflows; canceled or failed required jobs are not green.

Local checks remain scoped: archived payload/scenario checkers and selected existing
catalog/inventory/manifest suites. Never run the repository-wide local suite.
Recheck local/remote PR head equality immediately before merge; use
gh pr merge --merge --match-head-commit with the checked SHA, without admin/delete flags.
After merge fetch origin dev and prove merge SHA is an ancestor of FETCH_HEAD.
Count unresolved review threads before and after merge and inspect any new feedback.

Credentials: existing GitHub access to this repo only. No new purchases, credentials
or unrelated mutations. No user-specified token/cost limit; reassess at90 minutes.
Wait in bounded intervals; a timeout does not authorize retrying merge or bypassing CI.
If HEAD changes or a gate fails, inspect the delta and repair only in scope.
If additional authority is needed, report it rather than silently weakening gates.

## Artifact and preservation contract

NEW this numbered plan and B delivery-preparation record; no other source change
is planned. B record contains real independent verdict, scoped preflight results,
and the exact publish command/target. After publication, remote observations and
merge receipts live in ignored .codexclaw/evidence to avoid moving the checked head.
No hidden state JSON edits mark completion; CLI task/criteria/D actions do that.

Initial nine dirty tracked files are protected by the existing SHA-256 snapshot;
old untracked artifacts are not staged. PR diff must contain only committed task work.
Source-bound C receipt runs after final source edits/commits; it observes this exact
checkout. Goal DONE requires actual merged state, green exact-head checks, no open
actionable review findings, current dev ancestry and unchanged original dirty files.
Noop only if that exact delivery is already verified; external blockers are reported.
