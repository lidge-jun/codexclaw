# messenger_bridge — Research: embedding Codex in a chat bridge

Status: research snapshot 2026-07-02/03 (web + local code reading)

## Official Codex embedding interfaces (not exec-only)

| Interface | Mechanism | Session continuity | Bot fit |
| --- | --- | --- | --- |
| `codex exec --json` | one process per turn, JSONL events on stdout (`thread.started` carries thread_id; `item.*`; `turn.completed`) | `codex exec resume --last` / `codex exec resume <SESSION_ID>` | chosen — stateless, crash-safe, shares `~/.codex` rollouts with interactive codex |
| `codex app-server` | resident JSON-RPC 2.0 server (stdio JSONL default) | `thread/start` / `thread/resume` / `turn/start` | rejected — resident-process lifecycle ownership conflicts with codexclaw no-harness philosophy |
| `codex mcp-server` | Codex exposed as MCP tools | `codex` tool starts, `codex-reply` continues via threadId | only if orchestrator is MCP-native |
| `@openai/codex-sdk` (npm, TS) | SDK; Python variant drives app-server over JSON-RPC | `startThread()` → `thread.run()` repeated, `resumeThread(threadId)` | good generally, but adds SDK dependency; exec CLI is sufficient here |

Sources (checked 2026-07-02):
- https://developers.openai.com/codex/noninteractive
- https://developers.openai.com/codex/app-server
- https://developers.openai.com/codex/sdk
- https://developers.openai.com/codex/guides/agents-sdk

## Existing open-source bridges (prior art)

- telegram-codex-app-bridge — app-server bridge; sticky chat/topic→thread binding. https://github.com/Gan-Xing/telegram-codex-app-bridge
- codex-telegram — spawns non-interactive `codex exec`; per user/project-dir session persistence. https://github.com/yschaub/codex-telegram
- claude-code-telegram — Claude Code SDK primary, CLI fallback. https://github.com/RichardAtCT/claude-code-telegram
- claudegram — Claude Agent SDK + grammY; per-chat/forum-topic session manager, /resume /continue. https://github.com/NachoSEO/claudegram
- cc-telegram — task-runner style, persists task queue as JSON, no continuous chat session. https://github.com/hada0127/cc-telegram

## OpenClaw architecture (UX/topology reference)

Central Gateway routes Telegram (grammY/Bot API) and Discord (Bot API + Gateway)
into the agent runtime; same control plane serves CLI/Web UI. Backend pluggability
for arbitrary CLI agents unverified in docs.
Sources (checked 2026-07-02): https://docs.openclaw.ai · https://docs.openclaw.ai/channels

## cli-jaw local findings (reference implementation)

- `src/telegram/bot.ts` (730 lines): grammY long polling; `sequentialize` per
  chat; allowedChatIds allowlist middleware; group @mention gating; typing
  indicator refresh loop; live tool-status via single edited status message;
  busy → queue with "queued" reply and requestId-scoped listener; HTML output
  chunking with plain-text fallback; 409-conflict retry with backoff.
- `src/agent/args.ts:210-231` codex new turn: `exec -m <model> -c ... --json`
  (+ spark context pinning); `args.ts:345-357` resume:
  `exec resume <sessionId> <prompt> --json`.
- `src/agent/codex-app-client.ts` + `spawn.ts:1644`: cli-jaw ALSO has a
  `codex-app` mode (`codex app-server --listen stdio://`) — proof both paths
  work; codexclaw takes only the exec path.
- Session bucketing per model family (`args.ts:125-135`) prevents cross-model
  resume failures (spark ↔ gpt-5.x) — worth replicating if model switching
  is allowed per agent.
- Weak point to avoid: cli-jaw's global "one main session + queue" model
  serializes unrelated chats; codexclaw should serialize per agent/thread only.

## codexclaw local seams (where the bridge plugs in)

- `bin/codexclaw.mjs`: thin delegator over compiled component CLIs — add
  `serve` (and later `service`) subcommands here.
- `plugins/codexclaw/components/`: component-per-feature (src + dist + test)
  convention — bridge lands as a new component (e.g. `messenger-bridge`).
- `plugins/codexclaw/gui/`: Vite + React, pages/Subagents.tsx only; server
  handlers in `gui/src/server/handlers.ts`. GUI reads/writes only through
  codexclaw endpoints (api.ts header comment).
- recall component already reads `~/.codex` rollouts (chat/memory search) —
  session listing for agent management can reuse it.
