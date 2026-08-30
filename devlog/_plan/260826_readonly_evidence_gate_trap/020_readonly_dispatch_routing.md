---
created: 2026-08-26
workPhase: wp3
---

# 020 — Read-only dispatch routing (D2), without a forgeable marker

Status: PLANNED (replaces the rejected `020_dispatch_capability_marker.md`)

## What the audit killed, and why it was right

Round 1 proposed a parent-written `.codexclaw/dispatch-capability/<session>-<agent>.json`
marker that the gate would trust. Auditor: BLOCKER — the hook and the child run as the
SAME host user, so a write-capable child (certainly one with `bypassPermissions`) can
create its own `evidenceWritable:false` marker and skip evidence verification entirely.
Calling a file "parent-authored" does not make it parent-authenticated.

It also showed `sanitizeKey()` is non-injective (`state.ts:109-120`): `a/b` and `a-b`
collide, and an absent `agent_id` maps to the literal `missing`. So the marker was both
forgeable and collision-prone.

**Accepted in full. The marker is deleted. No new trust surface is introduced.**

## What actually fixes D2

The auditor's preferred remedy is the repo's own existing classifier, and it is right:
**read-only work must be dispatched as `agent_type:"explorer"`**, which the hook matcher
`^worker$` and `GATED_AGENT_TYPES` already exclude from the gate entirely
(DISPATCH-AGENT-TYPE-01). A read-only explorer never enters the receipt gate, so it can
never be trapped by it. The mechanism already exists and is already tested.

The observed incident was a DISPATCH error, not a runtime gap: a read-only packet was
sent to a `worker`. Two things follow.

### 1. The trap must not be fatal even when dispatch is wrong (010 covers this)

Humans and agents will keep mis-routing. 010's terminal tombstone means a mis-routed
read-only worker is released after its budget instead of looping forever, and the
parent is told. That is the real safety net, and it needs no new trust surface.

### 2. Make the correct dispatch the easy one (this doc)

No source-trust change. Instead:

- **Diagnose at the point of failure.** When the gate blocks a worker that has not
  produced a receipt, the directive already tells it to write one. Add one sentence
  naming the actual root cause when it applies: if you were dispatched read-only, you
  cannot satisfy this — report that to your parent, which must re-dispatch you as an
  explorer. This converts a confusing loop into an actionable message on attempt 1.
  It is text in a directive: it grants nothing and cannot be forged into an exemption.
- **Name the failure mode in the doctrine** so dispatchers stop making it (030).

## Change map

`src/subagent-evidence.ts` — `verifierDirective()` gains the read-only diagnosis
sentence. No control-flow change, no new input trusted.

## Explicitly NOT doing

- No `dispatch-capability` file, directory, or CLI verb.
- No `permission_mode` branch: the provenance lane proved it only ever emits `default`
  or `bypassPermissions`, so any such branch is dead code (see 000_moc).
- No transcript sniffing: already rejected in the 260711 hardening unit; tests 15-18
  lock that rejection and they stay.

## Test changes

- `020: the block directive names the read-only dispatch failure mode` — asserts the
  attempt-1 reason mentions the explorer re-dispatch remedy.
- All of tests 15-18 must still pass untouched: no child-authored text changes any
  decision. That is the c4 guarantee, and it is now trivially true because we added no
  new input to trust.

## Accept criteria (c3, c4, c5)

- A read-only-dispatched worker is released by the 010 tombstone, not trapped (c3).
- No child-authored signal — message, transcript, or file — can exempt a worker from
  verification (c4). Provable by construction: the gate reads no new child-writable
  input.
- `GATED_AGENT_TYPES` still contains only `worker`; explorer stays ungated (c5).
