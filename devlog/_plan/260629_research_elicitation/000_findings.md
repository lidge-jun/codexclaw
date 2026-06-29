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
