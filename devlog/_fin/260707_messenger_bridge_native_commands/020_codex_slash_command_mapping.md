# Decision: Reimplement Codex Control Commands As Messenger-Native Commands

Status: DECIDED
Date: 2026-07-07
Related files:
- `plugins/codexclaw/components/messenger-bridge/src/runner.ts`
- `plugins/codexclaw/components/messenger-bridge/src/agent-service.ts`
- `plugins/codexclaw/components/messenger-bridge/src/telegram-adapter.ts`
- `plugins/codexclaw/components/messenger-bridge/src/discord-adapter.ts`
- `plugins/codexclaw/components/messenger-bridge/src/db.ts`

## Question

Can we attach Codex slash-line commands to Telegram and Discord?

## Decision

Yes, but not by piping Codex TUI slash commands directly.

Implement messenger-native slash commands that reproduce the useful Codex control
semantics against codexclaw's bridge state.

Current runner shape:

```text
telegram/discord message
  -> AgentService.handleIncoming()
  -> runTurn()
  -> codex exec --json
  -> codex exec resume --json
```

This is a one-shot JSON runner model, not an interactive TUI PTY model.

Therefore:

- `/new`, `/model`, `/effort`, `/cwd`, `/stop`, `/retry`, `/status`, and `/help`
  should be implemented by messenger-bridge itself.
- These commands should update DB binding/agent state or control the active
  child process.
- They should not be sent as raw prompt text to Codex.
- They should not require a PTY session.

## Rejected Alternative: PTY Slash Passthrough

Rejected move:

```text
Telegram/Discord /model
  -> send raw "/model" into interactive Codex TUI PTY
```

Why rejected:

- The current runner is `codex exec --json`, not a long-lived PTY.
- A PTY bridge would duplicate CoderBot-style terminal control and would be much
  harder to test deterministically.
- TUI slash commands are UI affordances, not a stable messenger bridge API.
- Telegram and Discord need native affordances: command menus, inline keyboards,
  Discord select menus, buttons, modals, and deferred responses.
- PTY passthrough makes `/stop`, approval relay, queue state, and per-binding
  model state less explicit.

## Chosen Move

Introduce a bridge-owned command registry:

```text
plugins/codexclaw/components/messenger-bridge/src/gateway-commands.ts
```

Expected public shape:

```ts
export interface GatewayCommand {
  name: string;
  description: string;
  handler: (ctx: GatewayCommandContext) => Promise<GatewayCommandResult>;
}

export interface GatewayCommandContext {
  bindingId: number;
  db: BridgeDb;
  agentService: AgentService;
  agentId: number | null;
  args: string;
}

export interface GatewayCommandResult {
  text: string;
  telegramKeyboard?: InlineKeyboard;
  discordEmbed?: DiscordEmbed;
  discordComponents?: ActionRow[];
}

export const GATEWAY_COMMANDS: GatewayCommand[];
export function dispatchGatewayCommand(
  name: string,
  ctx: GatewayCommandContext,
): Promise<GatewayCommandResult | null>;
```

## Command Mapping

### `/new`

Behavior:

```text
clear binding.thread_id
keep binding.workdir
keep binding model/effort overrides
reply with new session status
```

Diff map:

```diff
db.ts
+ clearBindingThread(id: number): void already exists

gateway-commands.ts
+ command /new -> db.clearBindingThread(bindingId)
```

### `/model [model]`

Behavior:

```text
with arg: set binding or agent model
without arg: show Telegram inline keyboard / Discord select menu
next turn uses selected model
```

Diff map:

```diff
db.ts
+ ALTER TABLE bindings ADD COLUMN model TEXT DEFAULT 'default'
+ setBindingModel(id: number, model: string): void

agent-service.ts
- model: req.model ?? agentModel ?? this.opts.model ?? null
+ model: req.model ?? bindingModel ?? agentModel ?? this.opts.model ?? null

telegram-interactive.ts
+ buildModelPicker(catalog, current)

discord-components.ts
+ buildModelSelect(catalog, current)
```

### `/effort [level]`

Behavior:

