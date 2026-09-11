# Source evidence and settled requirements

- Handoff: /home/jun/tmp/cxc-architect-handoff.nnzEDx/task.md; explicit local implementation/commits, no install/publication.
- `plugins/codexclaw/components/subagent-config/src/store.ts:20`: ROLES canonical enum; :56 defaults; :140 readSettings merges roles; :209 setRole preserves raw sibling fields; :224 resetRole removes only selected override. Reads do not migrate.
- `plugins/codexclaw/components/subagent-config/src/dispatch-contract.ts:38`: duplicate role union and :82 runtime parser need fourth role.
- `plugins/codexclaw/components/subagent-config/src/spawn-wrapper.ts:25`: role-to-built-in mapping; :81 role baseline skills; role TOML is prompt source, not native registration.
- `plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:440`: worker special case then keyword reviewer inference currently loses explicit custom roles.
- `plugins/codexclaw/gui/src/api.ts:25`: wire union and :327 scoped response validation; settings page :10 and Dashboard :28 enumerate roles.
- `structure/00_philosophy.md`: append/deny only, no runtime fork/server/provider mutation, main owns goals, prompts differ from registered agents. Preserve this file.
- `structure/20_pabcd_dispatch_doctrine.md`: explicit phases, independent audit, main ownership, reuse within context and failure retirement; extend existing operating doctrine only.
- `package.json`: test runner owns isolated CODEXCLAW_HOME. Baseline store+dispatch tests executed: 34 passed, zero failed; /home/jun/tmp/cxc-architect-handoff.nnzEDx/baseline-tests.log. Direct test arguments observe both target modules. Full build/gate/UI verification not run yet; must run before implementation completion. No dependencies in this worktree initially.
- Source map helper unavailable from installed entry (repo-checkout-only error); used scoped rg for ROLES, RoleName, inferRole, existing role values and direct consumers instead.

## Requirements

Main gathers source/requirements -> architect proposes design -> main writes files/order/acceptance -> same architect checks reflection -> independent A reviewer. Reinvoke only for named changes in module responsibility, data structure, interface or execution flow. New plan means new architect context. Same-plan reuse is a context property, not a cost guarantee. Failure never authorizes model substitution, permission bypass, or treating main self-review as architect/independent approval.

## Threat model

Assets: operator role settings, configured model selection and native write permission. Entrypoints: role CLI/MCP/settings JSON and spawn message/agent_type. Boundaries: untrusted stored config and caller text -> typed routing, browser -> loopback API. Hostile task text could include a role marker; therefore a marker selects only the read-only architect route and cannot override an explicit executor/worker or reviewer role. It grants no tools/permissions, suppresses no leaf guard and never trusts Git-tracked config. Existing validation, explicit-field precedence, fork checks and recursive-spawn denial remain and are exercised by affected suites. No secrets or new credentials are required.

## Audit dispatch tracking

Reviewer 01a082a5-6041-7e12-8c97-be00d4dd9136 was retired by main after repeated empty completion waits; subsequent read-only task inspection showed active source reads and commentary, so this is an interrupted review, not evidence of provider failure. No verdict was received or counted. Replacement reviewer 01a082ab-3488-74e2-b6de-337fe2851229 is inspecting the roadmap. Future waits distinguish progress commentary from a completed verdict.
