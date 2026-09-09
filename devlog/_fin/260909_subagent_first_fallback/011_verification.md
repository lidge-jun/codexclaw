# Verification and delivery

Code checkpoints: `93c02c6` (feature), `83b06c4` (hook inventory and entrypoint repair). This final documentation archive does not change implementation files.

- Build: `npm run build`, 166 runtime files compiled; layout validated, exit 0.
- GUI: workspace Vite build and strict GUI tsc, exit 0. Targeted strict NodeNext tsc on dispatch, CLI, MCP and spawn hook, exit 0.
- Final relevant suites: 355 tests, 355 pass, 0 fail, 0 skipped at `83b06c4`. Includes subagent-config, all GUI tests, dist freshness, manifest policy, packaging, CLI usage, inventory, gate and hook-e2e. This is not the whole-repository suite.
- Final independent reviewer: PASS; separately ran 58 repair-focused tests, all passed.
- Real local browser/API: all three roles save and retain independent fallback effort; duplicate model rejection preserves values; project clearing and global inheritance restoration pass. Screenshots inspected at 1440, 768, 390 and 320px; no horizontal overflow or page errors. Existing controls and focus styling reused.
- Real compiled CLI with synthetic outcome reports: xai/grok-4.6 -> cursor/grok-4.6 -> main-direct. No native/provider inference calls were made by this probe. Unit tests also exercise ambiguous creation, stopped-child reconciliation, marker replay, no-tool-ID hosts, restart and config snapshots.
- Main and child models were used for ordinary implementation/review delegation; no additional paid-provider failure/quota probes were performed.

Evidence is under `.codexclaw/evidence/01a08476-5f10-75c1-bc04-81ab5318553f/`: test-receipt.json binds the final code; qa-receipt.json and qa/ hold browser images, actions, CLI trace and teardown. GUI/CLI observations at `93c02c6` remain applicable because the followup changes only inventory, hook entrypoint argv, its tests and documentation. The new hook argv itself was re-tested at `83b06c4`.

Environment diagnosis: first unisolated component run saw user global settings (11 failures); isolated CODEXCLAW_HOME removed that contamination. Extended GUI tests then saw a pre-existing `/tmp/.git` (four fixture failures); TMPDIR=/var/tmp/cxc-first-fallback-tests removed that unrelated ancestor without deleting it or changing tests. Final tests used both isolated paths.

Owned Vite PID 340728 / terminal 90158 was terminated; port 17944 has no listener. Browser contexts and CLI child processes exited. Only local fixture/evidence files and workspace dependencies remain.

The managed protocol is main-followed: CXC makes deterministic candidate/attempt decisions while the main invokes native spawn/wait. Direct unmanaged calls are not automatically retried. Unknown host error prose remains unclassified, and requested models are not proof of OCX's actual downstream route. Independent-review requirements survive main-direct exhaustion. Installed plugin and global model settings were not modified; no push, PR, merge or release occurred.
