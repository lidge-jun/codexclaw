# 100 - Harness Gap Ledger

## Scope

This compares Codexclaw plus the inspected Codex-rs snapshot against public harness capabilities. It is not a claim about the entire Codex product roadmap. Gaps are phrased as "Codexclaw/Codex-rs should investigate" unless the local source proves absence.

## Gap Ledger

| Area | Other harness evidence | Codexclaw/Codex-rs gap | Confidence |
|---|---|---|---|
| Hook event breadth | Claude Code hooks reference lists many events beyond the common lifecycle: setup, instructions loaded, prompt expansion, message display, tool batch, permission denied, notification, task created/completed, stop failure, teammate idle, config/cwd/file/worktree changes, session end, elicitation, prompt hooks, agent hooks, and async hooks. Source: `https://code.claude.com/docs/en/hooks` | The inspected Codex-rs hook engine has strong primitives, including `PermissionRequest`, `SubagentStart`, and `SubagentStop`, but local evidence surfaced a narrower core set than the Claude Code reference. Codexclaw should track missing events before porting richer watcher logic. | Tier-2 for Claude docs; local source for Codex-rs hook set |
| Background/cloud agents | Cursor 1.0 changelog says Background Agent reached general availability for users, alongside Bugbot, Memories, Jupyter agent support, one-click MCP setup, and OAuth support. Source: `https://cursor.com/changelog/1-0` | Codexclaw has native subagents and a loopback bridge, but not a first-class cloud background-agent product with PR review handoff, memory UI, and remote run control. | Tier-2 |
| PR review integration | Cursor Bugbot automatically comments on PRs and offers a "Fix in Cursor" path from GitHub. Source: `https://cursor.com/changelog/1-0` | Codexclaw can dispatch reviewer subagents during A/C phases, but PR review is not product-integrated into GitHub comments or one-click editor fix loops. | Tier-2 |
| MCP marketplace/deeplink UX | Cursor 1.0 announced one-click MCP setup and OAuth support. Goose advertises 70+ MCP extensions and extension browsing. Sources: `https://cursor.com/changelog/1-0`, `https://goose-docs.ai/` | Codexclaw uses MCP components and tool discovery, but lacks a polished MCP marketplace/deeplink install path for its own workflows. | Tier-2 |
| Recipes / reusable workflow bundles | Goose docs present recipes as portable YAML configs with instructions, extensions, parameters, and subrecipes. Source: `https://goose-docs.ai/` | Codexclaw skills and devlog units are durable, but there is no first-class "recipe run" artifact that packages instructions, extensions, parameters, and nested recipes for replay. | Tier-2 |
| Agent UI surface | Goose advertises desktop app, CLI, API, MCP Apps with interactive UI, subagents, permissions, sandbox mode, and security reviewers. Source: `https://goose-docs.ai/` | Codexclaw has a GUI and messenger bridge, but it does not expose an app-embed UI protocol comparable to Goose MCP Apps. | Tier-2 |
| ACP / multi-agent interoperability | Goose advertises ACP server support and use of ACP agents like Claude Code and Codex as providers. Source: `https://goose-docs.ai/` | Codexclaw has OCX provider routing and subagent model config, but not an ACP-facing server role for external IDEs/agents. | Tier-2 |
| Repository customization / skills | OpenHands official docs expose repository/customization and microagent/skill API surfaces in the docs sitemap/API reference; the public repository and papers describe an agent workspace with sandbox, browser, command-line, and event-stream coordination. Sources: `https://docs.openhands.dev/`, `https://github.com/OpenHands/openhands`, `https://arxiv.org/abs/2407.16741` | Codexclaw has stronger PABCD-specific discipline, but its repo-local skill delivery still depends on Codex plugin skills plus spawn-message attachment rather than a Codex-rs extension that loads repository skills as native context/tool contributors. | Tier-2 for public docs/repo/paper |
| Always-on engineering team UX | OpenHands GitHub README describes Agent Canvas as a control center for starting conversations and automating tasks, with local/default and remote/cloud backends. Source: `https://github.com/OpenHands/openhands` | Codexclaw's bridge can run messenger agents, but there is no general always-on team canvas with backend selection, task automation, and integrated workspace archiving. | Tier-2 |
| Event-stream architecture | OpenHands papers and docs emphasize agents interacting through an event stream, command line, browsing, sandboxed execution, and agent coordination. Sources: `https://arxiv.org/abs/2407.16741`, `https://arxiv.org/abs/2511.03690` | Codexclaw has `.codexclaw/ledger.jsonl`, goalplans, and hook outputs, but not one Rust-owned semantic event stream for authority, dispatch, replay, readiness, and worker lifecycle. Existing OMX docs already point at this as the desired Rust-owned thin-adapter contract. | Tier-2 for papers; local source for contract |
| Task lifecycle APIs | MCP server code rejects task info/list/result/cancel methods as unsupported (`message_processor.rs:136-150`). | Codexclaw subagent orchestration depends on the host multi-agent tool surface and transcript/evidence receipts. A native task API would reduce reliance on deferred `tool_search` plus tool-specific lifecycle calls. | Local source |
| Extension contributor breadth | Codex-rs extension API already has typed contributors for tools, lifecycle, context, turn input, MCP servers, and approval review. | Codexclaw currently lives above those surfaces as plugin hooks, skills, MCP tools, and CLI commands. The gap is not capability absence; it is that Codexclaw has not been ported into the extension contributor registry. | Local source |

## Best Lessons From Other Harnesses

1. Event breadth matters more than another wrapper CLI. Claude Code's hook reference suggests value in granular lifecycle events.
2. Background agent UX is a product surface, not just a model capability. Cursor's launch ties remote agents, PR review, MCP setup, memories, and dashboarding together.
3. Recipes are a missing middle layer between skills and code. Goose's recipe shape is close to a replayable goalplan with parameters and extensions.
4. Interop is a strategy. Goose ACP and OpenHands backend flexibility show how external agents can become providers, not competitors.
5. Event streams should own truth. OpenHands and the existing OMX Rust contract both point away from watcher-derived truth and toward semantic events.

## Open Questions

- Which Codex-rs hook events are product-stable versus experimental in the inspected snapshot?
- Can Codex plugin manifests expose extension-like behavior beyond hooks, MCP servers, skills, and apps?
- Can native subagent start/stop hooks carry structured attachments/evidence, or only context/continuation text?
- Is Codex's app-server thread/task API intended to become public for plugin use?
