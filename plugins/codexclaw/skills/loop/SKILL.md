---
name: cxc-loop
description: "Use for PABCD completion loops. Triggers: cxc-loop, continue until done, HOTL, repeated PABCD, 루프 돌려, 끝까지 해줘, docs-first."
metadata:
  short-description: "Agent-led scoped completion with durable plans and evidence."
---

# cxc-loop — Scoped completion

## Intent before activation

Bare operative cxc-loop means scoped HOTL; explicit HITL keeps human P/A/B pauses. Loading, explanation and review activate nothing. Explicit limits win. HOTL adds persistence, never permissions; report missing authority.

A leaf follows its packet, owns no goal/FSM and needs a grant to spawn. Dispatched tasks own their goal/FSM within their packet's grant. Before dispatch, read [Dispatch surfaces](../pabcd/references/dispatch-surfaces.md) (DISPATCH-SURFACE-01).

Use [cxc-dev](../dev/SKILL.md) for safety, proof, complete selected reads, peer contact, async questions and installed-skill discovery. Select owners by task/class/risk/phase; preserve explicit-only and leaf-safe restrictions and resolve missing mandatory references before work.

## Read before the action

| Action | Owner |
|---|---|
| PABCD work or planning | [cxc-pabcd](../pabcd/SKILL.md) |
| HOTL entry, resumption or completion diagnosis | [Runtime lifecycle](references/runtime-lifecycle.md) |
| Goalplan schema, CLI or amendment | [Durable goalplan](references/durable-goalplan.md) |
| Multi-cycle roadmap | [Implementation units](../pabcd/references/implementation-units.md) |
| Repeated failure, reviewer FAIL or archetype selection | [Loop engineering](../pabcd/references/loop-engineering.md) |
| Score optimization, plateau or mechanism comparison | [Optimization](../pabcd/references/optimization.md) + loop engineering above |
| Candidate divergence | [Divergence tiers](references/divergence-tiers.md) |
| Task dispatch or lane observation | [Lane dispatch](references/lane-dispatch.md) |
| Authorized subagent dispatch | [Delegation](../pabcd/references/delegation.md) |
| Waiting on work or external processes | [Waiting](references/waiting.md) |
| Composition, response projection or in-context computation | [Native execution](../dev/references/native-execution.md) |

## Execution invariants

- ORCH-MANDATE-01 (STRICT): read persisted state before claiming loop entry/re-entry; binding and edges follow [Phase control](../pabcd/references/phase-control.md) (SESSION-IDENTITY-01).
- HOTL needs an ACTIVE host goal and in-flight cycle; HITL needs no goal. Missing capability/binding is a preflight failure, never armed continuation.
- Follow cxc-pabcd's one-work-phase/one-cycle invariant; hooks neither choose nor advance phases.
- LOOP-CONTINUE-01 (DEFAULT): after D or context loss, read the bound goalplan and ledger; preserve criteria and re-enter P while in-scope work remains under the active goal.
- LOOP-UNIT-CHAIN-01 (DEFAULT): add genuinely new in-scope units through a P amendment to the same goal.
- LOOP-CONTINUITY-01 (DEFAULT): next P quotes the previous D conclusion and direction, explains any change, and resumes from durable evidence.
- LOOP-GIT-01 (DEFAULT): before checkpoints or publication, apply cxc-dev's git rules; declared stacks also read [Stacked PRs](../dev/references/stacked-prs.md).

## Docs-first multi-cycle entry

LOOP-DOCS-FIRST-01 (DEFAULT): this entry is STRICT for HOTL. Two or more work-phases start with a goalplan skeleton and docs-only roadmap cycle. D locks the roadmap; implementation starts next cycle. Later P consumes/revalidates one prewritten decade doc. Scope discovered later pays this debt at next P. No production patches, deploys or implementation-complete claims in the roadmap cycle. Single-cycle work skips it; cxc-dev owns C0/C1 exceptions.

LOOP-READS-PABCD-01 (STRICT): before multi-cycle execution read implementation units above for roadmap contents/numbering; skeletons or empty decade docs do not satisfy it.

## Completion and recovery

Report DONE, NOOP, BLOCKED, UNSAFE, NEEDS_HUMAN or BUDGET_EXHAUSTED as outcomes, not FSM phases or host goal statuses. DONE requires cxc-dev's fresh proof and the runtime-lifecycle completion gate (GOAL-COMPLETE-GATE-01); never weaken criteria. Exhaustion requires an actual stated bound. Compaction, wait timeout and Stop release prove neither success nor exhaustion; preserve evidence and recover through the applicable owner.
