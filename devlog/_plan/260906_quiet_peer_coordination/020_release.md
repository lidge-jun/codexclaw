# 020 — Integrate and release 0.2.19

Depends on: verified wp1. Work phase wp2; class C4, spec satisfaction.
Trigger/goal: ship the corrected guidance through the existing release train.
Non-goals: npm publishing, dependency changes, workflow redesign, unrelated dev work.
Verifier: check-versions.mjs plus explicit CLI/GUI/lockfile reads; inventory --check;
exact-SHA CI, WSL and Packed install lifecycle; Release workflow's candidate gate;
downloaded SHA256SUMS and archive, tag ancestry and payload policy hash.
Stop: all gates pass for the frozen release SHA and v0.2.19 is publicly published.
Resource/authority/terminal rules: 000; user explicitly authorized merge/release/install.
Astra/high independent review; reclaim failed packets after two distinct failures;
new worker scope is a P amendment. No token/cost cap; <=60s command observations.

## MODIFY version surfaces (exact transformation)

For package.json, cli/package.json, plugins/codexclaw/gui/package.json and each
plugins/codexclaw/components/*/package.json: version 0.2.18 -> 0.2.19.
For package-lock.json: root version and packages[""] plus the exact corresponding
workspace entries' version fields 0.2.18 -> 0.2.19; preserve the dependency graph.
For plugins/codexclaw/.codex-plugin/plugin.json: version
0.2.18+codex.20260906043759 -> 0.2.19+codex.<fresh UTC timestamp>.
For plugins/codexclaw/inventory.json: regenerate from the manifest and measured
existing test total (2579 at baseline) with scripts/inventory.mjs --write --tests.
README.md, README.ko.md and README.zh.md are generated inventory badge consumers;
accept only the generator's corresponding changes. docs-site@0.0.1 is independent.
For CHANGELOG.md: add a 0.2.19 / 2026-09-06 entry describing default-off peer sends,
explicit user requests and confirmed blocking CI/merge coordination, preserved
read-only context and authorized child delegation. Do not invent missing older entries.
No implementation/runtime changes are planned in this phase.

## Integration and publication

1. Revalidate wp1 D evidence and origin/dev; prepare the 0.2.19 metadata before
   publishing the branch. Policy and release metadata use separate local commits in
   one scoped PR to dev. This P amendment avoids an extra CI/PR round while preserving
   every exact-head gate; no unrelated PRs or local worktrees are changed.
2. Review all changes, push only this branch and open its PR to dev. Require exact-head
   checks; refresh head/base before normal merge and prove dev contains the policy
   commit. No force-push. The >500-line review includes the required diff-level roadmap;
   the eight-file production guidance delta is 145 lines, so splitting these same
   task artifacts into a PR stack would add coordination without isolating behavior.
3. Verify resulting dev SHA CI, WSL and packed-install. Create dev -> main promotion
   PR; inspect its complete delta and keep unrelated pending work out of this task.
   Merge normally after checks and record merge SHA. If dev moved, re-read the delta.
4. Query actions by the actual main SHA. Only after CI/WSL/packed all pass, run:
   gh workflow run release.yml --repo lidge-jun/codexclaw --ref main
   -f version=0.2.19 -f prerelease=false -f dry_run=false.
   Recheck main identity immediately before dispatch and the returned run headSha.
5. Observe Release success; download its candidate, payload and SHA256SUMS. Verify
   sha256sum/shasum, immutable tag commit and payload manifest/policy. Save evidence.

No local repository-wide suite is needed for prose/version changes: existing focused
checks plus the unmodified CI/release workflows provide the full suite and rebuild.
Baseline native-execution tests are 21/21 and gate exit0. Full suite measurement comes
from current-head CI, never a remembered badge. Fix any actual failures before release.
Rollback: preserve v0.2.18 immutable assets and existing install payloads; revert source
through a new commit if necessary. Never overwrite/delete a published version tag.

P refresh: wp1 D complete at 15ae4434 with native21/gate/independent PASS.
Source state is clean apart from this roadmap amendment. Version still0.2.18.

## Release review repair amendment

PR75 merged at aebead02 after11 green checks. Post-merge review thread
PRRT_kwDOTLf_586fp6Sp reports P2 ambiguity: categorical notification bans can also
read as forbidding explicitly requested status/result delivery. Accept the finding;
two independent reviews missed this wording contradiction. No dependency or phase
conflict: retain default-off, qualify only unsolicited notification restrictions.
Reset/re-enter wp2 P before this bounded source repair; version remains0.2.19 and
nothing has been published. Main owns the patch; same A reviewer verifies amendment.

MODIFY plugins/codexclaw/skills/dev/references/peer-collaboration.md:
- Before: `introductions, progress reports, advisory impacts, completion notices, unsolicited`
- After: `unsolicited introductions, progress reports, advisory impacts, completion notices, or`
- Before: `follow-up work, or requests to keep another task busy.`
- After: `follow-up work, or requests to keep another task busy.`
- Add before the list: `The following notification defaults do not prohibit contact explicitly requested by the user.`
MODIFY plugins/codexclaw/skills/loop/SKILL.md:
- Before: `Keep this goal's work local; do not send progress or completion notices to other`
- After: `Keep this goal's work local; do not send unsolicited progress or completion notices to other`

Verifier: independently contrast explicitly requested status/result sends (allowed
subject to host/wake checks) and unsolicited progress/result sends (denied). Rerun
native21/gate/diff and fresh exact-head PR/dev/main CI. Resolve the existing review
thread only after the corrective commit is verified and landed; no waiver or dismissal.
