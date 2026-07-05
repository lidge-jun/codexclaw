 # messenger_bridge — Phase E2: Slash Commands & Interactive Controls
 
 Status: P (plan) · class C2 · zero new runtime deps
 
 ## Loop-spec header
 
 - **Loop archetype:** spec-satisfaction (verifier = test suite)
 - **Trigger:** E2-E6 sequential implementation
 - **Goal:** Bot commands `/status`, `/reset`, `/model`, `/help` on Telegram;
   callback query dispatch for inline keyboards; Discord gets text-prefix
   equivalents (`!cxc status/reset/model/help`). Register Telegram bot menu
   via `setMyCommands` on adapter start.
 - **Non-goals:** Discord application (slash) commands (requires OAuth2 app id,
   too heavy for zero-dep); Discord button components (future).
 - **Verifier:** `npm test` + `npm run build`
 - **Stop condition:** all tests pass, commands dispatch correctly
 - **Memory artifact:** this file
 - **Expected outcomes:** DONE
 
 ## Previous cycle (LOOP-CONTINUITY-01)
 
 E1 shipped: sendRichMessage, Discord embeds, link rendering, media API methods,
 `setMyCommands`/`answerCallbackQuery` already in telegram-api.ts, `callback_query`
 in TgUpdate type. 709/709 tests pass.
 
 ## Diff-level plan
 
 ### MODIFY `src/telegram-adapter.ts`
 
 In `dispatch()`, expand the command routing after `/start` and `/id`:
 
 ```
 /status → handleStatus(chatId, msg)
 /reset  → handleReset(chatId, msg)
 /model  → handleModel(chatId, msg, args)
 /help   → handleHelp(chatId, msg)
 ```
 
 New functions:
 - `handleStatus(chatId, msg)`: look up binding for this chat, reply with
   thread_id, model, status, agent name. Uses `db.getOrCreateAgentBinding` or
   `db.getOrCreateBinding`.
 - `handleReset(chatId, msg)`: call `db.clearBindingThread(bindingId)`, reply
   "session reset — next message starts fresh".
 - `handleModel(chatId, msg, args)`: parse model name from `/model gpt-4o` etc,
   update agent model via `db.updateAgent(agentId, { model })` (agent-scoped) or
   reply with current model if no arg.
 - `handleHelp(chatId, msg)`: static help text listing available commands.
 
 On `start()` after getMe+probe: call `api.setMyCommands([...])` to register the
 bot menu (start, id, status, reset, model, help).
 
 In `dispatch()`: handle `update.callback_query` — call `answerCallbackQuery` +
 extract `data`, log it. (Foundation for future inline keyboard interactions.)
 
 ### MODIFY `src/discord-adapter.ts`
 
 In `handleMessage()`, before the agent turn: parse text-prefix commands:
 
 ```
 !cxc status → reply with binding info (same as Telegram /status)
 !cxc reset  → clear binding thread, reply confirmation
 !cxc model  → show/set model
 !cxc help   → help text
 ```
 
 Extract a `parseDiscordCommand(text)` helper that returns `{ command, args } | null`.
 
 ### NEW `test/slash-commands.test.ts`
 
 - Telegram: /status on an allowlisted chat → reply with binding info
 - Telegram: /reset → clearBindingThread called, reply sent
 - Telegram: /model gpt-4o → updateAgent called
 - Telegram: /help → reply with help text
 - Telegram: callback_query → answerCallbackQuery called
 - Telegram: setMyCommands called on start
 - Discord: !cxc status/reset/help → appropriate replies
 
 ## Scope boundary
 
 - **IN:** /status, /reset, /model, /help commands (Telegram + Discord text-prefix),
   setMyCommands registration, callback_query foundation, tests.
 - **OUT:** Discord application commands (slash), Discord buttons, media upload commands.
