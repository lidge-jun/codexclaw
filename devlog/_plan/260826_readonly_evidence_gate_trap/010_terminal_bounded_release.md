---
created: 2026-08-26
workPhase: wp2
---

# 010 — Terminal-bounded release (D1)

Status: PLANNED

## The defect, exactly

`plugins/codexclaw/components/pabcd-state/src/subagent-evidence.ts:196-199`:

```ts
const attempts = readAttempts(cwd, sessionId, agentId);
if (attempts >= MAX_ATTEMPTS) {
  return JSON.stringify({ decision: "block", reason: escalationDirective() });
}
```

This branch has no exit. `attempts` never decreases; `clearAttempts()` is reachable
only via a valid receipt. Every later SubagentStop re-enters and re-blocks.

## The policy conflict (must be resolved, not ignored)

- `devlog/_fin/lazygap/002_subagent_evidence_gate.md:38-41` and
  `devlog/_fin/lazygap_impl/010_subagent_stop_evidence_gate.md:119-139` specify
  "at most MAX_ATTEMPTS blocks", then release.
- `docs/security-hardening.md:22-26` later says worker verification "remains
  fail-closed after its retry budget".

Resolution: **fail-closed is preserved as a RECORD, not as an infinite block.** An
infinite block does not make anything safer — the child cannot produce the receipt, so
the block conveys no additional safety; it only prevents the parent from ever learning
the outcome. We escalate to the parent instead of stalling the child. The Stop hook set
this precedent already (`hook.ts:1027-1031`): bounded blocks, then release.

## Audit round 1: FAIL — what changed

Auditor verdict FAIL (`.codexclaw/evidence/260826_readonly_gate_audit.md`), 4 blockers.
All four are accepted; the design below is the replacement, not a patch of the old one.

**B1 — bounded release is an opt-out.** Accepted, and it is the central risk: any
worker could refuse 3 times and be released as if verified. A log nothing reads is not
fail-closed. FIX: the release is not silent. It writes a TOMBSTONE into the session
State, and `GOAL-COMPLETE-GATE-01` (which already exists and already denies
`update_goal{status:"complete"}`) refuses completion while any unresolved tombstone
remains. The child regains liveness; the PARENT inherits the fail-closed verdict. That
is the consumer the auditor demanded, and it is already wired into a shipped gate.

**B2 — the capability marker is child-forgeable.** Accepted. A same-user file cannot
authenticate anything. FIX: the marker is DELETED from this plan entirely. See 020.

**B3 — the counter trace is wrong.** Accepted, and the auditor's trace is correct:
clearing attempts at call 4 makes call 5 block again. Deletion cannot be both terminal
latch and reset. FIX: the tombstone IS the terminal latch; the attempts counter is left
alone. Call 4 writes the tombstone; calls 5,6,... see the tombstone first and release.

**B4 — symlinked `evidence-unverified/` can alias into `evidence/`.** Accepted. FIX:
no new sibling directory. The tombstone lives inside the session State file, which is
already written through the hardened `writeState` path and is not a child-designated
destination.

## Change map

## Audit round 2/3: required hardening (folded in)

