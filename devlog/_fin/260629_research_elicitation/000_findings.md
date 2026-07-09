# Research: codex MCP Elicitation — how choice prompts reach the user

Date: 2026-06-29
Scope: Can a codexclaw component surface A/B/C choice prompts inside the codex runtime?
Source: `~/Developer/codex/120_codex-cli/codex-rs` (codex-cli reverse-engineering tree).

## TL;DR
- **YES — codex natively renders interactive, numbered choice selectors**, not plain text.
- The mechanism is **MCP elicitation** (`elicitation/create`), spec MCP 2025-11-25.
- The **MCP server is the requester**; the assistant/LLM cannot emit a choice fence and have
  codex render it. codexclaw must ship an MCP server that sends elicitation requests.
- **enum / single-select / multi-select choices are first-class** in the schema and render as a
  TUI selection list (`› 1. ... / 2. ...`).
- **Approval policy gates it**: `AskForApproval::Never` => elicitation is auto-declined by policy.
  So the PoC must run under a policy other than `Never` (OnRequest/OnFailure/UnlessTrusted/Granular).

## Direction of flow (critical)
```
MCP server  --elicitation/create-->  codex core  --EventMsg::ElicitationRequest-->  TUI selector  -->  user picks  -->  response back to MCP server
```
- The assistant does NOT produce the UI. Emitting JSON in an assistant message is parsed as plain
  text — codex will not turn it into a selector. (This is the key difference from the cli-jaw
  ```elicitation``` fence, which IS assistant-emitted.)

## Evidence (files)
- `codex-rs/codex-mcp/src/elicitation.rs`
  - `ElicitationRequestManager` tracks requests; surfaces them as
    `EventMsg::ElicitationRequest(ElicitationRequestEvent { server_name, id, request })`.
  - Two request kinds: `ElicitationRequest::Form { message, requested_schema }` and
    `ElicitationRequest::Url { message, url, elicitation_id }`.
  - Policy gate: `elicitation_is_rejected_by_policy(AskForApproval::Never) == true`
    (Never => Decline). Other policies pass through to the user (unless auto-accepted).
  - Auto-accept: a Form with EMPTY `properties` (a bare confirm) can be auto-accepted under an
    auto-approve policy. A schema WITH properties always surfaces to the user.
- `codex-rs/app-server-protocol/src/protocol/v2/mcp.rs`
  - `McpServerElicitationRequest::{Form, Url}` (tagged by `mode`).
  - `McpElicitationSchema { type: "object", properties: BTreeMap<String, McpElicitationPrimitiveSchema>, required }`.
  - `McpElicitationPrimitiveSchema = Enum | String | Number | Boolean` (untagged).
  - Choice types:
    - `McpElicitationSingleSelectEnumSchema` (single select).
    - Multi-select via array enum (`min_items`/`max_items` + `items`).
    - Titled options: `McpElicitationTitledEnumItems.anyOf: [McpElicitationConstOption { const, title }]`
      => value (`const`) + human label (`title`) per option (mirrors cli-jaw label/value).
    - Untitled: `McpElicitationUntitledEnumItems.enum: Vec<String>`.
  - Response: `McpServerElicitationRequestResponse { action: Accept|Decline|Cancel, content, _meta }`.
- `codex-rs/tui/src/bottom_pane/mcp_server_elicitation.rs`
  - Dedicated TUI widget. Field input kinds include `Select { options: Vec<...> }`.
  - Multi-field forms supported (`Field 1/N` header), footer `enter to submit | esc to cancel`.
  - Snapshot proof (numbered interactive selector):
    ```
    Field 1/1
    Boolean elicit MCP example: do you confirm?
    › 1. Allow                   Allow this request and continue.
      2. Allow for this session  Allow this request and remember this choice for this session.
      3. Always allow            ...
      4. Deny                    ...
      5. Cancel                  ...
    enter to submit | esc to cancel
    ```
- `codex-rs/tools/src/request_plugin_install.rs`
  - Real first-party example: codex's own "install this plugin?" prompt is built as a Form
    elicitation (`build_request_plugin_install_elicitation_request`). Proves elicitation is the
    sanctioned path for codex-side choice prompts.

