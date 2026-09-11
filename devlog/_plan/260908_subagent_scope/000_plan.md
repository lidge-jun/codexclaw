# Subagent effort persistence and scoped defaults (C3)

## Outcome and compatibility
Fix cxc serve dropping effort. Add role-level project > global > session inheritance.
Global file: $CODEX_HOME/codexclaw/subagents.json (default ~/.codex/codexclaw/subagents.json).
A present project role keeps its existing entire configuration, including null effort meaning parent-session effort. Removing a role via inherit:true returns it to the next scope. No migration or changes to real user settings.

## Diff contract
- store.ts: optional scope (project default), sparse persisted roles, effective readConfig, separate readSettings returning additive scope/sources metadata. setRole accepts scope, resetRole removes scoped role. Preserve unrelated raw data. Global resolution is also used when tracked project config fails its existing trust-token check.
- Shared settings API helper validates role, scope, reset and effort before any write. Bridge and Vite handlers call the same helper. GET scope query and POST scope field default to project; responses include roles, scope, sources. Existing request shapes remain accepted.
- CLI get/set support --global; reset supports role and --global. MCP get/set scope and inherit boolean mirror the API.
- GUI scope selector, actual value source, explicit role reset, session inheritance labels. Prevent save/load races. Preserve current visual language.
- Generated dist rebuilt through existing build script. Add user documentation at existing subagent docs location.

## Work split
Main owns store, shared API, bridge/Vite handlers and persistence/trust tests. Worker owns GUI page/client and UI tests. CLI/MCP follow core store contract. Reviewer audits plan and final diff independently. No overlapping write sets.

## Verification
First demonstrate existing effort failure (red.log). Child-process HTTP tests cover all efforts, omitted field, null, bad values rejecting atomically, persisted reads after process restart and preserved models. Add global fallback, project precedence, reset, global independence, invalid scope, and tracked-project trust coverage using isolated CODEX_HOME. GUI build/typecheck and behavior tests, existing component suites, build and repository gate. Runtime spawn resolution tested without paid inference. Actual Lina settings untouched. No deployment or process takeover.

## Audit disposition
Reviewer PASS conditional on sparse compatibility tests, common trust resolution, and one global path helper. Accepted: legacy three-default-role shadowing test, sparse-role fallback test, shared effective readSettings/spawn resolver with trustWarning and source metadata, hook payload regression. Add `overrides` booleans so the UI can remove a present but untrusted project role. Edits merge the saved scoped role when present, preserving its model even if runtime ignores it.
Rebuttal: rejecting nonexistent CODEX_HOME is unnecessary and prevents first-use setup. The host-controlled global root is created on explicit global write, matching current project-store behavior; browser input cannot choose arbitrary paths. Test automatic creation inside an isolated environment. HTTP global mutation uses existing loopback/Host/JSON/local-header checks (C4 boundary care within C3 feature).
