# Cycle-3 Audit Synthesis — wp5 (Streaming/Progress) + wp7 (Media I/O)

Date: 2026-07-07. Auditor: independent gpt-5.5-xhigh "Arendt".
Round 1 FAIL (5 blockers, 1 advisory) -> AMENDMENT A3 -> round 2 PASS.
Worker: "Lorentz" (single, both phases — shared adapter render paths make a
parallel split impossible without merge conflicts).

## Accepted blockers -> A3 decisions (diff level)
1. RunnerEvent has no thinking/tool_call/file_change kinds (runner.ts:21-26;
   parser only agent_message + command_execution at :108-120) -> A3.1 extends
   union + parseExecEvent + fake-codex fixture emissions.
2. sendDraftProgress has no throttle/retry_after/not-modified/3-failure handling
   (telegram-rich-send.ts:106-122); legacy 1500/2000ms gates only serve the
   non-draft path -> A3.2 progress-window discipline; research 1000ms OVERRIDES
   the spec's dead 500ms value.
3. DC gateway turns pass no onEvent (discord-adapter.ts:415-423) and slash turns
   edit the deferred original with the full answer (discord-commands.ts:175-187),
   violating "defer=entry ack, final=fresh message" -> A3.3: edited status embed
   (>=1200ms) + fresh final; deferred original = progress pointer, compact
   done-state edit at completion.
4. WP7 half-landed: TG media input inline (telegram-adapter.ts:255-321) must be
   EXTRACTED into media-handler.ts (not duplicated); DiscordMessageEvent drops
   attachments (discord-gateway.ts:31-39) -> plumb from MESSAGE_CREATE;
   output-formatter.ts missing; TG sendDocument is JSON/file_id-only
   (telegram-api.ts:183-195) -> multipart branch for in-memory content.
5. telegram-webhook.ts bypasses the render pipeline (plain sendMessage finals,
   no onEvent at :125-134,:193-198) -> A3.5 render parity via shared helpers.
6. Advisory: DC multipart sendFile lacks 429 retry -> A3.6.

## Notes
- Throttles must be test-controllable (injectable clock); no real sleeps in tests.
- Write set includes discord-gateway.ts + discord-commands.ts (audit-added).
- db.ts off-limits (v6 already covers all schema needs).
