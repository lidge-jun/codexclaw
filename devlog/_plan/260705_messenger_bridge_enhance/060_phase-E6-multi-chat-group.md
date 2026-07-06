 # messenger_bridge — Phase E6: Multi-Chat & Group Enhancements
 
 Status: P (plan) · class C2 · zero new runtime deps
 
 ## Loop-spec header
 
 - **Loop archetype:** spec-satisfaction
 - **Goal:** Better group support and multi-chat workflows: custom trigger prefix,
   heartbeat broadcast to all paired chats, /kick and /pause admin commands.
 - **Non-goals:** Per-group system prompts (needs schema migration — follow-up),
   cross-chat shared bindings (complex, follow-up), per-user rate limiting.
 - **Verifier:** `npm test` + `npm run build`
 
 ## Previous cycle (LOOP-CONTINUITY-01)
 
 E5 shipped: metrics.ts, event-log.ts, /api/metrics, /api/events. 730/730.
 
 ## Diff-level plan
 
 ### MODIFY `src/telegram-adapter.ts`
 
 1. **Custom trigger prefix:** In `gateAndStripMention()`, in addition to @mention,
    also check for a configurable trigger prefix stored on the agent
    (`agent.trigger_prefix`, e.g. `!ask`). If the message starts with the prefix,
    strip it and proceed. This lets group users type `!ask what is 2+2` instead of
    `@botname what is 2+2`.
 
 2. **`/kick` command:** Remove a chat from the allowlist.
    `opts.db.removeAgentAllowlist(agentId, chatId)` (or legacy equivalent).
    Reply "Chat removed from allowlist."
 
 3. **`/pause` / `/resume` command:** Toggle a per-adapter `paused` flag.
    When paused, incoming messages are silently ignored (no agent turn).
    Reply "Paused — messages will be ignored until /resume."
 
 ### MODIFY `src/discord-adapter.ts`
 
 1. **Custom trigger prefix:** Same logic — check `agent.trigger_prefix`.
 
 2. **`!cxc kick` command:** Remove channel from allowlist.
 
 3. **`!cxc pause` / `!cxc resume`:** Toggle paused state.
 
 ### MODIFY `src/heartbeat.ts`
 
 **Heartbeat broadcast:** Change `tickAgent()` to send to ALL paired chats,
 not just `paired[0]`. Loop through `db.listAgentAllowlist(agent.id)` and
 send the heartbeat result to each.
 
 ### MODIFY `src/db.ts`
 
 - Add `trigger_prefix` column to agents table (schema migration).
 - Add `removeAgentAllowlist(agentId, chatId)` method.
 - Add `trigger_prefix` to `AgentRow` and `AgentPatch`.
 
 ### MODIFY `src/agent-routes.ts`
 
 - Add `triggerPrefix` field to the public agent shape and the update handler.
 
 ### NEW `test/multi-chat.test.ts`
 
 - Heartbeat broadcast: sends to all paired chats, not just first.
 - Trigger prefix: message with prefix passes gate, without prefix + without
   mention is gated.
 - /kick removes allowlist entry.
 - /pause stops responses, /resume re-enables.
 
 ## Scope boundary
 
 - **IN:** Trigger prefix, heartbeat broadcast, /kick, /pause, /resume, schema migration.
 - **OUT:** Per-group system prompts, cross-chat shared bindings, per-user rate limiting.
