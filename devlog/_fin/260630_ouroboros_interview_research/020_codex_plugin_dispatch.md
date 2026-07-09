# 020 — Ouroboros Codex Plugin Integration & Subagent Dispatch

> Source clone (gitignored): `.ouroboros/` inside this research folder.
> All citations use paths relative to the clone root.

## 1. How Ouroboros Integrates with Codex

Ouroboros integrates with Codex CLI through **three parallel config surfaces** that all point to the same MCP server:

### 1a. MCP Server Configuration

**`.mcp.json`** (runtime-agnostic, used by Claude Code and any MCP-aware host):
```json
{
  "mcpServers": {
    "ouroboros": {
      "command": "uvx",
      "args": ["--from", "ouroboros-ai[mcp,claude]", "ouroboros", "mcp", "serve"]
    }
  }
}
```
Source: `.mcp.json:1-7`.

**`.codex/config.toml`** (Codex CLI-specific):
```toml
[mcp_servers.ouroboros]
command = "uvx"
args = ["--from", "ouroboros-ai[mcp,claude]", "ouroboros", "mcp", "serve"]
```
Source: `.codex/config.toml:1-7`.

Both define the same MCP server: a **separate Python process** launched via `uvx` that runs `ouroboros mcp serve`. This is a **stdio MCP server** — the host (Codex) communicates with it over stdin/stdout using the Model Context Protocol.

**`.claude-plugin/plugin.json`** ties the skills and MCP together:
```json
{
  "name": "ouroboros",
  "version": "0.43.3",
  "skills": "./skills/",
  "mcpServers": "./.mcp.json"
}
```
Source: `.claude-plugin/plugin.json:1-22`.

### 1b. Hooks

**`.codex/hooks.json`** — Codex-specific hooks:
- `PostToolUse` (matcher: `Write|Edit`): runs `scripts/drift-monitor.py` (3s timeout) — monitors whether execution diverges from seed spec.
- `UserPromptSubmit` (matcher: `*`): runs `scripts/keyword-detector.py` (5s timeout) — detects ouroboros trigger keywords.

Source: `.codex/hooks.json:1-25`.

**`hooks/hooks.json`** — Claude-format hooks (same scripts plus SessionStart):
- `SessionStart`: runs `scripts/session-start.py` (5s timeout).
- `UserPromptSubmit`: runs `scripts/keyword-detector.py`.
- `PostToolUse` (matcher: `Write|Edit`): runs `scripts/drift-monitor.py`.

Source: `hooks/hooks.json:1-27`.

### 1c. Skills → Commands → MCP Tools

The dispatch chain for Codex is:

1. User types `ooo interview [topic]` or a trigger keyword is detected.
2. Codex reads `commands/interview.md` which says: "Read the file at `${CLAUDE_PLUGIN_ROOT}/skills/interview/SKILL.md` using the Read tool and follow its instructions exactly." (`commands/interview.md:1-7`).
3. The SKILL.md instructs the main session to load the MCP tool via tool discovery: `tool discovery query: "+ouroboros interview"` (`skills/interview/SKILL.md` Step 0.5).
4. The MCP tool `ouroboros_interview` (running in the separate Python process) handles interview state and question generation.
5. The main session (Codex) is the answerer/router between MCP and the user.

## 2. Is Interview Owned by an MCP Server or In-Process?

### ⭐ The interview is MCP-owned (out-of-process), but with a critical in-process fallback

**Path A (MCP Mode — preferred)**: The interview is owned by the **MCP server** (`ouroboros_interview` tool). The MCP server:
- Is a **separate process** (`uvx ... ouroboros mcp serve`).
- Generates Socratic questions, manages interview state, scores ambiguity.
- Does NOT read code, browse the web, or execute tools — it is a pure question generator.
- Persists state to disk (session state → EventStore).

Source: `skills/interview/SKILL.md` Path A architecture section.

**Path B (Plugin Fallback — no MCP server)**: When the MCP tool is unavailable, the interview falls back to **in-process agent-based mode**:
- Reads `src/ouroboros/agents/socratic-interviewer.md` and adopts that role.
- Interview results live in **conversation context** (not persisted).
- Uses the host runtime's `inspect_code` and `web_research` capabilities directly.

Source: `skills/interview/SKILL.md` Path B section.

### The runtime semantics distinction

The `docs/auto-runtime-semantics.md` document clarifies a crucial point about `ooo auto`:

| Phase | What runs | Where it runs |
|-------|-----------|---------------|
| `INTERVIEW` | `InterviewHandler` | **In-process** authoring handler (same Python process as `ooo auto`) |
| `SEED_GENERATION` | `GenerateSeedHandler` | **In-process** authoring handler |
| `REVIEW`/`REPAIR` | `SeedReviewer` + `SeedRepairer` | In-process; backend choice forwarded |
| `RUN` (handoff) | `StartExecuteSeedHandler` | Dispatches to configured runtime; for opencode plugin mode this is subagent dispatch |

Source: `docs/auto-runtime-semantics.md` phase × backend matrix.

