# Cycle-4 Audit Synthesis — wp4 (Thread Routing) + wp6 (Approval Relay, REFRAMED)

Date: 2026-07-07. Auditor: independent gpt-5.5-xhigh "Sagan".
Round 1 FAIL (5 blockers) -> AMENDMENT A4 + ci6 criterion reframe + ledger steering
record -> round 2 PASS. Worker: "Archimedes" (single, final cycle).

## STEERING DECISION OF RECORD (WP6 descope, A4.3)
The original WP6 ("relay codex per-tool approvals live over chat: runner
onApprovalNeeded, parse tool.approval_required, write stdin response") is NOT
IMPLEMENTABLE: `codex exec --help` states it is non-interactive; the JSONL stream
has no approval event and runner closes stdin after the prompt (runner.ts:21,
:111, :254). Additionally agent-service HARDCODED fullAccess:true (:187), so the
v6 agents.full_access column had zero runtime effect.

Decision: reframe WP6 as a PRE-TURN permission gate with equal verification
rigor — full_access=0 blocks the turn pending allow-once / allow-always / deny
(inline keyboard TG, button trio DC, /approve <id> <choice> text fallback),
bound to {bindingId, promptHash, workdir}, fail-closed DENY at 10min timeout,
unauthorized-clicker denial, markup cleared on resolve/expiry, allow-always
flips agents.full_access=1 with a lifecycle event. Per-tool live relay becomes a
future work item IF codex ships an approval protocol. This is recorded as a
conscious criteria amendment (ci6 scenario rewritten), NOT a silent weakening:
the replaced criterion described an impossible mechanism; the replacement ships
the user-facing approval UX competitors have (OpenClaw trio semantics, Hermes
fail-closed deny), verified by tests.

## Other accepted blockers -> A4 decisions (diff level)
1. Binding identity chat-only: db getOrCreateBinding + agent-scoped variant
   (db.ts:460/:670) and AgentService resolution (agent-service.ts:108) gain
   topic_id; msg.message_thread_id ?? 1 for forum supergroups (General topic=1).
2. /delete confirmation keyed by chat only (telegram-adapter.ts:74,
   telegram-commands.ts:172-181): becomes chat+topic keyed, topic-scoped binding
   deletion; /reset //new act per-topic.
3. Send-propagation checklist recorded (11 call sites across adapter/webhook/
   output-formatter/telegram-api).
4. DC thread lifecycle: + archiveThread/startForumThread, archive-on-completion,
   24h idle sweep on the heartbeat scheduler pattern (cli.ts:68, heartbeat.ts:70).

## Incidental finding
Bare `npm test`/`node --test` hangs because test discovery EXECUTES
test/fixtures/fake-codex.mjs whose stdin reader waits forever — root cause of the
cycle-1 "bare node --test hang" observation. Always pass the test glob.