```text
with arg: set binding or agent reasoning effort
without arg: show picker
next turn uses selected effort
```

Diff map:

```diff
db.ts
+ ALTER TABLE bindings ADD COLUMN effort TEXT DEFAULT 'default'
+ setBindingEffort(id: number, effort: string): void

agent-service.ts
- effort: agentEffort
+ effort: bindingEffort ?? agentEffort
```

### `/cwd <path>`

Behavior:

```text
validate/realpath path under allowed local filesystem rules
update binding.workdir
clear binding.thread_id to avoid resuming old-cwd sessions
reply with current cwd
```

Diff map:

```diff
db.ts
  setBindingWorkdir(id: number, workdir: string): void already exists

gateway-commands.ts
+ command /cwd -> resolve path -> db.setBindingWorkdir() -> db.clearBindingThread()
```

### `/stop`

Behavior:

```text
kill currently running child process for binding
mark current job error/cancelled if possible
leave binding status idle
```

Diff map:

```diff
agent-service.ts
- private children = new Set<ChildProcess>();
+ private children = new Set<ChildProcess>();
+ private childrenByBinding = new Map<number, ChildProcess>();
+ cancelTurn(bindingId: number): boolean

gateway-commands.ts
+ command /stop -> agentService.cancelTurn(bindingId)
```

### `/retry`

Behavior:

```text
load last job prompt for binding
enqueue it again through AgentService.handleIncoming()
```

Diff map:

```diff
db.ts
  listJobs(bindingId, limit) already exists

gateway-commands.ts
+ command /retry -> db.listJobs(bindingId, 1) -> agentService.handleIncoming()
```

### `/status`

Behavior:

```text
reply with channel, chat/session key, binding status, model, effort, cwd,
thread_id short id, queue status if available, last job result/error summary
```

Diff map:

```diff
gateway-commands.ts
+ command /status -> db.getBinding() + db.listJobs(bindingId, 1)

telegram-adapter.ts
+ render as rich HTML table/list

discord-adapter.ts
+ render as embed using buildStatusEmbed()
```

### `/help`

Behavior:

```text
list available bridge commands
include platform-native hints (Telegram menu, Discord slash command palette)
```

Diff map:

```diff
gateway-commands.ts
+ command /help -> GATEWAY_COMMANDS.map(...)

telegram-commands.ts
+ registerTelegramCommands(api) includes same names/descriptions

discord-commands.ts
+ COMMANDS mirrors GATEWAY_COMMANDS where Discord supports native slash command
```

## Platform Attachment

Telegram:

```diff
telegram-adapter.ts
+ parseCommand(text)
+ dispatchGatewayCommand()
+ if result.telegramKeyboard -> api.sendMessageWithKeyboard()
+ else -> api.sendMessage()

telegram-api.ts
  sendMessageWithKeyboard() already exists
  answerCallbackQuery() already exists
  setMyCommands() already exists
```

Discord:

```diff
discord-gateway.ts
+ onInteraction?: (interaction: Interaction) => void
+ INTERACTION_CREATE dispatch

discord-commands.ts
+ registerGlobalCommands(api, applicationId)

discord-interactions.ts
+ handleInteraction() -> dispatchGatewayCommand()

discord-adapter.ts
+ start(): get application id from getMe(), register commands, wire interaction callback
```

## Compatibility Rule

Plain messages still go to Codex as prompts.

Only recognized bridge commands are intercepted:

```text
/new /model /effort /cwd /stop /retry /status /help
```

Unknown slash-looking text should get a short bridge help response rather than
silently becoming a Codex prompt. This avoids accidental prompt confusion while
keeping ordinary natural-language messages unchanged.

## Acceptance

1. Telegram `/model` opens an inline model picker and updates the next turn's
   model.
2. Discord `/model` opens a select menu or autocomplete-backed command and
   updates the next turn's model.
3. `/cwd` changes binding workdir and clears `thread_id`.
4. `/stop` terminates an active child process for the binding.
5. `/retry` replays the last prompt through the regular queue.
6. `/status` reports binding state without invoking Codex.
7. No command requires a Codex TUI PTY.