## Registration (how a server gets wired)
- `~/.codex/config.toml` uses `[mcp_servers.<name>]` blocks (existing example: `node_repl`).
- CLI: `codex mcp add|list|get|remove` manage external MCP servers.
- A codexclaw plugin can also declare servers via its `.mcp.json` (`mcpServers`).

## Implications for codexclaw
1. To show choice prompts, codexclaw ships an MCP server (e.g. the `subagent-config` component)
   that issues `elicitation/create` Form requests with enum schemas.
2. Use **titled enum options** (`const` + `title`) to get value+label, matching cli-jaw UX.
3. Honor the **approval policy**: under `Never`, prompts are auto-declined — document this and
   detect it, do not silently appear broken.
4. Multi-field forms are possible (several questions in one overlay) — maps to cli-jaw's
   multi-question elicitation.
5. Phase-1 "config untouched" caveat: registering an MCP server edits config.toml (or uses the
   plugin `.mcp.json`). For a PoC, prefer the plugin `.mcp.json` path or explicit add/remove.

## Open questions
- Q-E1: Does the plugin `.mcp.json` path surface elicitation identically to a config.toml server?
  (Both feed the same core manager, but verify the wiring end-to-end.)
- Q-E2: Exact JSON wire shape of a single-select enum Form request (capture from a live PoC).
- Q-E3: How responses (`content`) are keyed back to `properties` field ids for multi-field forms.

---

## CONFIRMED (2026-06-29, live test)

### Two ways to surface the choice selector outside Plan Mode
1. **`request_user_input` tool** (the same selector seen in cli-jaw Plan Mode):
   - Plan-Mode-gated by default, BUT a feature flag opens it in Default mode:
     - flag key: `default_mode_request_user_input` (codex-rs/features/src/lib.rs)
     - comment: "Allow request_user_input in Default collaboration mode"
     - stage: `UnderDevelopment`, default_enabled: `false`.
   - Enable via config (verified: `[features]` is a `key = bool` table):
     ```toml
     [features]
     default_mode_request_user_input = true
     ```
     (equivalent to `codex --enable default_mode_request_user_input`)
   - **VERIFIED working**: with the flag on, `request_user_input` is exposed in Default mode and
     renders the numbered choice selector (same UI as Plan Mode).
   - Requires a NEW codex session to pick up the config change; the tool must be in the turn's
     available tools, then the assistant calls it (prompting can steer this).
   - Caveat: `UnderDevelopment` stage — may change/disappear across codex updates.
2. **MCP elicitation** (`tool_call_mcp_elicitation`, Stable, default ON, mode-independent) — the
   product-stable path; an MCP server issues `elicitation/create`. See the main findings above.

### DECISION (jun, 2026-06-29)
- **Interview implementation** in codexclaw will use the `request_user_input` selector via the
  `default_mode_request_user_input` flag (the confirmed path), not assistant-emitted text fences.
- **PABCD (iPABCD) implementation** will also drive its interactive prompts through this same
  `request_user_input` selector path.
- Enabled now in `~/.codex/config.toml` (`[features] default_mode_request_user_input = true`;
  backup: `config.toml.bak-default_mode_request_user_input-20260629-222710`).
- Open: reconcile with phase-1 "config untouched" — this flag is a USER-set option, not something
  codexclaw mutates automatically. codexclaw should DETECT the flag and document enabling it, not
  silently write it. (MCP elicitation remains the no-flag fallback for stability.)

### USAGE RULE (jun, 2026-06-29) — REQUIRED
- General usage: codexclaw MAY actively use `request_user_input` (the selector) whenever a real
  choice/clarification would help the user. Be proactive, not shy, in normal interactive turns.
- Goal mode: `request_user_input` is **STRICTLY FORBIDDEN** during goal-mode autonomous execution.
  Reason: goal mode self-advances without user turns; popping a selector and waiting would stall
  or strand the autonomous loop. In goal mode, decide autonomously (or pause via the goal's own
  mechanism) — never block on an interactive prompt.
- Implementation requirement: the interview/iPABCD prompt layer MUST check the current execution
  context and hard-disable `request_user_input` when a goal is active.
