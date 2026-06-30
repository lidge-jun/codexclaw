---
name: cxc-goalplan
description: "Use for Codexclaw durable goalplan design: goals, work phases, success criteria, checkpoints, steering decisions, quality gates, evidence bundles, and OPEN ASSUMPTIONS handoff from Interview. Triggers: cxc-goalplan, goalplan, goal plan, success criteria, checkpoint, steering, quality gate, evidence ledger."
metadata:
  short-description: "Durable goalplan and checkpoint contract."
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

## Goal state (how it arms the loop)

codexclaw does NOT own a goal store. Goal state lives in the host Codex
`goals_1.sqlite`; the `pabcd-state` goal-active gate reads it read-only to decide
HITL vs HOTL. An ACTIVE goal is what ARMS the L6 Stop-continuation loop: while a goal is
active and a PABCD cycle is in flight, the Stop hook keeps the agent self-advancing
(`cxc orchestrate <phase> --attest …`, agent-gated) until the cycle closes to IDLE, then
re-enters P for the next work-phase. Without an active goal, the loop never arms and
PABCD pauses for the human (HITL).

This skill is the goalplan DISCIPLINE: represent goals / work phases / success criteria /
checkpoints / evidence and carry Interview OPEN ASSUMPTIONS forward — it does not create a
new goal database.