**Key distinction**: When running `ooo auto` (the full pipeline), the interview runs **in-process** within the Python auto-pipeline — it talks TO the configured backend (e.g., Codex) for LLM calls, but the interview handler itself is in the same Python process. When running `ooo interview` as a standalone skill, the interview is **MCP-owned** (out-of-process).

The `--runtime codex` flag "does NOT mean Codex picks up the entire pipeline as a single subagent task. The first interview question is still generated in-process by the authoring handler that talks to Codex." (`docs/auto-runtime-semantics.md` "What the flag does NOT mean" section).

## 3. Subagent Fan-Out / Parallel Worker Dispatch

### 3a. The central dispatch helper

`src/ouroboros/mcp/tools/subagent.py` (2244 lines) is the central subagent dispatch system. Its architecture (from the module docstring, `subagent.py:1-31`):

```
Handler.handle(args)
    → build_*_subagent(args)       # tool-specific builder
    → build_subagent_result(payload)  # wraps in MCPToolResult
    → MCPToolResult(meta={"_subagent": {...}})
        ↓ (MCP transport)
    Bridge plugin reads meta._subagent
        → injects SubtaskPart into parent session
        → host spawns child session with parentID
        → subagent executes prompt, result flows back
```

The `_subagent` payload structure (`subagent.py:19-30`):
```json
{
  "_subagent": {
    "tool_name": "str",
    "title": "str",
    "agent": "str",
    "prompt": "str",
    "model": "str|null",
    "context": "dict",
    "timeout": "dict|null"
  }
}
```

### 3b. Three dispatch modes

`src/ouroboros/backends/capabilities.py:58-77` defines `SubagentDispatchMode(StrEnum)`:

