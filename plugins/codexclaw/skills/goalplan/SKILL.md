---
name: cxc-goalplan
description: "Use for Codexclaw durable goalplan design: goals, work phases, success criteria, checkpoints, steering decisions, quality gates, evidence bundles, and OPEN ASSUMPTIONS handoff from Interview. Triggers: cxc-goalplan, goalplan, goal plan, success criteria, checkpoint, steering, quality gate, evidence ledger."
metadata:
  short-description: "Durable goalplan and checkpoint contract."
  last-verified: "2026-07-02"
---

# cxc-goalplan

Use this skill when a Codexclaw task needs a durable goalplan instead of only a
chat-local checklist.

## Contract

- Represent goals, work phases, success criteria, checkpoints, and evidence.
- Carry Interview OPEN ASSUMPTIONS into Plan/Audit instead of dropping them.
- Record steering decisions with rationale and evidence.
- Reject steering that weakens completion criteria or verification.
- Require a quality gate before final completion.

## Shipped schema (what `cxc goalplan` actually persists)

This is not an abstract wish list — it is the on-disk shape under
`.codexclaw/goalplans/<slug>/goalplan.json` (+ `ledger.jsonl`). Fill these fields; do not
invent parallel ones:

- `objective`, `slug`, `createdAt`, `updatedAt`.
- `workPhases[]` — each `{ id, title, status: pending|in_progress|done, tasks[], criteriaIds[] }`;
  `tasks[]` are `{ id, title, status: pending|done }`; `activeWorkPhaseId` marks the current one.
- `criteria[]` — each `{ id, scenario, expectedEvidence, capturedEvidence, status: open|met }`.
  A criterion only reaches `met` when `capturedEvidence` is non-empty (fresh proof, not memory).
- `host` — `GoalplanHostLink { armed, armedAt, source: freeze|none }`. `armed` is provenance,
  intended to read true only after a freeze-boundary arm (the MAIN session created a host goal).
  No shipped CLI flips it automatically and codexclaw never writes the goal DB itself; treat it
  as the slot that records that boundary, not an auto-managed flag.

CLI surface: `cxc goalplan init --objective "<text>" [--session <id>]` writes the local artifact
(never the host goal DB); `cxc goalplan show` renders it; `cxc goalplan validate` is the E8
quality gate (FAIL unless the plan is complete AND every `met` criterion carries
`capturedEvidence`). Ledger events: `created`, `workphase_started`, `workphase_done`,
`task_done`, `criterion_met`, `host_armed`.

## Optimization-loop discipline (score/objective goalplans)

When the objective maximizes a score/metric against an evaluator, apply the plateau
discipline owned by `cxc-pabcd` (LOOP-PHASE-DEATH / LOOP-CONTINUITY / CANDIDATE-ANCHOR /
GATE-ORACLE-VALIDITY): track discarded candidates by killing phase + change class and
after N consecutive same-class deaths (start N=3, tune per domain) target the evaluation
gate itself; each new work phase quotes the previous conclusion from the ledger; source
candidates from domain-state evidence, not only existing parameters; an optimistic local
proxy is never sole acceptance evidence.

## Goal state (how it arms the loop)

codexclaw does NOT own a goal store. Goal state lives in the host Codex
`goals_1.sqlite`; the `pabcd-state` goal-active gate reads it read-only to decide
HITL vs HOTL. An ACTIVE goal is what ARMS the L6 Stop-continuation loop: while a goal is
active and a PABCD cycle is in flight, the Stop hook BLOCKS premature termination (it
returns `{decision:"block"}`) so the agent keeps self-advancing with explicit
`cxc orchestrate <phase> --attest …` commands (agent-gated). The hook does NOT transition
phases AUTONOMOUSLY and does NOT re-enter `P` itself — it only persists a transition in
response to an explicit chat `orchestrate <verb>` command (the agent acting). After the
agent closes a cycle to IDLE, the
AGENT runs `cxc orchestrate P` to start the next work-phase. Without an active goal, the
loop never arms and PABCD pauses for the human (HITL).

This skill is the goalplan DISCIPLINE: represent goals / work phases / success criteria /
checkpoints / evidence and carry Interview OPEN ASSUMPTIONS forward — it does not create a
new goal database.
