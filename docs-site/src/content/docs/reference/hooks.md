---
title: Hooks
description: codexclaw's five Codex hooks — events, matchers, and the commands they run.
---

codexclaw registers five hooks in its plugin manifest. Each runs a compiled component CLI under
`node`. All commands resolve `${PLUGIN_ROOT}` to the installed plugin directory.

| Event | Matcher | Command | statusMessage |
|---|---|---|---|
| `SessionStart` | — | `provider-bridge/dist/cli.js hook session-start` | Detecting provider bridge |
| `UserPromptSubmit` | — | `pabcd-state/dist/cli.js hook user-prompt-submit` | Checking PABCD trigger |
| `Stop` | — | `pabcd-state/dist/cli.js hook stop` | Checking PABCD continuation |
| `PreToolUse` | `^create_goal$` | `pabcd-state/dist/cli.js hook pre-tool-use` | Guarding goal budget |
| `PreToolUse` | `^request_user_input$` | `pabcd-state/dist/cli.js hook pre-tool-use` | Denying interview/user-input in goal mode |

## What each hook does

- **provider-bridge / session-start** — detects `ocx` status (detect-only) at session start.
- **pabcd-state / user-prompt-submit** — parses the orchestrate grammar from the submitted
  prompt and injects the matching phase directive.
- **pabcd-state / stop** — under an active goal with an in-flight cycle, blocks Stop to keep the
  loop advancing, bounded by the continuation guards.
- **pabcd-state / pre-tool-use (`create_goal`)** — guards goal creation against the goal budget.
- **pabcd-state / pre-tool-use (`request_user_input`)** — denies interactive interview prompts
  while a goal is active, so an autonomous goal does not stall on a question it cannot answer.

## Timeouts

The provider-bridge hook uses a 20s timeout; the pabcd-state hooks use 15s.

## Trust

Hooks run only after you trust them in Codex. See
[Installation → Hook trust](/codexclaw/getting-started/installation/).
