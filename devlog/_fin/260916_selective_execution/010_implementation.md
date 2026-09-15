# Selective execution implementation

The owning implementation task now works directly by default. Optional executor
assignments have a scope and check, while formal-P architect consultation and
independent review retain their existing requirements. Choosing direct work does
not bypass recovery for a previously dispatched child.

## Changes and provenance

The consolidated implementation carries the reviewed union of #177 and #179
(19afc764, upstream base 03541398). Relative to that union, 13 files change:
implementation policy, P/B hook and CLI hints, their output assertions, the public
subagent guide, changelog and structure mirrors. The complete subagent-config
component and the waiting, delegation and formal-P consultation references remain
byte-identical. This withdraws executor-first wording without dropping ciphertext
preservation or reconciled task failure recovery. No dependency or runtime gate
was added.

Credits: thisisjun786, original contributions in #177 and #179.

## Verification

- Architect proposal and same-architect reflection: ALIGNED against plan e9c4484d.
  Separate plan audit: PASS. Fresh implementation review: PASS, no blockers.
- Phase hook/CLI suite: before hint changes, 185 tests with five expected failures
  for the old ownership instructions; after changes, 185 pass and zero fail.
  Existing phase-state and architect checks remain.
- `npm run build`: exit 0, 181 compiled files.
- `TMPDIR=<isolated directory> CODEXCLAW_SKIP_REPOMAP_SMOKE=1 npm test`:
  exit 0, 3177 total, 3103 pass, 74 conditional skips, zero failures.
- `npm run gate` and
  `node plugins/codexclaw/scripts/inventory.mjs --check --tests 3177`: pass.
- `git diff --check`: pass.
- Compiled CLI/hook QA: five real invocations on source and five on the updated
  installation verify P/B output and CLI phase state using isolated fixtures.
  The first QA fixture tried the illegal IDLE-to-B transition and was corrected
  to start at A; the rejection was expected product behavior.
- Installed recovery QA: 35 real CLI invocations pass, including stopped-child
  recovery, live/unknown-state reconciliation, input limits and stop precedence.
- Local source receives the 13-file delta; nine changed installed files are
  replaced after drift checks. Backups and source/install reapplication patches
  are retained privately. Installed patch reverse/reapply matches original/final
  bytes. These checks spawn no provider or live worker.

Raw logs, review receipts and installation manifests are retained in the private
consolidation backup dated 2026-09-16. Agent-followed policy still needs semantic
review; automated checks do not prove a model will always follow instructions.

## Delivery

Publish one ordinary PR targeting dev, superseding #177 and #179. Leave #178 open
until upstream integration and link its current criteria to the replacement.
Hosted CI and remote status are checked separately from the local evidence above.
No upstream merge or release is part of this unit.
