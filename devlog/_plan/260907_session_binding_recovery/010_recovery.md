# Explicit current-session recovery

Depends on000 investigation. One cohesive implementation slice, followed by020 delivery.
Reuse existing pabcd-state CLI dispatch and ensureState; no daemon or hook replay.
No-code/config-only fix is insufficient: current disk hooks are healthy, missing
state cannot be recovered by the existing CLI, and narrative-only identity can vanish.

NEW src/session-binding.ts in pabcd-state: current native identity from unmodified
CODEX_THREAD_ID (UUID shape), corroborated against highest numeric state_N.sqlite
under CODEX_SQLITE_HOME/CODEX_HOME/default. Read-only DB lookup by exact ID, require
nonarchived row and realpath cwd equality. Failure returns actionable nonzero result,
never selects latest session or scans transcripts. Do not claim security against
an actor controlling the same OS environment/database. This is accidental-collision
protection (CLI layer); deliberate file/env tampering bypasses it; final security
layer:none. No permission/trust/config writes.
NEW session-cli.ts: `cxc session current [--json]` reads identity/state availability;
`cxc session bind [--json]` explicitly exclusive-creates IDLE with ensureState.
No arbitrary --session argument. Reject symlink state paths, preserve existing bytes,
refuse corrupt/wrong-identity state. Return cwd, sessionId, identity source, created,
statePath and hooksVerified:false. Binding does not prove hooks ran or arm a goal.
MODIFY cli.ts + bin/codexclaw.mjs + plugins/codexclaw/bin/cxc.mjs: lazy-route session command and help.
MODIFY orchestrate-cli.ts status only: prefer validated native env ID over latest
when present; missing exact state must report missing, not fake IDLE. Plain terminal
fallback retained for compatibility and labelled when used. Writes remain explicit.
MODIFY hook.ts LOOP_ARM_DIRECTIVE, cxc-ops map-affordance.ts binding, loop/SKILL.md,
loop/runtime-lifecycle.md, pabcd/phase-control.md: fresh binding preferred; missing
line uses session current/bind only after successful native identity validation.
Never copy parent ID, synthesize hook payload, use cli as native substitute or claim
hook health from state alone. Source-of-truth docs-site/src/content/docs/reference/hooks.md updated.
REGENERATE affected component dist through existing build script.

Tests: real temp native SQLite, separate parent/child states; missing env, invalid UUID,
no db/row, archived, cwd mismatch, current missing file, readonly current no writes,
explicit bind create/repeat preservation, malformed file, symlink paths; invoke real
CLI entry for routing and exit codes. Status must not select newer foreign state.
Regression baseline captured before patch; broad suites only on remote CI.
No new persisted schema: new command output fields are transient CLI JSON.

## Audit fold-back
1. Inherited/conflicting/uncertain binding lines require `session current` validation,
not only a completely absent line. When native CODEX_THREAD_ID exists, agents must
corroborate every binding before mutation. A child root fork with a parent's text
must bind its own exact native ID; parent's state byte hash must stay unchanged.
2. Terminal latest-file fallback is eligible ONLY when CODEX_THREAD_ID is absent.
Any present invalid native ID, unavailable DB/row, schema failure or cwd mismatch
is nonzero with no fallback. A higher numeric schema failure never tries older DBs.
Test higher incompatible state_N.sqlite plus older valid DB and newer foreign FSM.
3. Reject native DB source objects containing subagent (including source JSON with
null agent_role); root SessionStart identity differs from child's concrete thread ID.
No changes to shared resolveSession used by hook consumers: preference is status-only.
4. Threat model: assets are per-session FSM/goal evidence; accidental inherited IDs,
malformed environment, stale DB and redirected state paths are inputs. Same-user
malicious modification of env/DB/files is outside this advisory ownership model.
5. Native SQL state supports only columns actually read; unsupported schemas fail
with a diagnosis, no auto migration or fallback. Current is read-only, bind is the
sole create path. Existing corrupt, wrong-ID or nonregular file is preserved/refused.
