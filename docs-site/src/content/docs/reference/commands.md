---
title: Commands
description: Every cxc / codexclaw command — live, placeholder, and the orchestrate sub-grammar.
---

The `cxc` and `codexclaw` binaries are the same thin delegator over the compiled component CLIs.

## Live commands

| Command | Delegates to | Purpose |
|---|---|---|
| `cxc enable` | config-guard | Register skills, hooks, and MCP with Codex. |
| `cxc disable` / `cxc uninstall` | config-guard | Unregister the plugin. |
| `cxc status` | config-guard | Report config-guard registration status. |
| `cxc doctor` | cxc-ops | Component health plus `ocx` detection status. |
| `cxc reset` | cxc-ops | Clean up codexclaw operational state. |
| `cxc orchestrate <verb>` | pabcd-state | Drive PABCD phase state (see below). |
| `cxc gui` | gui | Start the local dashboard (Vite). |

## Placeholder commands

These parse but are not implemented yet (they print a Phase 2 notice):

| Command | Planned purpose |
|---|---|
| `cxc subagents` | Subagent model config from the terminal. |
| `cxc provider` | opencodex bridge controls from the terminal. |

:::note
`chat-search` was a former command. It was retired in L13; it is not a live `cxc` command.
:::

## orchestrate sub-grammar

```
cxc orchestrate <I|P|A|B|C|D|status|reset> [--attest '<json>']
```

| Verb | Meaning |
|---|---|
| `I` | Enter the Interview phase. |
| `P` `A` `B` `C` `D` | Advance the PABCD cycle (forward transitions need `--attest`). |
| `status` | Print the current phase and flags. |
| `reset` | Return the phase to `IDLE`. |

`status` and `reset` here are **phase-control** commands, distinct from the top-level
`cxc status` (config-guard) and `cxc reset` (cxc-ops).

### Attest shape

```jsonc
{ "from": "P", "to": "A", "did": "what you actually did this phase" }
// C -> D additionally requires:
{ "from": "C", "to": "D", "did": "...", "checkOutput": "<test/build tail>", "exitCode": 0 }
```
