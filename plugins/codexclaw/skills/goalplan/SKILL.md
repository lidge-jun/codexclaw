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
