---
title: MCP Tools
description: The codexclaw subagent-config MCP server and its three tools.
---

codexclaw exposes one MCP server, `codexclaw-subagent-config`, for reading and writing subagent
role configuration. It is declared through the plugin manifest's `mcpServers` entry.

## Tools

### subagents_get

Read the per-role subagent config (`explorer` / `reviewer` / `executor`): `mode`, `model`,
`promptOverride`.

```jsonc
// input
{}
```

### subagents_set

Update one role's subagent config.

```jsonc
// input
{
  "role": "explorer | reviewer | executor",   // required
  "mode": "default | model",                    // "model" requires a model id
  "model": "<model id> | null",
  "promptOverride": "<string> | null"
}
```

### catalog_list

List selectable models: Codex-native entries first, then `ocx`-backed entries when `ocx` is
active.

```jsonc
// input
{}
```

## Storage

All three tools read and write `.codexclaw/subagents.json`. There is no network service; the MCP
server is a local stdio process started by Codex.

## Related

- [Subagents guide](/codexclaw/guides/subagents/) — roles and workflow.
- [State Model](/codexclaw/concepts/state-model/) — where config is stored.