| Mode | Value | Mechanism |
|------|-------|-----------|
| `PLUGIN_PASSIVE` | `"plugin_passive"` | A passive bridge receiver (OpenCode plugin) auto-intercepts the `_subagents` envelope and spawns children. Handler returns the envelope and skips real in-process work. |
| `HOST_DRIVEN` | `"host_driven"` | No passive receiver, but the host model spawns subagents from inline payloads via its own native primitive (e.g., Codex Desktop's multi-agent spawn). Handler returns inline result + `dispatch_mode=host_driven` / `host_action` stamp. |
| `SEQUENTIAL` | `"sequential"` | Neither passive receiver nor native parallel primitive available. Handler runs in-process/inline sequential path. |

Source: `src/ouroboros/backends/capabilities.py:58-77`.

### 3c. Spawn trigger mechanisms

`src/ouroboros/backends/capabilities.py:80-86` defines `SubagentSpawnTriggerMechanism(StrEnum)`:

| Mechanism | Value |
|-----------|-------|
| `PASSIVE_BRIDGE_ENVELOPE` | `"passive_bridge_envelope"` |
| `CODEX_NATURAL_LANGUAGE_DELEGATION` | `"codex_natural_language_delegation"` |
| `CLAUDE_TASK_AGENT_TOOL` | `"claude_task_agent_tool"` |
| `SEQUENTIAL_FALLBACK` | `"sequential_fallback"` |

### 3d. ⭐ Codex-specific dispatch configuration

The Codex backend capability (`src/ouroboros/backends/capabilities.py:324-341`):

```python
BackendCapability(
    name="codex",
    aliases=("codex_cli",),
    supports_runtime=True,
    supports_llm=True,
    supports_interview_driver=True,
    switchable_runtime=True,
    cli_name="codex",
    cli_config_key="codex_cli_path",
    skill_execution_capabilities=_CODEX_SKILL_EXECUTION_CAPABILITIES,
    supports_host_driven_subagents=True,
    host_driven_subagent_mechanism=(
        SubagentSpawnTriggerMechanism.CODEX_NATURAL_LANGUAGE_DELEGATION
    ),
    host_driven_subagent_requires_explicit_request=True,
    host_driven_callable_spawn_tool_name=None,       # ← NO callable tool
    prohibited_subagent_spawn_tool_names=("multi_agent_v1.spawn_agent",),  # ← PROHIBITED
)
```

**Critical findings for codexclaw**:

1. **Codex uses HOST_DRIVEN dispatch** (`supports_host_driven_subagents=True`) — the host model spawns subagents from inline payloads, not via a passive bridge.

2. **Codex's spawn mechanism is `CODEX_NATURAL_LANGUAGE_DELEGATION`** — subagents are triggered by **explicit natural-language delegation**, not by a callable tool name. The `orchestrate_subagents` capability guidance says: "Codex subagents are triggered by an explicit natural-language delegation, not by a callable tool name: explicitly spawn one Codex subagent per payload, give each child the payload's `prompt`, wait for all children, then summarize the results." (`src/ouroboros/backends/capabilities.py:202-223`).

3. **`host_driven_callable_spawn_tool_name=None`** — Codex has NO callable spawn tool. This contrasts with Claude Code which has `host_driven_callable_spawn_tool_name="Task/Agent"` (`capabilities.py:319-322`).

4. **⭐ `prohibited_subagent_spawn_tool_names=("multi_agent_v1.spawn_agent",)`** — Ouroboros **explicitly PROHIBITS** `multi_agent_v1.spawn_agent` for Codex. This is the exact tool that codexclaw plans to use. Ouroboros deliberately blocks it in favor of natural-language delegation.

### 3e. Interview advisory fanout

`build_interview_question_advisory_subagents` (`src/ouroboros/mcp/tools/subagent.py:1243-1401`) builds per-lane advisory subagents. For Codex, the interview SKILL.md says:

> "In Codex, explicitly start a native subagent workflow in natural language: spawn one Codex subagent per lane, pass that lane's payload prompt, wait for all agents, then synthesize. Only fall back to the request's `sequential_fallback` semantics when the host has no subagent mechanism at all."

Source: `skills/interview/SKILL.md` "Question-first advisory fanout" section.

Each advisory subagent returns a compact JSON object (`subagent.py:1366-1375`):
```json
{
  "lane_id": "str",
  "finding": "single most useful advisory finding",
  "evidence": ["file paths", "source URLs", "reasoning anchors"],
  "suggested_options": ["up to 3 answer options"],
  "unresolved_ambiguities": ["what the human still must decide"]
}
```

### 3f. Lateral multi-subagent fanout

`build_lateral_multi_subagent` (`src/ouroboros/mcp/tools/subagent.py:1782-1900`) builds N subagent payloads — one per lateral-thinking persona. Each payload runs in a truly parallel independent LLM context with no anchoring bias (`subagent.py:1789-1792`). The subagent prompt instructs each persona to produce:
1. A concrete alternative plan (3-5 bullet steps).
2. The single biggest assumption it challenges.
3. A one-line verdict: would this plan work? why/why not?

Source: `src/ouroboros/mcp/tools/subagent.py:1867-1878`.

### 3g. Other subagent builders

The file defines 12 builder functions (`subagent.py:619-1990`):
- `build_interview_subagent` (line 1121)
- `build_interview_question_advisory_subagents` (line 1243)
- `build_generate_seed_subagent` (line 1404)
- `build_qa_subagent` (line 1029)
- `build_evaluate_subagent` (line 1473)
- `build_execute_subagent` (line 1544)
- `build_pm_interview_subagent` (line 1614)
- `build_lateral_multi_subagent` (line 1782)
- `build_evolve_subagent` (line 1903)
- `build_ralph_subagent` (line 1990)
- `build_multi_subagent_result` (line 1732)

## 4. Contrast with Codexclaw's Plan

### Ouroboros model (MCP-mediated)

```
User → Codex (main session) → MCP Server (separate process)
                                ↓
                           ouroboros_interview tool
                                ↓
                           Returns questions/advisory payloads
                                ↓
                           Codex spawns subagents via natural-language delegation
                           (NOT via multi_agent_v1.spawn_agent — prohibited)
                                ↓
                           Subagent results → synthesize → answer to MCP
```

### Codexclaw's planned model (codex-native, no MCP)

```
User → Codex (main agent) → spawn_agent (codex-native, no MCP server)
                                ↓
                           Subagents output CONTRADICTIONS ONLY
                                ↓
                           Main agent synthesizes → asks user question
                                ↓
                           Main agent edits plan/devlog directly
                                ↓
                           Main agent re-questions (loop)
```

### Key contrasts

| Dimension | Ouroboros | Codexclaw (planned) |
|-----------|-----------|---------------------|
| MCP server | Required (separate `uvx` process) | None — codex-native only |
| Interview state | MCP server persists to EventStore (SQLite) | Main agent edits plan/devlog files directly |
| Subagent spawn | Natural-language delegation (prohibits `multi_agent_v1.spawn_agent`) | `spawn_agent` codex-native tool (no MCP) |
| Subagent output | Advisory findings, lateral plans, alternatives | **Contradictions only** — no questions, no plan edits, no user calls |
| Question generation | MCP server (pure question generator, no tools) | Main agent (reads subagent contradictions, formulates question) |
| Plan edits | Post-interview: QA Refinement Loop edits Seed YAML | During interview: main agent edits plan/devlog directly |
| Decision recording | Seed YAML + EventStore + seed-revisions audit trail | Plan/devlog files (main agent writes directly) |

### ⭐ The `multi_agent_v1.spawn_agent` prohibition

This is the most critical finding. Ouroboros explicitly prohibits `multi_agent_v1.spawn_agent` for Codex (`capabilities.py:340`). The reason is architectural: Ouroboros requires the host to spawn subagents via **natural-language delegation** so that the MCP server can control the payload structure and correlate results by `context.persona` or `context.lane_id` (`capabilities.py:215-221`).

Codexclaw's plan to use `spawn_agent` directly is the **opposite** of Ouroboros's design choice. This is a deliberate divergence: codexclaw wants to eliminate the MCP server entirely and let the main agent own the full loop, including subagent dispatch. The tradeoff is:
- **Ouroboros advantage**: MCP server provides persistent state, structured payloads, and cross-runtime portability.
- **Codexclaw advantage**: No external process, simpler deployment, main agent has full control of the loop, subagents are pure contradiction-finders (no advisory bloat).
