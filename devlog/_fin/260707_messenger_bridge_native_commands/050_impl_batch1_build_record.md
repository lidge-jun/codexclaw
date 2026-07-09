# Build Record — Batch parallel1 (wp1 + wp2 + wp8)

Date: 2026-07-07. Phase: B->C. Workers: 3x gpt-5.5-xhigh
(wp1 "Peirce", wp2 "Nietzsche", wp8 "Turing"), disjoint write sets, spawned in
parallel after audit-gate PASS (see 030_impl_audit_synthesis.md).

## Verification (main session, fresh)
- Bridge: `node --test --test-timeout=60000 'test/*.test.ts'` = **191 pass / 0 fail**
  (48s; baseline was 151 pass). +40 tests net.
- GUI: `npm run build` (vite) OK — 45 modules, 261ms. `tsc --noEmit` is NOT a gate:
  pre-existing environmental type-resolution failure (react types via root
  node_modules); error count 635 baseline -> 617 with changes.
- Incident: an orphaned repo-wide `node --test --test-concurrency=1 <all components>`
  run (started by a worker at 11:57) caused 60s timeouts in agent-service/heartbeat/
  runner tests during the first main-session verification; killed PIDs 6387/14574 and
  re-ran clean. Worker receipts in `.codexclaw/evidence/` (wp1-telegram-surface-*.txt,
  wp2-discord-interaction-engine/, wp8-gui-observability-session-mgmt-evidence.md).

## Diff-level change map

### wp1 Telegram Interactive Surface (~745 LOC new+moved)
- NEW `src/telegram-commands.ts` (292): CommandDef/CommandContext/CommandResult,
  parseCommand, buildCommandDefs (extracted /start /delete /status /reset /cwd
  /model /help + new /new /stop /retry /effort), registerTelegramCommands
  (setMyCommands built from the same dispatch table).
- NEW `src/telegram-interactive.ts` (178): encodeCallback/decodeCallback (<=64B),
  buildModelPicker/buildEffortPicker/buildActionButtons, handleCallback router
  (always answerCallbackQuery).
- MOD `src/telegram-adapter.ts` (+127/-211): inline command block replaced by
  dispatch; ack-only callback_query branch replaced by handleCallback; media input
  photo/document/voice -> getFile/downloadFile -> tmp path prompt prefix; draft
  streaming wrap for private+richSupported turns.
- Tests: NEW telegram-commands.test.ts (148), telegram-interactive.test.ts (100);
  telegram-adapter.test.ts +137/-2 (coverage relocated, not weakened).

### wp2 Discord Interaction Engine (~1100 LOC)
- NEW `src/discord-commands.ts` (286): SlashCommandDef, COMMANDS (/ask /review
  /status /model /new /stop /effort /cwd /help), registerGlobalCommands (PUT
  /applications/{appId}/commands), matchCommand.
- NEW `src/discord-components.ts` (177): STATUS_COLORS, buildStatusEmbed,
  buildActionRow, buildModelSelect, buildApprovalCard.
- NEW `src/discord-interactions.ts` (167): handleInteraction (PING/APPLICATION_
  COMMAND/MESSAGE_COMPONENT), deferReply (3s ack), editDeferredReply.
- MOD `src/discord-api.ts` (+121): createInteractionResponse,
  editOriginalInteractionResponse, registerGlobalCommands, startThread, sendFile
  (hand-rolled multipart), editMessage.
- MOD `src/discord-gateway.ts` (+27): onInteraction option, INTERACTION_CREATE
  dispatch, applicationId from READY application.id.
- MOD `src/discord-adapter.ts` (+150/-10): applicationId capture + global command
  registration + interaction wiring; guild auto-thread per task; status-embed final
  replies with retry action row.
- Tests: NEW discord-commands (157) / discord-components (54) / discord-interactions
  (152); discord-adapter.test.ts +129, discord-gateway.test.ts +41.

### wp8 GUI Observability + Session Mgmt (~800 LOC)
- MOD `src/bridge-controller.ts` (+50): owns BridgeMetrics + EventLog; implements
  metricsSnapshot()/recentEvents(); lifecycle events (start/stop/reload).
- MOD `src/agent-service.ts` (+42): optional metrics?/events? hooks in
  AgentServiceOptions; message_received/turn_started/turn_complete/error recorded
  in handleIncoming/runOne, no-op when absent.
- MOD `src/event-log.ts` (+3): kind union += turn_started | lifecycle.
- MOD `src/server.ts` (+75): BridgeControllerLike += agentStatuses?; routes
  GET /api/agents/statuses, POST /api/bindings/reset, POST /api/bindings/cwd
  (existing MUTATING token discipline).
- MOD `src/db.ts` (+7): resetBindingSession(id), setBindingWorkdir(id, cwd) ONLY.
- NEW `gui/src/pages/Dashboard.tsx` (178): 2x2 metric cards + event feed table +
  agent status list (D4 density, poll pattern from existing pages).
- NEW `gui/src/pages/Sessions.tsx` (292): dense bindings table, row actions
  (reset confirm, cwd edit, job-history modal via existing GET /api/bindings/jobs).
- MOD `gui/src/App.tsx` (+9), `api.ts` (+61: BindingRow +agent_id/workdir/model,
  getMetrics/getEvents/resetBinding/setBindingCwd/getBindingJobs), `icons.tsx`
  (+8: activity, database), `styles.css` (+63: metric grid).

## Status
C-phase adversarial review dispatched (fresh reviewer "Epicurus", gpt-5.5-xhigh).
Criteria ci1/ci2/ci8 remain open until C PASS; evidence will be captured at D.
