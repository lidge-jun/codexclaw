# Local verification — 2026-09-08

Implementation complete; PR, push, installation and release are outside this delivery.

| Contract | Evidence | Result |
| --- | --- | --- |
| Effort persistence and validation | Existing real serve regression suite; browser POST/GET/restart, null and invalid request without file mutation | Pass |
| Global home and migration | global-home tests: explicit CXC home, legacy read, set/reset migration, unknown fields and other roles preserved | Pass |
| Project precedence and independence | scopes and scoped-surfaces tests: two project paths, global update, explicit null, CLI/MCP persistence, trust guard | Pass |
| Live catalog | Patched serve API compared with read-only `ocx models live --json`: all 19 enabled IDs match, disabled/pending absent | Pass |
| Conditional catalog paths | live-catalog tests: TTL, force refresh, coalescing, cross-process reuse, empty roster, malformed/error/stale, native configured path, actual 12-second timeout and output limit | Pass |
| User interface | Built GUI on actual serve: separate Global Settings route, main/global/direct dropdown, inherited controls disabled, refresh/stale display, rejected save and failed load/retry, model effort restriction, ignored project controls | Pass |
| Rendering | Personally inspected 1280x960 global and 390x844 subagent screenshots; no horizontal overflow or page errors | Pass |
| Packaging | Rebuilt tracked runtime; force-tracked new live-catalog and win-exec dist modules; inventory gate | Pass |
| Automated checks | Full suite: 2692 tests, 2622 pass, 70 conditional skips, 0 failures; GUI and changed core strict TypeScript; component and GUI builds | Pass |
| Operator settings | SHA256/existence comparison of Lina role settings, both global preference locations and Codex config | Unchanged |

Artifacts: `/home/jun/tmp/cxc-global-settings-01a07d17/` contains full-tests.log, browser.log, browser-smoke.mjs, build.log, gui-build.log, gate.log, tsc-gui.log, tsc-core.log and screenshots. Test child servers and disposable browser projects were stopped/removed in finally blocks. The suite runner now creates an isolated CXC home, preventing catalog cache writes to the operator home during npm test.

Independent review found three blockers: ignored new dist modules, two obsolete allowlist assertions, and live catalog access in formatting tests. All fixed; formatting tests now inject the roster, and npm test isolates CXC state. Final independent verdict PASS: reviewer reran 54 neighboring tests in isolation, all passed, and verified the operator cache timestamp remained unchanged. Review-only unisolated probing had created `~/.codexclaw/model-catalog.json` (derived catalog cache, no preferences); it is not deleted because other sessions may use it.

Model capability restrictions are UI-only; CLI/MCP retain the existing wire effort validation. Provider inference and next subagent-turn routing were not exercised. Shared catalog cache identity includes PATH; differing service environments may refresh separately, and a discovery outage retries on the next poll. These optimization limits do not alter saved choices.

Task-owned preview: http://127.0.0.1:37235/#/settings, execution handle 12300; project `/home/jun/tmp/cxc-global-settings-01a07d17/preview/project`, CXC home sibling `preview/cxc`. It uses a copy of Lina's role preferences and reads the real OCX catalog. Original installed plugin and prior preview were not replaced.

Workflow source evidence is explicit local paths. The native session cwd `/home/jun/tmp` is not a Git repository; the FSM has no bound source identity or goalplan test receipt. No such proof is claimed.

## Pre-PR recheck

User authorized PR publication after another complete check. Fresh full suite again measured 2692 total / 2622 pass / 70 conditional skips / 0 failures. Rebuilt component and GUI bundles; GUI and changed-core strict typechecks, Linux platform smoke and repeated real serve/browser acceptance passed. CI also checks the measured suite count: corrected the three README badges from 2670 to 2692 with the repository inventory generator, then verified `inventory.mjs --check --tests 2692` and gate. No behavior changes were needed for these checks. Upstream contribution target is `dev` (6d70ef4), confirmed by remote refs and the repository target-enforcement workflow. Evidence is in the existing artifact directory's `pr-check/` folder.
