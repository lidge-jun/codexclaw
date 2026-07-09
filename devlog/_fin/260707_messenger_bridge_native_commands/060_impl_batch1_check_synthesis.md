# C-Gate Synthesis — Batch parallel1, Round 1

Date: 2026-07-07. Reviewer: FRESH adversarial gpt-5.5-xhigh "Epicurus" (uncontaminated).
Verdict: **FAIL** — 3 blockers, 2 advisories. Synthesis per REVIEW-SYNTHESIS-01.

## B1 — suite red when reviewer ran it (REBUT: environmental, not a batch regression)
Evidence: runner.test.ts fails/passes on the SAME tree across runs (9/0 at 11:20,
4/9 fail at 12:05, 9/0 again at 12:09); runner.ts untouched by this batch; failures
are 60s timeouts + write EPIPE in spawn-based tests (runner/heartbeat/agent-service
spawn fake-codex children). Host load average ~10 (syspolicyd 79%, fileproviderd 71%,
9-day uptime) + an orphaned repo-wide `node --test` run a worker left behind (killed:
PIDs 6387/14574). Deterministic green evidence exists: 191/0 at 12:00 (48s run).
Disposition: REBUT as pre-existing load flakiness; capture a fresh green run as D
evidence. Backlog candidate (out of current criteria): serialize spawn-heavy test
files or raise their per-test timeout.

## B2 — unauthorized Telegram callback can mutate agent settings (ACCEPT, security)
RCA: wp1 wired handleCallback for ALL callback_query updates without the allowlist
gate that message handling applies; telegram-interactive.ts:124 applies model/effort
changes from any chat; a worker-authored test even encoded the wrong behavior
(telegram-adapter.test.ts:237 proves unpaired chat 500 can set effort).
Fix (dispatched to wp1 worker Peirce, same-reviewer-lineage repair): thread
agentId/allowlist context into callback dispatch; deny unpaired/mismatched chats
before any action; still answerCallbackQuery with denial; flip the wrong test to
assert denial + add positive allowlisted test.

## B3 — Discord defer can miss the 3s ACK window (ACCEPT)
RCA: discord-adapter.ts:156 awaits resolveApplicationId() (worst case a getMe()
network call) before handleInteraction() defers. Matches Lovelace research: defer
is the entry ack; app id is only needed for the follow-up edit.
Fix (dispatched to wp2 worker Nietzsche): defer type-2/3 interactions immediately,
resolve app id after; test asserts defer precedes any getMe() fetch.

## A4 — Telegram media tmp dir leak (ACCEPT, folded into Peirce round)
Cleanup in finally after turn consumption, best-effort.

## A5 — Discord interaction token leak in REST error strings (ACCEPT, folded into
Nietzsche round): redact /interactions/{id}/{token} + /webhooks/{appId}/{token}
segments before composing DiscordApiResult.error.

## Cross-blocker conflicts
None: B2 is telegram-only, B3/A5 discord-only, A4 telegram-only — write sets stay
disjoint for the repair round. Reviewer reuse plan: Epicurus re-verifies blocker
closure (same reviewer, gets synthesis + change-diff summary per DISPATCH doctrine).
