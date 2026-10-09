---
name: cxc-pabcd
description: "Use for Plan-Audit-Build-Check-Done work. Triggers: PABCD, plan this, 기획, 단계별로, 요구사항 정리."
metadata:
  last-verified: "2026-07-02"
  short-description: "Codex-native PABCD loop (Interview/Plan/Audit/Build/Check/Done) with class-scaled depth."
---

# PABCD Workflow

PABCD keeps session state and a transition ledger. Before state control, read [Phase control](references/phase-control.md) for commands, bindings, artifacts, attestations and state files (SESSION-IDENTITY-01, ORCH-ARTIFACT-01, ATTEST-SHAPE-01).

## Intent boundary

Loading grants no execution authority; explicit limits win. [cxc-dev](../dev/SKILL.md) owns class, fast path, reading, proof and safety; [cxc-loop](../loop/SKILL.md) owns HOTL activation.

## How It Works

```text
IDLE -> P -> A -> B -> C -> D -> IDLE
         any phase -> I -> P
```

I preserves plan/audit context and needs HITL with no active goal. Interactive P/A/B pause for confirmation; C/D proceed after their work. Goal-mode cycles explicitly enter P through phase control.

## Phases

Read the mandatory owner before its work.

| Phase / trigger | Work and mandatory owner |
|---|---|
| I | Clarify requirements: [cxc-interview](../interview/SKILL.md). Hints do not enter phases. |
| P, including plan-only | Explore and plan without implementation: [Plan phase](references/phase-plan.md) owns consultation, dependency order (PHASE-SPLIT-01), scope and verifiers. C2+ reads [Plan output](references/plan-output.md). |
| A, if authorized | Audit, resolve/rebut blockers and re-audit to pass/justified near-pass: [Audit phase](references/phase-audit.md). |
| B | Implement audited scope, verify and surface deviations; cxc-dev owns git (DEV-GIT-COMMIT-01, DEV-GIT-PUSH-01); declared stacks read [Stacked PRs](../dev/references/stacked-prs.md) (DEV-STACK-02). |
| C | Fresh relevant proof and source-of-truth sync: [Check phase](references/phase-check.md). |
| D | Record conclusion, changes and evidence; update STATUS/devlog, apply cxc-dev git rules, resolve this work-phase's pending work and close to IDLE. Read [Reader documents](../dev/references/reader-documents.md) (READER-DOC-02/04). |
| P/A defining render/conditional checks | Read Check phase above for reachable activation and observable evidence. |

LOOP-PESSIMIST-01 (DEFAULT): for loop/multi-pass D, record what did not improve, which hypothesis died and what evidence would refute the direction.

## Work-Phase Loop (multi-pass tasks)

A work-phase is an outcome slice; a PABCD phase is one letter. Perform a full P→A→B→C→D cycle per work-phase, close D to IDLE, then start next P. Never batch work-phases' B steps or close directly from B. A transition is not its artifact; real loops cannot skip phases. cxc-dev owns C0/C1 exceptions.

Continuation, new units (LOOP-UNIT-CHAIN-01) and previous-D handoff (LOOP-CONTINUITY-01) follow cxc-loop. PLAN-TRACK-01 (DEFAULT): when available, mirror progress in native update_plan; the durable plan remains authoritative.

### Implementation-Unit Documents

Before C2+ unit planning or multi-phase roadmaps, read [Implementation units](references/implementation-units.md) (DIFFLEVEL-ROADMAP-01, LEXICO-SPLIT-01, UNIT-RESIDENCE-01); cxc-loop owns docs-first entry.

## PABCD Depth by Work Class

cxc-dev owns class definitions and tie-breaks. PABCD depth per class:

| Class | Plan (P) | Audit (A) | Build (B) | Check (C) | Record (D) |
|---|---|---|---|---|---|
| C0-C1 | None/inline | Optional | Direct fix | Smallest proof | cxc-dev: C0 exempt; C1 only in an existing owning unit |
| C2 | Compact | Micro-audit | Implement + focused tests | Targeted gate | Summary |
| C3 | Compact/full by persistence/risk | Required for public contract, architecture, persistence or cross-session risk; otherwise focused | Implement; reviewer when useful | Affected suites + contract docs consistency | Summary + evidence; durable if state must persist |
| C4 | Full, mandatory | Independent reviewer required | Implement + independent verification | Full relevant gates | Durable risk/approval/evidence |
| C5 | Interview/research first | — | — | — | Reclassify before implementation |

## Delegation model — choosing a surface

Before dispatch, read [Dispatch surfaces](references/dispatch-surfaces.md) for leaf/task isolation and grants, then [Delegation](references/delegation.md) for subagents. cxc-dev owns skill attachments and peer contact; explicit limits win.

## Loop Engineering (§11)

Repeated repairs, reviewer FAIL or archetype selection read [Loop engineering](references/loop-engineering.md) (LOOP-REPAIR-01, LOOP-DOOM-01, REVIEW-SYNTHESIS-01). Optimization/comparison/plateaus also read [Optimization](references/optimization.md). Composition, response projection and computation read [Native execution](../dev/references/native-execution.md).

## Catalog Discovery routing

Interview sub-modes and option discovery follow cxc-interview (INTERVIEW-CATALOG-01, CATALOG-DESIGN-FIRST-01); the option ontology is [Catalog schema](references/catalog-discovery.yaml).

## Repository Root

Resolve the actual target repository root before planning and resolve relative source/test paths against it; clarify an ambiguous root before proceeding.
