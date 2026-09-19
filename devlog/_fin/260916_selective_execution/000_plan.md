# Architect consultation with existing delegation policy

Formal-P architect consultation needs a concrete proposal, a main-owned executable
plan and reflection by the same architect before independent review. Consolidate
the architect and recovery fixes from #177 and #179 while preserving CXC's
existing delegation-selection policy. Neither executor-first nor main-direct
implementation becomes a new default.

## Scope

Class: C3 compact policy/hint integration. No new delegation-selection rule,
runtime gate, dependency or model setting. Preserve reviewed ciphertext handling
and task failure recovery. Main applies the bounded correction; independent
review checks the changed instructions and emitted output.

- Restore `plugins/codexclaw/skills/dev/SKILL.md` exactly to upstream 03541398.
- Remove added implementation-ownership sections from P plan output, B guidance
  and structure mirrors. Existing DISPATCH-ECONOMY-01 remains the selection owner.
- Keep formal-P consultation records and P/A hook reminders. CLI P entry repeats
  only the architect sequence; B returns to its original instructions/output.
- Keep ciphertext preservation from #177 and retirement/task-failure recovery
  from #179. Their existing managed-dispatch bounds and stop precedence remain.
- Update hook/CLI assertions to cover architect output, unchanged phase state and
  absence of the added implementation-default instructions.
- Align PR/issue descriptions, local source, installed files and reapply patches.

## Acceptance

1. No new executor-first or main-direct default remains in active policy.
2. The canonical dev skill equals upstream bytes; existing delegation criteria
   and build-phase instructions remain unchanged.
3. Formal P requires architect proposal, main plan and same-architect reflection
   before independent audit, subject to existing fast paths and explicit limits.
4. #179's evidence-based retirement and reconciled task-failure recovery remain.
5. Source/dist, affected tests, build, full suite, gate/inventory, independent
   review and installed CLI/hook checks agree.
6. One ordinary PR targets dev. #177 and #179 are superseded without deleting their
   branches; #178 stays open until upstream integration.
7. Local and installed corrections have drift checks, backups and verified patches.
   No upstream merge, release or model-setting change is authorized here.

## Review context

The initial architect proposal and reflection established the retained
consultation/transport/recovery boundaries. A later clarification withdraws the
added implementation-default policy and restores the upstream selection rules.
This correction adds no new architecture decision; it removes the unsupported
policy extension. The earlier reviews do not certify the corrected diff: a fresh
independent review and checks cover delivery. Private receipts retain both
revisions without presenting the withdrawn plan as current behavior.
