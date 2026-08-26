---
created: 2026-08-26
status: DONE
---

# 900 — Closeout

Outcome: **DONE**. Shipped as 0.2.14 and deployed locally.

## What was wrong

A subagent dispatched read-only cannot create a file under the parent's
`.codexclaw/evidence/`, so `hasValidReceipt()` was false forever. Past `MAX_ATTEMPTS`
the gate returned `decision:"block"` on every subsequent SubagentStop with no exit.
The transcript that prompted this shows 15+ identical escalation blocks against a child
that had already done its work correctly.

## What shipped

The retry budget is terminal. At the cap the gate records an unresolved verdict in
session state and releases the child; `GOAL-COMPLETE-GATE-01` denies
`update_goal {status:"complete"}` until it is settled by `cxc evidence resolve` with a
valid receipt. Fail-closed moved from the control flow to the verdict.

## The argument that settled it

Two audit rounds rejected bounded release as "an opt-out from verification". The
premise was tested rather than argued (005): **one junk byte** in the evidence
directory already releases a worker on call 1. So the cheap opt-out predates this
change, and the population that actually reaches the cap is workers that CANNOT write
the receipt — precisely the trapped read-only case. Bounded release does not weaken the
gate; it converts "infinite loop, no record" into "released, with a verdict the parent
must settle". The reviewer accepted this and the scope was re-cut around it.

## Designs killed by review (do not reintroduce)

| Design | Why it died |
|---|---|
| Branch on `permission_mode` | Only ever emits `default`/`bypassPermissions`; `readOnly` is not in the hook schema. Dead code. |
| `dispatch-capability` marker file | Hook and child run as the same host user — a child could forge its own read-only declaration. |
| Hook-authored `evidence-unverified/` dir | A child could pre-create it as a symlink to `evidence/`, turning the artifact into a valid receipt. |
| `--override --reason` on resolve | A CLI flag cannot authenticate a human; the agent being held back could erase its own verdict. |
| Stale-lock breaker | Pathname read/rename/unlink is TOCTOU-racy; two processes could both break and enter, losing a verdict. |

## Review

3 plan-audit rounds (FAIL, FAIL, NEAR-PASS) and 12 implementation-review rounds
(11× FAIL, then NEAR-PASS with no remaining silent-allow path). Evidence:
`.codexclaw/evidence/260826_readonly_gate_*.md`.

## Residuals (recorded, not fixed)

- **MAJOR — total-storage-failure limit (accepted).** When the counter write, both
  locked state writes, and the independent marker all fail at once, there is no durable
  medium. The child is released for liveness; if storage later recovers the parent
  cannot distinguish that from clean absence. No implementation can close this without
  a host-owned durable channel — the reviewer accepted it as a physical limit.
- **MAJOR — cross-process snapshot window.** Completion and SubagentStop are
  independent processes with no shared transaction, so completion can linearize before a
  worker durably publishes its cap. `hasSpentBudget` closes the later terminal-call
  window because counters are written during calls 1..3.
- **MAJOR — ambiguous pre-upgrade counter migration (fail-closed).** Counters written
  before turn-scoping use the agent-only name. Safety holds (`hasSpentBudget` keeps
  denying), but an upgraded session needs a receipt-backed legacy resolution path.
- **MINOR** — session-id validation is enforced at SessionStart but not repeated at
  every stateful hook boundary; same-identity counter RMW is unlocked (runtime is
  sequential per child); the two-process concurrency test has no barrier, so it does not
  deterministically prove contention.

## Verification

`npm test` 2026/2026 pass, 0 fail. Build, gate, inventory, dist-freshness clean.
Behavioral disagreement proven by stashing only `src/subagent-evidence.ts`: 6 new tests
go red against the pre-fix source.

Live, against the INSTALLED `0.2.14+codex.260826140715` payload:

```
6 stops, no receipt      -> block,block,block,release,release,release
update_goal complete     -> DENIED (names the unverified agent)
bare evidence resolve    -> refused (--receipt required)
resolve --receipt <path> -> resolved + ledgered
update_goal complete     -> ALLOWED
explorer stop            -> ungated
```

Commits: `bb8b5b52` (fix), `a809417` (release 0.2.14).
