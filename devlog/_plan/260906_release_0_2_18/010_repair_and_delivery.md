# Exact change map and verification

## PR69 PostCompact repair

MODIFY components/cxc-ops/src/map-affordance.ts (under plugins/codexclaw):
replace unsupported PostCompact context output with an empty-output enqueue of a
per-session recovery marker. Identity comes from valid absolute cwd and session_id
in native hook stdin; missing/malformed/child payloads stay silent. Check agent_id
AND agent_type before BOTH enqueue and consume: children can share the parent's
session_id and must never unlink its marker. Hash session_id
for the marker name. Marker belongs to .codexclaw/affordance-recovery, never the
PABCD state, goalplan or native DB. Reject symlinked state/recovery directories.
Use exclusive marker creation to coalesce compactions; no secret/question content.
Add a UserPromptSubmit consumer: remove the matching marker once, then emit the
existing compact affordance subset plus questions using the supported event.
No marker means no output and no repeated per-turn prompt. Failed IO is silent
best-effort hint delivery, not a permission failure or a success claim.

MODIFY components/cxc-ops/src/cli.ts: pass actual stdin to post-compact and route
hook user-prompt-submit to the consumer. Keep existing doctor/retrust paths.
MODIFY hooks/post-compact-injecting-bg-terminal-affordance.json: add UserPromptSubmit
and the bounded consumer to this already-registered file, preserving PABCD's
separate trigger hook identity. Change compact status wording to queuing recovery.
This adds one event/command path, not a plugin manifest hook-file entry; actual
trusted-hook counts must be measured rather than assumed to stay23.
MODIFY cxc-ops/src/reset.ts and its tests so explicit --state removes the recovery
directory as other state. No reset is run against real user installations.
MODIFY corresponding tracked dist JS through the existing remote build only.

MODIFY components/cxc-ops/test/map-affordance.test.ts: replace false PostCompact
additionalContext assertions with two-event lifecycle proof; confirm empty compact
output, once-only prompt context, no state/phase mutation, main/child and malformed
identity behavior, distinct session/workspace isolation, symlink refusal, and
actual compiled CLI/hook wiring. Existing protection/Interview tests stay intact.
MODIFY skills/dev/references/async-questions.md and related PR69 devlog/SOT claims:
describe next eligible UserPromptSubmit recovery, not immediate PostCompact
delivery. No pretend model-observed delivery from stdout-only tests.
Do not claim same-turn/HOTL Stop recovery before a UserPromptSubmit arrives.
At integration, keep both ownership rows and number native execution SOT as2.3
after async questions2.2; do not drop a route to resolve the overlap.
No new framework/runtime/dependency; marker is a scoped local hint, not a safety gate.

## Integration and release

Resolve shared dev/loop/ownership/SOT changes by keeping both routes. Preserve all
old modular references and same permission decisions. On release prep, change
root package.json, lock workspace versions, CLI, GUI and eight component versions
to0.2.18; change plugin manifest base then use canonical cachebuster helper. The
independent docs-site0.0.1 version stays unchanged. Generate inventory/counts only
from measured combined tests. No dependency resolution changes without evidence.

Verifier commands: focused node --test map-affordance and goal-gate tests on
macmini; npm test, npm run build, gate.mjs, inventory.mjs --check --tests <measured>,
check-versions.mjs0.2.18 and compiled-tree diff; CI exact head and normal Release.
New negative cases must fail against the old PostCompact implementation before
claiming regression proof. No local product suite/build/typecheck.

Deployment: adapt the previously reviewed host-local installer to the verified
0.2.18 version/manifest; re-audit the narrow version delta. Expected inventory is
made by comparing frozen Git payload and downloaded published payload. Installation
must use pinned source, a new backup directory, existing market identity and native
CLI. Keep prior backups and all uncertain-outcome failures; never auto-retry an
external write after a timeout without examining the recorded process/exit state.
New version compatibility and normal hook-trust checks are mandatory per target.
Source-linked caches get required-file/link proof and explicit extra-cache limits,
not false complete-tree equality. Current native CLI identity is checked per host.
