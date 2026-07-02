---
name: cxc-orchestrate
description: "Use for explicit Codexclaw IPABCD phase control from chat: cxc-orchestrate, $cxc-orchestrate, $codexclaw:cxc-orchestrate, orchestrate I/P/A/B/C/D/status/reset, phase status, reset, and human-vs-agent transition semantics. Triggers: orchestrate, phase control, PABCD state, cxc orchestrate, reset phase, status phase."
metadata:
  last-verified: "2026-07-02"
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
- Agent/terminal path is the live `cxc orchestrate` CLI and is attest-gated:
  forward edges (P>A, A>B, B>C, C>D) require `--attest` evidence.
- `D` is a closing action that returns to `IDLE`; it is not a resting badge.
- `status` is read-only.
- `reset` is an explicit control action, not a normal phase edge.

## Per-phase artifact obligation (ORCH-ARTIFACT-01)

Advancing a phase is not the same as doing it (see `pabcd` faithful-execution). Each forward
edge must carry its real artifact, not just an `--attest` string: P = the actual diff-level plan;
A = an audit/review verdict that names blockers (`A>B` attest requires a non-empty
`auditOutput` — the pasted tail of the dispatched reviewer subagent's verdict); B = the
implementation delta; C = fresh `tsc`/test/gate output (`C>D` attest requires a non-empty
`checkOutput`; `exitCode` is optional but, if supplied, must be `0`); D = a cycle summary with
evidence and the next-phase decision. A phase whose artifact is absent is not done, regardless
of adjacency.

## Control surfaces (shipped)

- **Chat (human free-pass)** — the hook parses a line-anchored `orchestrate <verb>`
  and drives the FSM (`transition` + ledger). Forward edges advance without `--attest`
  because the human asserts the phase is done; illegal adjacency is still refused.
- **Terminal (agent-gated)** — `cxc orchestrate <verb> [--attest <json>] [--session <id>]
  [--cwd <path>] [--json]` drives the SAME `.codexclaw/sessions/<id>.json` state through
  the un-weakened gated `transition()`. An agent MUST supply real `--attest` evidence to
  advance; `A>B` additionally needs `auditOutput` (reviewer verdict tail) and `C>D`
  additionally needs `checkOutput` + a passing `exitCode`.
- **Phase footer** — every injected directive ends with `IPABCD: <phase> (<LABEL>)` so
  the current phase is visible (codex has no status UI). After `D` closes, the resting
  state shown is `IDLE`.
- The invocation source is the discriminator (codexclaw has no boss token): chat =
  human free-pass, CLI/tool = agent-gated.
