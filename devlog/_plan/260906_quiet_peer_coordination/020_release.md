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

1. Review scoped policy diff and current origin/dev; commit and push only this branch.
   Create a PR to dev with a short behavior description and verification evidence.
   Require the PR's exact head checks; refresh head/base before normal merge.
   Never merge unrelated open PRs or modify other local worktrees.
2. Verify origin/dev contains the policy commit. Apply release metadata on a current
   dev-based branch (the current branch may be reused if clean); open/merge its
   scoped release-preparation PR after exact-head checks. No force-push needed.
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
