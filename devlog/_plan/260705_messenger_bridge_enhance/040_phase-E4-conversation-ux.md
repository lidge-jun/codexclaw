 # messenger_bridge — Phase E4: Conversation UX Enhancements
 
 Status: P (plan) · class C2 · zero new runtime deps
 
 ## Loop-spec header
 
 - **Loop archetype:** spec-satisfaction
 - **Goal:** Richer conversation UX: reply-to-context, /context command, Discord
   progress messages, streaming partial responses via message edits.
 - **Non-goals:** Forum topic auto-creation, Discord thread creation (too heavy).
 - **Verifier:** `npm test` + `npm run build`
 
 ## Previous cycle (LOOP-CONTINUITY-01)
 
 E3 shipped: rate-limit.ts, 429 retry, circuit breaker, gateway jitter. 722/722.
 
 ## Diff-level plan
 
 ### MODIFY `src/telegram-adapter.ts`
 
 1. **Reply-to context:** In `dispatch()`, when `msg.reply_to_message` is present
    and the reply target is from the bot, extract the original prompt from jobs
    table and prepend as context: `[replying to: "<original>"] <new message>`.
 
 2. **`/context` command:** In `dispatch()`, add `/context` handler. Look up
    last 5 jobs for the binding, format as a summary, reply.
 
 3. **Streaming partial responses (Telegram):** In `runTurn()`, when a `message`
    event arrives from the runner, edit the status message with partial text
    (throttled: max 1 edit per 2 seconds to stay within rate limits). This
    replaces the current tool-label-only status with actual streaming text.
 
 ### MODIFY `src/discord-adapter.ts`
 
 1. **Reply-to context:** In `handleMessage()`, when `msg.messageReference` is
    present (Discord's reply feature), note it in the prompt context.
    (Requires adding `messageReference` to DiscordMessageEvent.)
 
 2. **`!cxc context` command:** Add to `handleCommand`.
 
 3. **Progress message (Discord):** In `handleMessage()`, after triggering typing,
    send a "thinking..." message, edit it with periodic status updates during
    the turn, then delete it before sending the final reply.
 
 ### MODIFY `src/discord-gateway.ts`
 
 - Add `message_reference` to the MESSAGE_CREATE dispatch parsing in
   `DiscordMessageEvent` interface.
 
 ### NEW `test/conversation-ux.test.ts`
 
 - Telegram /context command: returns last N jobs summary
 - Telegram reply-to-context: prepends context to prompt
 - Discord !cxc context: returns job summary
 - Discord progress message: sent, edited, deleted lifecycle
 
 ## Scope boundary
 
 - **IN:** /context command, reply-to context, streaming edits, Discord progress.
 - **OUT:** Forum topics, Discord threads, media in replies.
