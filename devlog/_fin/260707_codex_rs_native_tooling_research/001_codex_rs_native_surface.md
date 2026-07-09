# 001 - Codex-rs Native Surface and Non-Native Tool Combinations

## Summary

Codexclaw already rides Codex-native hooks, native subagents, host goals, and plugin packaging, but several combinations still feel like adapter stacks rather than native surfaces. The strongest native direction is not to create another server. It is to move more Codexclaw semantics into Codex-rs surfaces that already exist: hook events, extension registries, thread/agent graph stores, MCP session tools, and structured event ledgers.

## Codex-rs Surfaces Found

### Extension contributor registry

The strongest native attachment point found is the extension API, not the MCP server wrapper. `ext/extension-api/src/contributors.rs` defines contributors for MCP servers, context, thread lifecycle, turn lifecycle, turn input, config, token usage, native tools, tool lifecycle, approval review, and turn-item post-processing (`contributors.rs:51-69`, `contributors.rs:76-111`, `contributors.rs:113-210`, `contributors.rs:213-285`, `contributors.rs:287-299`).

`ExtensionRegistryBuilder` registers these contribution types explicitly (`registry.rs:74-130`) and returns an immutable registry with all contributor vectors (`registry.rs:132-164`).

Candidate attachment:

- A real Codexclaw native integration should first investigate an extension with `ToolContributor`, `ToolLifecycleContributor`, `ContextContributor`, `TurnLifecycleContributor`, `TurnInputContributor`, and `ApprovalReviewContributor`.
- Tool lifecycle contributors are observational by design; the comments say they observe tool execution without inspecting or rewriting input/output and point to `ToolContributor` or hooks for stronger behavior (`contributors.rs:260-265`).
- This is the cleanest path for Codexclaw skills/search/goal/approval behavior to become host-owned without inventing another daemon.

Risk:

- The inspected MCP server path still constructs `ThreadManager` with `empty_extension_registry()`, so this is a native Codex-rs architecture target, not proof that the MCP path already loads Codexclaw-like extensions.

### MCP session surface

`mcp-server/src/message_processor.rs` constructs a `ThreadManager` with `SessionSource::Mcp`, an `EnvironmentManager`, a thread store, and a local agent graph store (`message_processor.rs:69-80`). It advertises MCP tools only (`enable_tools`, `enable_tool_list_changed`) at `message_processor.rs:249-252`.

The server exposes two tools today: `codex` and `codex-reply` (`message_processor.rs:313-324`, `message_processor.rs:337-349`). It explicitly returns unsupported responses for MCP task methods such as `tasks/get_info`, `tasks/list`, `tasks/get_result`, and `tasks/cancel` (`message_processor.rs:136-150`, `message_processor.rs:499-509`).

Candidate attachment:

- Codexclaw loopback/messenger work should prefer this structured `codex` / `codex-reply` MCP lane where possible instead of shelling through stock `codex exec`.
- The gap is task lifecycle: Codexclaw's subagent coordination wants task/list/cancel semantics, but this MCP server currently rejects those task methods.

### Codex tool configuration surface

`CodexToolCallParam` accepts prompt, model, cwd, approval policy, sandbox mode, config overrides, base instructions, developer instructions, and compact prompt (`codex_tool_config.rs:21-63`). `into_config()` turns those into `ConfigOverrides` and `ConfigBuilder` harness overrides (`codex_tool_config.rs:141-188`).

Candidate attachment:

- Codexclaw could encode more run-shaping intent in native config fields rather than carrying it in prompt prose. Examples: role model, cwd, approval policy, sandbox, compact prompt.
- Do not overuse this for workflow semantics. PABCD phase state still belongs in `.codexclaw/sessions/` until Codex exposes a first-class workflow state API.

### Event streaming and approval surface

`codex_tool_runner.rs` starts a Codex thread, emits `SessionConfigured` as an MCP notification, inserts the MCP request id into the thread map, submits user input, and streams events until completion (`codex_tool_runner.rs:57-140`, `codex_tool_runner.rs:194-320`).

