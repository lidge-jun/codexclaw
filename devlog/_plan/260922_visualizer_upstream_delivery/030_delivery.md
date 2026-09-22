# wp3 — Integrate and publish exact revisions

Depends on wp2. User authorizes both dev integrations, releases and applicable issue
closures. Main owns all branch/PR/release mutations; no force push, no native stacks,
no branch deletion, no bypass of required checks. All created PRs attach to task.

## codexclaw

Inspect fresh dev/main refs and existing open PRs before push. Feature PR base dev;
include prior policy docs and verified implementation, split coherent commits for
review. Refresh integration by normal merge if needed. Run full npm test, gate,
inventory --check, build and version checks on release candidate. Update inventory
and README published test counts from measured total using existing generator.
Bump root/workspace/manifest/lock release versions consistently with existing release
scripts/conventions; choose next unused patch after rechecking tags (currently 0.2.34).
Add actual CHANGELOG section. No arbitrary test-count guesses.

Push ordinary branch, create PR with exact scope/proof, inspect per-PR CI jobs and
review threads; merge only tested head. Promote dev to main via release PR according
to enforce-pr-target policy. After main CI and Packed install lifecycle succeed on
exact full SHA, dispatch release.yml on main with version, prerelease=false,
dry_run=false, expected_sha=<full main SHA>. Publication is not implied by merge.
Read back successful release run, tag target, assets, SHA256SUMS and candidate manifest.
Download published payload, verify hashes, inspect packaged visualizer scripts and
run isolated contract/export smoke. Rollback is previous immutable v0.2.34 payload;
never replace published assets. Actual platform CI is not claimed as local UI proof.

## Aside

Feature PR into dev, then dev->main delivery PR. Re-read settings/permissions; preserve
existing branch configuration. With no existing package/release workflow, use GitHub
Release of an immutable version tag and skill tar.gz plus SHA256SUMS. First determine
actual tags/versions; propose v0.1.0 only if no existing version conflicts. Build via
git archive of exact verified main commit with explicit SKILL.md/assets/reference/
scripts/port-manifest.json/LICENSE paths, excluding tests/private files/user state.
Create GitHub Release using gh and body-file, attach artifact + sums; no npm package.
Verify downloaded bytes and source SHA, run unpacked source-only/contract smoke and
negative PDF-tool check. Document distribution and rollback to previous main snapshot;
do not claim account installation if none was requested or verified.

## Closure and proof

Only close Aside #1–#4 after source/fixtures/adaptation acceptance and published
consumer archive are verified. Add concise GitHub evidence comments as part of the
explicitly requested issue delivery, with upstream PR/release, downstream PR/release,
checks, intentional differences and any limits; no private transcript content.
Do not auto-close downstream issues from upstream PRs. If a criterion is unmet, fix
it within goal rather than relabel it done. Record release URLs/digests/CI IDs and
exact SHAs in numbered evidence record and final response. Recheck main/dev heads
and open issue state after closure. Build/test release receipts are fresh.

Release tool workflows are program checks, not proof of installation everywhere.
Known bypass: direct unverified artifact upload; this plan does not use it.
Escalate actual credential/required-approval blockers with exact evidence; do not
weaken gates. No user resource budget was specified; managed bounded commands keep
communication available while waits continue.

Fresh preflight observed: Aside currently has only main, no GitHub releases, push/admin
permission available. Creating dev from verified main is within the user's explicit
dev-delivery request. Its docs-only branch is retained and rebased/merged without
rewriting remote work. Codexclaw npm script suite uses Node built-in TS support and
needs no tsx binary. Local Node v26.5.0/npm 11.17.0; CI pins Node 24, so hosted Node 24
results are part of release proof. No global runtime change is necessary.

Release terminology: 'immutable' here means this task never overwrites a published
tag or asset; GitHub's immutable-release setting has not been established and must
not be claimed. Record source SHA/digest and refusal to clobber separately. Aside
port-manifest.json and LICENSE are wp2 deliverables, so packaging preflight must fail
if either was not actually created/tracked. Publishing a new release does not itself
update a marketplace cache or an Aside account install.

Release scout disposition (Sol 01a0c7fa-3825-7900-b3c9-ec097d70db5f): accepted
existing GitHub payload path, dev creation, LICENSE/manifest preflight and no-account-
install claim. Require exact-main WSL success too because development/release.md
requires it although release.yml queries CI and Packed install only. Run existing
workflow dry_run=true before actual dispatch; dry-run success is not publication.
Aside's rollback target is the archived 03b7794 source snapshot, not a nonexistent
previous published release. No tag protection setting is changed in this unit.
