# Interactive Subcommand Expansion — cycles A+B (DONE)

Date: 2026-07-07. Goalplan `interactive-subcommand-expansion-cycle-a-session`,
HOTL, 2 PABCD cycles. Final gates: suite **290 pass / 0 fail** (baseline 265),
repo build 100 files OK, gate OK, `cxc loop validate` OK, live 7717 server
restarted onto new dist (pid 42955, telegram active).

## Cycle A — info/session family (auditor Nietzsche, worker Avicenna, reviewer Harvey)
- Rendering seam: GatewayCommandResult += optional telegramHtml/telegramKeyboard/
  discordEmbed/discordComponents, consumed at toTelegramCommandResult +
  editGatewayReply (backward compatible).
- db.listBindingsForChat(kind, chatId, agentId) with explicit null/non-null SQL
  branches (auditor advisory).
- NEW commands: /sessions (topic/thread rows, session-id short, effective
  model/effort, DC cap 10 + "+N more"), /jobs [n] (default 5 cap 15, duration
  from started/ended), /agent (card summary; REVIEWER-CAUGHT SECURITY FIX:
  result data carried raw AgentRow with token/webhook_url -> replaced with
  redacted DTO + JSON leak test), /status enrichment (mode + 8-char session +
  transport).
- /mode interactive: TG keyboard via NEW mode_select callback (compact tag "o",
  in callbackBindingId so authorizeCallback gates identically; unauthorized +
  garbage tests), DC /mode slash newly REGISTERED (was missing entirely) with
  button routing; pinned 9-command test updated.
- DC text dispatch allowlist (GATEWAY_TEXT_COMMANDS) synced with help.

## Cycle B — setting/reset family (auditor Gibbs, worker Boyle, reviewer Sagan)
- /model list: buildCatalog() direct (loadModelCatalog drops provider source),
  provider-grouped, TG chunked via chunkTelegramMessage; DC continuation
  fields ("provider (2/3)") through NEW capDiscordEmbed (25 fields with
  "+N more", 1024 truncation, 6000 budget) after a chunk-drop blocker fix.
- /model reset + /effort reset: reserved keywords checked before verbatim save
  (model ids "list"/"reset" documented unusable); confirmations show effective
  fallback.
- /cwd reset: GatewayCommandContext.defaultWorkdir threaded from TG poll,
  TG webhook, DC contexts; shared validateWorkdir extracted (reviewer traced
  all three origins trusted; /cwd <path> strictness unchanged).
- /approve list: public AgentService.listPendingApprovals (read-only,
  binding-scoped, expiry-pruned); rows = id/workdir/promptHash-short/expires-in
  (approvals store has no prompt text - auditor caution honored).
- LATENT BUG fixed (reviewer blocker): TG long-poll COMMAND binding resolution
  ignored thread_mode=plain topic flattening, diverging from webhook/runTurn —
  commands in forum topics mutated the wrong binding. Now flattened identically,
  tested both modes.
- Picker markers: TG keeps ASCII "* " (repo ASCII default); DC native
  default:true verified (NOOP).

## Command surface after this unit
/status /context /new /reset /cwd [path|reset] /model [id|list|reset] /effort
[level|reset] /mode [thread|plain] /stop /retry /approve [id choice|list]
/sessions /jobs [n] /agent /help — all auto-registered (setMyCommands, DC
global commands) and auto-covered by the /help generator + coverage tests.
