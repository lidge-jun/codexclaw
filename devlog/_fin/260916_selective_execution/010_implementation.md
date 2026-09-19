# Architect and recovery consolidation

The final change strengthens formal-P architect consultation while keeping CXC's
existing delegation-selection rules. It preserves the transport and recovery
fixes from #177 and #179 without introducing an executor-first or main-direct
implementation default.

## Changes and provenance

Credits: thisisjun786, original contributions in #177 and #179.

The canonical dev skill is restored byte-for-byte to upstream 03541398. Added
implementation ownership sections and P/B ownership hints are removed. Formal P
retains proposal, main plan and same-architect reflection before independent audit;
the CLI repeats that sequence only at P entry. Existing fast paths, explicit
limits, DISPATCH-ECONOMY-01 and B guidance keep their original roles.

The complete subagent-config component and the waiting/delegation recovery
references retain the reviewed combined implementation. Recovery requires the
registered stopped child and reconciliation; cancellation and permission failures
still stop. Ciphertext shape recognition preserves opaque native messages and
reports omitted prompt instructions without claiming authentication.

## Verification

Fresh checks on the corrected revision:

- Independent review: PASS, no blockers. Baseline comparisons confirm the original
  dev skill, B guidance and DISPATCH-ECONOMY-01; recovery/ciphertext files are unchanged.
- Phase hook/CLI suite: 185 pass, zero failures.
- `npm run build`: exit 0, 181 compiled files.
- `TMPDIR=<isolated directory> CODEXCLAW_SKIP_REPOMAP_SMOKE=1 npm test`:
  exit 0, 3177 total, 3103 pass, 74 conditional skips, zero failures.
- `npm run gate`, `inventory.mjs --check --tests 3177` and `git diff --check`: pass.
- Compiled CLI/hook QA: five real invocations each on source and installation
  check architect output at P and unchanged B instructions/phase behavior.
- Installed recovery QA: 35 CLI invocations pass, including stopped-child
  recovery, live/unknown reconciliation, evidence limits and stop precedence.
- Nine changed installed files pass pre-write drift checks. The installed dev
  skill matches upstream bytes. Patch reverse/reapply matches before/after copies.

These checks use isolated fixtures and spawn no live provider or worker.
Agent-followed policy remains a semantic-review obligation. Raw logs, review
receipts and patch proofs remain in the private correction backup.

## Delivery

#180 supersedes closed #177 and #179. Original branches are preserved. #178 tracks
the retained recovery work and stays open until upstream integration. Source and
installation updates are separate from upstream merge or release.