It forwards exec approval requests through MCP elicitation (`codex_tool_runner.rs:218-251`), and `exec_approval.rs` serializes command, cwd, parsed command, thread id, tool call id, event id, and call id into an `elicitation/create` request (`exec_approval.rs:17-39`, `exec_approval.rs:64-99`). Approval responses are translated back into `Op::ExecApproval` (`exec_approval.rs:112-147`).

Candidate attachment:

- Codexclaw's approval-like and user-question surfaces should map to Codex/MCP elicitation when the host supports it.
- This is stronger than parsing assistant prose or terminal prompts because the event has explicit ids and decision payloads.

### Hook event surface

Codex-rs hook code includes `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `Stop`, `SubagentStart`, and `SubagentStop` paths in the hook engine and schemas (`hooks/src/engine/mod.rs:66-75`, `hooks/src/engine/schema_loader.rs:19-23`).

`SessionStart` and `SubagentStart` share output handling, but only `SessionStart` honors `continue:false`; `SubagentStart` is context-injection only (`hooks/src/events/session_start.rs:211-216`). `SubagentStart` receives `agent_id`, `agent_type`, and `turn_id` in its input (`hooks/src/events/session_start.rs:151-180`).

`Stop` and `SubagentStop` share handling. `SubagentStop` receives `agent_id`, `agent_type`, `agent_transcript_path`, `turn_id`, and `last_assistant_message` (`hooks/src/events/stop.rs:23-43`, `hooks/src/events/stop.rs:144-164`). A block decision needs a non-empty reason (`hooks/src/events/stop.rs:263-287`).

Candidate attachment:

- Codexclaw's spawn skill attachment can eventually move from message-prefix rewriting toward `SubagentStart` context injection if the hook payload can reliably add structured skill attachments.
- Codexclaw's subagent evidence gate is correctly aligned with `SubagentStop`, because the native event gives an agent id and transcript path.

### Extension surface

The `ext/` tree contains first-party extension crates for connectors, MCP, goal, guardian, image generation, memories, skills, and web search. The file list includes:

- `ext/goal/src/{api,events,extension,runtime,spec,steering,tool}.rs`
- `ext/memories/src/{backend,extension,local,metrics,prompts,schema}.rs`
- `ext/skills/src/{catalog,config,extension,fragments,provider,render,selection,state,world_state}.rs`
- `ext/web-search/src/{extension,history,output,schema,tool}.rs`
- `ext/mcp/src/executor_plugin.rs`

However, the MCP server currently constructs `ThreadManager` with `empty_extension_registry()` (`message_processor.rs:69-75`).

Candidate attachment:

- If Codexclaw becomes a deeper Codex-rs integration, the extension registry is the cleanest long-term home for skills, search, memory, and goal behavior.
- The immediate blocker is that the observed MCP server path does not load those extensions.

### Core tool runtime and tool search surface

`CoreToolRuntime` is the typed runtime contract for locally executed tools, with metadata hooks for telemetry, tool search, pre/post tool-use payloads, and argument rewrites (`core/src/tools/registry.rs:44-140`). Tool dispatch notifies tool lifecycle contributors before running hooks (`core/src/tools/registry.rs:493-530`).

The tool plan builds model-visible specs from runtimes while deduping names (`core/src/tools/spec_plan.rs:235-260`), adds direct/deferred MCP tools (`spec_plan.rs:885-909`), dynamic tools (`spec_plan.rs:916-945`), extension tools (`spec_plan.rs:953-960`), and a `tool_search` executor over deferred tools (`spec_plan.rs:963-980`).

Candidate attachment:

- Codexclaw commands that are currently CLI-only could become namespaced native tools or deferred tools.
- `tool_search` should remain the discovery path for deferred Codexclaw tools, but names need stable namespace ownership to avoid collisions.

## Non-Native Combinations Worth Replacing

| Current combination | Why it is non-native | More native target | Evidence |
|---|---|---|---|
| Codexclaw CLI/MCP wrappers around workflow commands | The wrapper works, but it leaves tool ownership outside Codex-rs tool planning. | Extension `ToolContributor` or deferred native tools with `tool_search` metadata. | `ext/extension-api/src/contributors.rs:250-258`; `core/src/tools/spec_plan.rs:953-980` |
| Hook-only observation for tool lifecycle | Hooks can deny/rewrite, but lifecycle state is not a typed contributor. | `ToolLifecycleContributor` for observation plus hooks/owned tools only where policy needs payload control. | `ext/extension-api/src/contributors.rs:260-265`; `core/src/tools/registry.rs:493-530` |
| `tool_search` -> `multi_agent_v1.spawn_agent` -> message prefix skill mentions | Deferred discovery plus prompt-channel injection is robust but indirect. | First-class spawn skill attachments, or `SubagentStart` hook context with structured attachment support. | `structure/60_native_capabilities.md:24-41`; `structure/10_subagent_skill_routing.md:103-116`; `hooks/src/events/session_start.rs:151-216` |
| `SubagentStop` transcript/receipt checks in Codexclaw | Codexclaw scans receipts because completion proof is outside the spawn API. | Native subagent completion event with evidence artifact fields. | `plugins/codexclaw/components/pabcd-state/src/subagent-evidence.ts:68-170`; `hooks/src/events/stop.rs:144-199` |
| `agbrowse` HTTP proof plus browser plugin fallback | The proof ladder is useful, but it sits outside Codex-rs web-search extension. | Codex-rs `ext/web-search` plus a source-open proof mode with evidence envelope. | `plugins/codexclaw/skills/search/SKILL.md:37-86`; `ext/web-search/src/extension.rs:117-130`; `ext/web-search/src/tool.rs:42-76`, `:95-122` |
| Host goal via Codex goal DB plus `.codexclaw/goalplans` | Goal state and goalplan state are separate stores. | Codex-rs `ext/goal` extension or a read-only goal API that exposes lifecycle and criteria. | `plugins/codexclaw/skills/loop/SKILL.md:142-151`; `ext/goal/src/extension.rs:98-136`, `:406-447`; `ext/goal/src/tool.rs:145-147` |
| Messenger bridge shelling to Codex turns | Useful product surface, but it is a local bridge around stock Codex. | Codex MCP `codex` / `codex-reply`, app-server thread APIs, or a Codex-rs event API. | `mcp-server/src/message_processor.rs:313-349`; `structure/INDEX.md:112` |
| Recall over rollout JSONL and sidecar index | Fast and practical, but it reverse-engineers durable session artifacts. | Codex-rs message-history or app-server search API exposed to plugin tools. | `structure/INDEX.md:116-118`; `message-history/src/lib.rs` |
| Manual source-of-truth sync warnings | Current hooks can warn, deny, or rewrite, but not attach semantic doc-refresh obligations to a native task record. | Native event ledger with doc-refresh obligation events. | `structure/40_enforcement_methods.md:22-61`; `runtime-command-event-snapshot-schema.md:24-42` |

## Risks

- Do not confuse attachment with enforcement. Codexclaw can preload context or deny a tool call; it cannot force a model to choose a subagent or read a skill after launch (`structure/00_philosophy.md:36-49`).
- Do not move PABCD ownership into spawn plumbing. `subagent-config` owns spawn shaping; `pabcd-state` owns phase state and evidence gates.
- Do not write host goal DB state from Codexclaw. The loop skill says Codexclaw reads the native goal DB as a gate and the main session owns `create_goal` / `update_goal`.
- Treat `ext/*` as a promising upstream surface, not proof that plugin-level extension APIs are currently available in this local runtime.
- Distinguish stale OMX docs from current Codex-rs evidence. Older OMX docs described `SubagentStop` as not supported in that product mapping; the inspected Codex-rs snapshot contains `SubagentStop` hook code and schemas.
