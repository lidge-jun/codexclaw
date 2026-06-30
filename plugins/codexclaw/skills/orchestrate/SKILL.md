---
name: cxc-orchestrate
description: "Use for explicit Codexclaw IPABCD phase control from chat: cxc-orchestrate, $cxc-orchestrate, $codexclaw:cxc-orchestrate, orchestrate I/P/A/B/C/D/status/reset, phase status, reset, and human-vs-agent transition semantics. Triggers: orchestrate, phase control, PABCD state, cxc orchestrate, reset phase, status phase."
metadata:
  short-description: "Explicit IPABCD phase-control surface."
---

# cxc-orchestrate

Use this skill when the user wants to inspect or drive Codexclaw's IPABCD phase.

## Chat Surface

The chat command grammar is:

```text
orchestrate <I|P|A|B|C|D|status|reset> [--attest <json>]
```

Accepted prefixes include `$codexclaw:cxc-orchestrate`, `$cxc-orchestrate`,
`cxc orchestrate`, `/orchestrate`, and bare `orchestrate`.

## Semantics

- Chat-submitted commands are the human path.
- Human path can advance legal adjacent phases without attestation.
- Agent/terminal path is planned as `cxc orchestrate` and remains attest-gated.
- `D` is a closing action that returns to `IDLE`; it is not a resting badge.
- `status` is read-only.
- `reset` is an explicit control action, not a normal phase edge.

## Runtime Status

Chat-side parsing and state wiring are part of the L3 hardening track. The
terminal `cxc orchestrate` command is tracked separately in L4.
