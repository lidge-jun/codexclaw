# 030 — Official installation and verification

Depends on: wp2 published immutable release. Work phase wp3; class C4, spec satisfaction.
Goal: load the released policy from official complete-copy plugin installs.
Non-goals: source-checkout rewrites, symlink dogfooding, app termination/restart,
provider changes, new-host rollout, unrelated plugin updates.
Authority/resources/escalation/terminal rules: 000; no numeric cost cap, bounded
commands <=60s per observation. Main owns installation; read-only child validates.

## Existing target inventory and exact intended changes

Re-verify each target before writes. Dated sources:
260906_release_0_2_18/012_release_preparation.md and
260905_codex_code_mode_pr_research/072_release_preparation_evidence.md.
- Local /Users/jun/.codex: enabled codexclaw@codexclaw at 0.2.16; marketplace
  references dirty /Users/jun/Developer/new/700_projects/codexclaw. Preserve checkout.
- macmini-cf /Users/junny/.codex: recorded 0.2.17 local-source install.
- suji /Users/neuralarcadepro/.codex: recorded 0.2.17 Git-source install.
- desktop-c795oh4 C:\Users\user\.codex: recorded 0.2.17 native Windows Git install.
Other aliases alone are not installation targets; do not bootstrap unknown hosts.

For each confirmed target: record plugin key/source, version and resolved cache path;
retain the old payload and nonsecret connection metadata for rollback. Official target
is codexclaw@codexclaw from https://github.com/lidge-jun/codexclaw at the release SHA.
For a matching existing Git source, marketplace upgrade then plugin add --json; verify
its revision, not just version. For a dirty local-source connection or mismatched pin,
use supported marketplace remove/add for only the codexclaw marketplace, preserving
other marketplaces/plugins, then add the official Git source with --ref <release SHA>.
No edit to the original checkout, no cache symlink, no manual payload overlay.
This source change implements the user's explicit request for the official path.
If the CLI cannot scope that change without damaging an unrelated connection, stop
that target and report the concrete issue; continue independent installations.

## Supported commands and evidence

Read codex plugin marketplace/add help on each installed CLI before mutation.
Expected flow: codex plugin marketplace upgrade codexclaw; codex plugin add
codexclaw@codexclaw --json. Pinned-source replacement uses marketplace remove
codexclaw then marketplace add https://github.com/lidge-jun/codexclaw --ref <SHA>.
Resolve installedPath/path from installer JSON. Invoke its bin/cxc.mjs directly:
hooks retrust --key codexclaw@codexclaw --codex-home <existing home>
only when existing trust, fresh hook digest comparison and normal procedure allow it;
never pass --bootstrap-ok to establish first-time trust under an update request.
If existing trust is missing, preserve the installed files and report the required
normal user hook review rather than initializing trust silently;
then doctor --json. Keep outputs under .codexclaw/evidence/quiet-peers.

Verifier: installed manifest matches released build version, complete non-symlinked
payload, hashes of the six changed payload guidance files match the published archive;
verify the two structure/ files against the immutable release source SHA,
compiled dispatcher loads, doctor manifest/hooks/hook-trust/install-root checks and
all other failures are inspected. Plugin installation must report the expected key
and path under the intended home; use native Windows CLI there, never a WSL surrogate.
A current session can retain old instructions; do not claim it hot-reloaded. Preserve
live sessions and report that a new task/app reload is needed if current UI is stale.

Stop: all established reachable targets have verified official installs; unreachable
or externally blocked targets are explicit unmet criteria, never silently dropped.
Rollback: reinstall the recorded old immutable source or preserved official payload
through supported CLI, restore only this marketplace connection if needed. Do not
reset repository branches or kill the running app to make verification pass.
