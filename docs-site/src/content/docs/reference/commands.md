---
title: Commands
description: Every cxc / codexclaw command — live commands and the orchestrate sub-grammar.
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
| `cxc metric <verb>` | pabcd-state | Record/show true-objective metrics for emergence-harness loops. |
| `cxc divergence <verb>` | pabcd-state | Record divergence mode and grounded candidate archive entries. |
| `cxc freeze` | pabcd-state | Freeze the interview plan and surface the goal-activation handoff. |
| `cxc goalplan <verb>` | pabcd-state | Init, show, or validate the project-local goalplan substrate. |
| `cxc gui` | gui | Start the local dashboard (Vite). |
| `cxc subagents` | subagent-config | Read/write per-role subagent model and prompt config. |
| `cxc provider` | provider-bridge | Show read-only opencodex (`ocx`) provider status (detect mode). |
| `cxc chat search` / `cxc chat index` | recall | Search or index read-only Codex rollout history under `CODEX_HOME` / `~/.codex`. |
| `cxc memory search` | recall | Search read-only Codex memory artifacts under `CODEX_HOME` / `~/.codex`. |
| `cxc serve` | messenger-bridge | Start the opt-in loopback dashboard/API/messenger bridge on `127.0.0.1`. |
| `cxc service` | messenger-bridge | Install, uninstall, or inspect the macOS launchd service for `cxc serve`. |

:::note
The former hyphenated `chat-search` wrapper is not a live command. Recall is exposed as
`cxc chat search`, `cxc chat index`, and `cxc memory search`.
:::

## reset sub-grammar

```
cxc reset [--state|--generated|--goalplans|--all]
```

## orchestrate sub-grammar

```
cxc orchestrate <I|P|A|B|C|D|status|reset> [--session <id>] [--cwd <path>] [--json] [--attest '<json>']
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

## metric sub-grammar

```
cxc metric record --session <id> --name <metric> --value <number> [--source operator-entered|evaluate.sh] [--work-phase <id>] [--json]
cxc metric ingest --session <id> [--source evaluate.sh] [--work-phase <id>] [--json] < output.txt
cxc metric show --session <id> [--json]
cxc metric kind --session <id> [satisfy|maximize] [--json]
```

`metric ingest` reads `METRIC name=value` lines from stdin. Remote judge scores are
operator-entered; local harness output should use `source=evaluate.sh`.

## divergence sub-grammar

```
cxc divergence mode --session <id> on|off [--cwd <owner-root>] [--collapse P|D] [--reason <text>]
cxc divergence candidate add --session <id> [--cwd <owner-root>] --kind strong-1|add-1|alternative --title <text> --rationale <text> --source <url> [--source <url>...]
cxc divergence candidate list --session <id> [--cwd <owner-root>] [--json]
```

Use `--cwd <owner-root>` when recording from a child worktree so the owner worktree
keeps the single candidate archive.

`candidate add` also accepts `--status proposed|built|checked|kept|discarded`,
`--change-class parameter-tweak|branch-toggle|state-space-redesign|evaluator-change`,
`--killed-at-phase P|A|B|C|D`, `--worktree <path>`, and `--json`.

## freeze sub-grammar

```
cxc freeze [--dry-run] [--cwd <path>] [--session <id>]
```

## goalplan sub-grammar

```
cxc goalplan init --objective "<text>" [--criterion "<text>"...] [--session <id>] [--cwd <path>]
cxc goalplan show --slug "<text>" [--cwd <path>]
cxc goalplan validate --slug "<text>" [--cwd <path>]
```

`show` and `validate` also accept `--objective "<text>"` instead of `--slug`.

## recall sub-grammar

```
cxc chat search "<query>" [--days N] [--cwd PATH] [--role user|assistant|tool] [--source main|subagent|all]
                         [--limit N] [--context N] [--any] [--all] [--no-tools]
                         [--scan] [--no-refresh] [--json] [--full] [--home PATH]
cxc chat index [--rebuild] [--status] [--json] [--home PATH] [--index-path PATH]
cxc memory search "<query>" [--days N] [--limit N] [--any] [--json] [--home PATH]
```

Recall commands are read-only against Codex data. `cxc chat index` writes only the derived
codexclaw sidecar index.

## subagents sub-grammar

```
cxc subagents
cxc subagents get <explorer|reviewer|executor>
cxc subagents set <explorer|reviewer|executor> --mode default|model [--model <id>] [--prompt <text>|--clear-prompt]
```

## serve / service sub-grammar

```
cxc serve [--port <n>] [--cwd <path>]
cxc service install [--port <n>]
cxc service uninstall
cxc service status
```

`serve` / `service` are the messenger bridge's opt-in loopback surface: a local
`127.0.0.1` dashboard/API server plus messenger adapters that relay to stock `codex exec`.
They are not an external orchestrator server.