Round 2 FAIL, round 3 NEAR-PASS after the 005 falsification. Accepted and folded below:
concurrency (r2 #3), identity/growth (r2 #4), corrupt sentinel (r2 #5), late-receipt
resolution (r2 #7), audited resolution (r2 #2), stale text (r2 #8).

Recorded as RESIDUALS in the closeout, not fixed here (auditor-accepted): whole-file
State corruption/deletion and `cxc reset --state` clearing tombstones; the
`applyGoalCompleteGuard` fail-open catch; and non-goal sessions having no consumer.
All three are pre-existing properties this unit does not introduce.

### `src/state.ts` — the tombstone lives in session State

Add to `State`:

```ts
/**
 * SubagentStop verifications that exhausted their retry budget without a valid
 * receipt. The child is released (liveness), but the PARENT cannot certify the
 * goal while any entry is unresolved (fail-closed verdict).
 */
unverifiedSubagents: UnverifiedSubagent[];
```

with `UnverifiedSubagent = { agentId, turnId, agentType, attempts, receiptClaimed, recordedAt }`.

**Identity (r2 #4).** Entries are keyed by `(agentId, turnId)`. `agent_id` is optional
in the payload, and all missing ids would otherwise collide into one resolvable entry,
so a record with no canonical agent id is stored as NON-RESOLVABLE: `cxc evidence
resolve` refuses to clear it by id, and it must be cleared with an explicit override.
Growth is capped at 64 entries; on overflow the array stops growing but a persistent
`unverifiedOverflow: true` sentinel is set. **The sentinel keeps denying completion** —
an unresolved verdict is never dropped to satisfy a size bound.

**Corrupt sentinel (r2 #5).** Reconstruction validates entries individually. A missing
field rebuilds to `[]` (genuine backward compat with old state files). A field that is
PRESENT but malformed, or any entry that fails validation, sets
`unverifiedCorrupt: true`, and the completion guard denies on it. Absent-on-old-schema
and malformed-on-new-schema must never share a fallback — that was the fail-open.
No assistant message is stored (audit finding 7 — accepted; raw child text is a
sensitive-data liability and the parent needs identity, not prose). `receiptClaimed` is
length-limited to 256 chars.

Reconstruction follows the existing defensive pattern: a malformed/absent field
rebuilds to `[]`, never throws. Entries are keyed by `agentId` and are idempotent —
re-recording the same agent updates in place, so repeated stops cannot grow the array
without bound.

### `src/subagent-evidence.ts`

1. Add `readUnverified(cwd, sessionId, agentId)` / `recordUnverified(...)`.

   **Concurrency (r2 #3) — this race is introduced by this change, so it is ours.**
   `writeState` publishes atomically but is not a serialized read-modify-write: two
   subagents stopping at once each read `[]` and one tombstone is lost (last writer
   wins). `recordUnverified` therefore performs its read-modify-write under a
   cross-process lock on the session state file, and RE-READS inside the lock before
   merging its entry. Lock acquisition is bounded and failure-tolerant: if the lock
   cannot be taken, fall back to a merge-on-read-retry, and if that also fails, still
   release the child (liveness) while leaving the corrupt sentinel set so completion
   stays denied. Test with two concurrent writers asserting BOTH tombstones survive.
2. In `runSubagentStopGate`, the FIRST check after the agent-type gate and the
   valid-receipt check is the tombstone:

   ```ts
   if (readUnverified(cwd, sessionId, agentId)) return "";  // already terminal
   ```

   This is what makes calls 5,6,... release — fixing B3 without touching the counter.
3. Rewrite the cap branch:

   ```ts
   if (attempts >= MAX_ATTEMPTS) {
     recordUnverified(cwd, sessionId, agentId, {...});
     return "";
   }
   ```

   Note `clearAttempts` is NOT called (B3).
4. **Late valid receipt resolves the tombstone (r2 #7).** The valid-receipt check runs
   before the tombstone check. Today it only clears attempts. It must also atomically
   mark the matching tombstone resolved and append an audit event — otherwise a worker
   that eventually did the work leaves the parent permanently blocked.
5. Bound the I/O-failure loop (audit finding 4). `writeAttempts` currently swallows
   failure, so a persistently failing write re-reads 0 forever and blocks forever.
   Make it return `boolean`; when the write fails, record the tombstone in-memory-first
   and release rather than block. If BOTH the counter and the state write fail, release
   — liveness wins, and the outer catch is changed from an unconditional block to a
   release, because a gate that cannot record anything cannot honestly demand anything.
5. `escalationDirective()` is currently NOT exported (audit finding 8 — accepted).
   Export it and reuse its wording in the tombstone reason.

### `src/goal-gate.ts` — the consumer (this is what makes it fail-closed)

In `applyGoalCompleteGuard`, after the in-flight-cycle check, deny
`update_goal{status:"complete"}` when `state.unverifiedSubagents` is non-empty:

> GOAL-COMPLETE-GATE-01: N subagent completion(s) exhausted evidence verification
> without a valid receipt (agent ...). Verify or re-run that work and clear it with
> `cxc evidence resolve --session <id> --agent <agent-id>`, or use
> `update_goal status "blocked"`.

`status:"blocked"` still passes — the honest escape hatch is preserved. The gate stays
fail-open on IO error, matching its existing contract.

### `src/cli.ts` + BOTH dispatchers — `cxc evidence resolve`

**Resolution must be evidence-backed, not an acknowledgement (r2 #2).**
`cxc evidence resolve --session <id> --agent <id> --receipt <path>` REQUIRES a receipt
path, validates it through the same `hasValidReceipt` contract, binds it to the exact
tombstone, and appends an immutable resolution event to the ledger. A bare resolve with
no receipt is REFUSED. A human override is a separately named
`--override --reason <text>` which marks the entry `overridden` — never `verified` —
and is likewise ledgered. Test that a bare resolve cannot re-permit completion.

Audit finding 5 (accepted): a verb added only to the component CLI is dead. The
resolve verb must land in `plugins/codexclaw/bin/cxc.mjs` `COMMAND_TABLE`, in
`bin/codexclaw.mjs`, and in `plugins/codexclaw/test/payload-bin.test.mjs`.

### Ordering invariant

The release must happen at cap+1, mirroring Stop: attempts 1..MAX_ATTEMPTS block,
the next call releases. Do not release at MAX_ATTEMPTS itself — that would silently
shorten the retry budget from 3 to 2.

## Test changes — `test/subagent-evidence.test.ts`

Amend test 8 (the only test locking the old behavior). New tests:

- `010: blocks exactly MAX_ATTEMPTS times, then releases terminally and stays released`
  — the auditor's exact 1-6 sequence: block, block, block, "", "", "". Fails on the
  current implementation (blocks at 4,5,6) AND on the rejected round-1 design (blocks
  at 5,6). It disagrees with both.
- `010: terminal release records an unresolved tombstone in session state`.
- `010: the tombstone carries no raw assistant message` — asserts the serialized state
  does not contain the child's message text (finding 7).
- `010: repeated stops do not duplicate the tombstone` — idempotency.
- `010: a failed attempt write releases instead of looping forever` — inject an
  unwritable state dir; assert release, not block (finding 4).
- In `goal-gate.test.ts`: `an unresolved subagent tombstone denies goal completion`
  and `status blocked still passes` and `resolving the tombstone re-permits completion`.
  These are the tests that prove B1 is actually closed.

## Accept criteria (c2, c5)

- Calls 4,5,6 with no receipt all return `""` (child is never trapped).
- `update_goal{status:"complete"}` is DENIED while a tombstone is unresolved, and
  permitted after `cxc evidence resolve`. A stalling worker therefore cannot launder an
  unverified result into a completed goal — verification is deferred to the parent, not
  waived.
- The pre-fix implementation FAILS the new sequence test.
- Tests 1-7 and 9-18 pass unchanged.
- `hasValidReceipt` is untouched; no new child-writable directory is introduced.

## Activation scenario (C-ACTIVATION-GROUNDING-01)

Triggered by calling `runSubagentStopGate` four times with a payload carrying no valid
receipt. Observable proof it ran: empty return on calls 4-6, AND an unresolved entry in
`.codexclaw/sessions/<session>.json` `unverifiedSubagents`, AND `update_goal
{status:"complete"}` denied by GOAL-COMPLETE-GATE-01 while that entry is unresolved.
The third is the one that matters: it proves the consumer, not just the writer.
