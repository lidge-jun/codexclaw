# PoC Plan: minimal elicitation MCP server

Status: TODO (optional verification)
Goal: prove a single-select choice prompt renders in the live codex TUI and the pick returns.

## Steps
1. Write a tiny MCP server (node, stdio) exposing one tool, e.g. `ask_choice`.
2. On tool call, send an `elicitation/create` Form request:
   - `message`: the question.
   - `requestedSchema`: one property of type enum with titled options
     (`anyOf: [{const, title}, ...]`).
3. Register it (prefer plugin `.mcp.json`, or `codex mcp add` for a throwaway PoC; remove after).
4. Run under a policy that is NOT `Never` (e.g. OnRequest), call the tool, confirm:
   - TUI shows a numbered selector.
   - Selecting an option returns `{ action: "accept", content: { <field>: <const> } }`.
5. Capture the exact request/response JSON into 000_findings (resolves Q-E2/Q-E3).

## Notes
- If policy is `Never`, expect auto-Decline (document, don't debug as a failure).
- Clean up: remove the PoC server registration; never leave config.toml mutated.
