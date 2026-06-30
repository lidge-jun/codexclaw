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

## Runtime Status

L12 provides this discoverable skill surface. Durable loop runtime, Stop
continuation, and checkpoint enforcement are tracked in later mvp_hard loops.
