---
name: cxc-loop
description: "Use for Codexclaw autonomous work-loop planning: HOTL goal continuation, repeated PABCD work-phases, Stop-continuation policy, evidence checkpoints, and mode-guarded auto-advance. Triggers: cxc-loop, loop, autonomous continuation, continue until done, HOTL, repeated PABCD, work-phase loop."
metadata:
  short-description: "HOTL PABCD continuation loop contract."
---

# cxc-loop

Use this skill for autonomous Codexclaw work loops that span multiple PABCD
work-phases.

## Contract

- One work-phase maps to one full PABCD cycle.
- D closes the current work-phase and returns the phase to `IDLE`.
- If work remains and HOTL/goal/loop mode is active, the agent may start the next
  work-phase after evidence is recorded.
- Interview auto-advance is mode-guarded: the agent may move I -> P only when the
  exit gate passes in an explicit HOTL/goal/loop context.
- Stop guards should prevent premature termination only when concrete pending
  work remains.
- Goal mode is PABCD-only: while a goal is active the Interview NEVER fires (entry is
  suppressed and `request_user_input` is hard-denied). The Interview is HITL-only and
  runs only with no active goal; the Stop hook never drives the Interview.

## Stop-continuation (shipped, L6)

The continuation is enforced by the active Stop hook (`handleStop`), not just this
discipline doc. It returns `{"decision":"block","reason":...}` to keep the agent
advancing while a PABCD cycle is in flight under an ACTIVE goal. Termination is total
via:

- **Guard 1** — `stop_hook_active`: codex is already in a continuation → release.
- **Guard 2** — phase is `IDLE` / orchestration inactive / no active goal → release
  (a plain interactive session never enters the loop; it pauses for the human at P/A/B).
- **Context-pressure bail** — don't pile on during compaction recovery.
- **Stagnation cap** — a bounded `stopBlockCount` per phase; after `MAX_STOP_BLOCKS`
  consecutive blocks at the same phase with no transition, the loop releases so it can
  never trap a session. A real transition (chat or CLI) resets the counter, so each
  phase of a healthy P→A→B→C→D gets a fresh budget.
