---
title: Commands
description: Every cxc / codexclaw command — live commands and the orchestrate sub-grammar.
---

The `cxc` and `codexclaw` binaries are the same thin delegator over the compiled component CLIs.
The live dispatch set is `enable`, `disable`, `uninstall`, `status`, `orchestrate`, `freeze`,
`metric`, `divergence`, `loop`, `goalplan`, `plan`, `scan`, `doctor`, `reset`, `hooks`,
`subagents`, `map`, `provider`, `chat`, `memory`, `skill`, `gui`, `serve`, and `service`.

:::caution[Two CLI tiers]
For v0.1.1 the plugin payload ships its own dispatcher at `bin/cxc.mjs`, so every marketplace
install has a working terminal surface: `node "<pluginRoot>/bin/cxc.mjs" <command>`. When `cxc`
is not on `PATH`, the SessionStart banner prints the exact resolved invocation, and injected
directives use it. A PATH-level `cxc` / `codexclaw` binary remains a repo-checkout convenience
(npm link or a shell alias to `bin/codexclaw.mjs`). The payload dispatcher excludes `gui` and
`map` (repo-checkout-only) and prints a pointer for those instead.
:::

## Live commands

| Command | Delegates to | Purpose |
|---|---|---|
| `cxc enable` | config-guard | Register skills, hooks, and MCP with Codex. |
| `cxc disable` / `cxc uninstall` | config-guard | Unregister the plugin. |
| `cxc status` | config-guard | Report config-guard registration status. |
| `cxc orchestrate <verb>` | pabcd-state | Drive PABCD phase state (see below). |
| `cxc freeze` | pabcd-state | Freeze the interview plan and surface the goal-activation handoff. |
| `cxc metric <verb>` | pabcd-state | Record/show true-objective metrics for emergence-harness loops. |
| `cxc divergence <verb>` | pabcd-state | Record divergence mode and grounded candidate archive entries. |
| `cxc loop <verb>` | pabcd-state | Init, show, or validate the project-local loop/goalplan substrate. |
| `cxc goalplan <verb>` | pabcd-state | Deprecated alias for `cxc loop <verb>`. |
| `cxc plan init <slug>` | pabcd-state | Scaffold the `devlog/_plan` unit the P→A plan gate verifies. |
| `cxc scan record` | pabcd-state | Record an interview contradiction-scan round (see below). |
| `cxc doctor` | cxc-ops | Component health plus `ocx` detection status. |
| `cxc reset` | cxc-ops | Clean up codexclaw operational state. |
| `cxc hooks retrust` | cxc-ops | Re-trust plugin hook hashes after editing hook JSONs. |
| `cxc gui` | gui | Start the local dashboard (Vite). |
| `cxc subagents` | subagent-config | Read/write per-role subagent model and prompt config. |
| `cxc map` | repo-map | Generate a ranked repository map from the `repo-map` skill. |
| `cxc provider` | provider-bridge | Show read-only opencodex (`ocx`) provider status (detect mode). |
| `cxc chat search` / `cxc chat index` | recall | Search or index read-only Codex rollout history under `CODEX_HOME` / `~/.codex`. |
| `cxc memory search` | recall | Search read-only Codex memory artifacts under `CODEX_HOME` / `~/.codex`. |
| `cxc skill search` / `cxc skill show` | skill-search | Search or show remote dormant skills from jaw, hermes, clawhub, or GitHub sources. |
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

## scan sub-grammar

```
cxc scan record --session <id> [--contradictions N] [--high N]
```

`scan record` records one interview contradiction-scan round. It performs both halves of the
recording contract: it appends a `scan_completed` event to the per-session interview ledger
(`.codexclaw/interviews/<id>.jsonl`) and increments the tracker's `scanRounds` /
`lastScanRoundId` counters via session state. Recorded rounds are what the I→P readiness gate
reads, so scans count toward the gate without an override. `--session` is required; there is no
latest-session fallback for mutating commands.

## loop / goalplan sub-grammar

```
cxc loop init --objective "<text>" [--criterion "<text>"...] [--session <id>] [--cwd <path>]
cxc loop show --slug "<text>" [--cwd <path>]
cxc loop validate --slug "<text>" [--cwd <path>]
```

`show` and `validate` also accept `--objective "<text>"` instead of `--slug`.
`cxc goalplan ...` is a deprecated alias for the same sub-grammar.

## map sub-grammar

```
cxc map [path] [--map-tokens N|--budget N] [--chat-files <path>...] [--mentioned-idents <name>...] [--verbose]
```

`map` runs the `repo-map` skill's vendored tree-sitter/PageRank mapper. It is a stateless
overview command for unfamiliar repositories and degrades to an install hint when Python
dependencies are missing.

## skill sub-grammar

```
cxc skill search "<query>" [--source jaw|hermes|clawhub|gh|all] [--limit N] [--json] [--refresh]
cxc skill show <id> [--source jaw|hermes|clawhub] [--json] [--refresh]
```

`skill` delegates to the `skill-search` component for remote dormant-skill search/show. It caches
catalog fetches under the user-level codexclaw cache and can serve stale cache entries if a remote
source is unavailable.

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
