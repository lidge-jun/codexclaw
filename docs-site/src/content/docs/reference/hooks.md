---
title: Hooks
description: codexclaw's thirteen Codex hooks — events, matchers, and the commands they run.
---

codexclaw registers thirteen hooks in its plugin manifest. Each runs a compiled component CLI
under `node`. All commands resolve `${PLUGIN_ROOT}` to the installed plugin directory.

## Hook table

| Event | Matcher | statusMessage | Timeout |
|---|---|---|---|
| `SessionStart` | — | Detecting provider bridge | 20 s |
| `SessionStart` | — | Surfacing project rules | 10 s |
| `UserPromptSubmit` | — | Checking PABCD trigger | 15 s |
| `Stop` | — | Checking PABCD continuation | 15 s |
| `PreToolUse` | `^create_goal$` | Guarding goal budget | 15 s |
| `PreToolUse` | `^request_user_input$` | Denying interview/user-input in goal mode | 15 s |
| `PreToolUse` | `^spawn_agent$` | Attaching skills to spawn | 10 s |
| `PreToolUse` | `^Bash$` | Checking shell friction | 10 s |
| `PreToolUse` | `^(apply_patch\|Write\|Edit)$` | Linting structured edit | 10 s |
| `PostToolUse` | `^request_user_input$` | Capturing interview answer | 15 s |
| `PostToolUse` | `^Bash$` | Recording shell friction | 10 s |
| `SubagentStop` | `^worker$` | Verifying subagent evidence | 10 s |
| `PostCompact` | — | Recovering PABCD state after compaction | 10 s |

## What each hook does

### Session lifecycle

- **provider-bridge / session-start** — detects `ocx` status (detect-only) at session start.
- **project-rules / session-start** — surfaces project-local rules and context at session start.

### Prompt & orchestration

- **pabcd-trigger / user-prompt-submit** — parses the orchestrate grammar from the submitted
  prompt and injects the matching phase directive.
- **pabcd-continuation / stop** — under an active goal with an in-flight cycle, blocks Stop to
  keep the loop advancing, bounded by the continuation guards.

### Pre-tool guards

- **goal-budget / pre-tool-use (`create_goal`)** — guards goal creation against the goal budget.
- **interview-in-goal / pre-tool-use (`request_user_input`)** — denies interactive interview
  prompts while a goal is active, so an autonomous goal does not stall on a question.
- **skill-attach / pre-tool-use (`spawn_agent`)** — attaches relevant skills to subagent spawns.
- **friction-advise / pre-tool-use (`Bash`)** — checks shell friction history before Bash calls.
- **edit-lint / pre-tool-use (`apply_patch|Write|Edit`)** — lints structured edits before they
  apply.

### Post-tool capture

- **interview-capture / post-tool-use (`request_user_input`)** — captures interview Q/A answers
  into the interview ledger.
- **friction-record / post-tool-use (`Bash`)** — records shell friction events for later advisory.

### Subagent & compaction

- **evidence-verify / subagent-stop (`worker`)** — verifies subagent evidence bundles on
  completion.
- **reinject-cursor / post-compact** — recovers PABCD state and re-injection cursor after context
  compaction.

## Trust

Hooks run only after you trust them in Codex. See
[Installation → Hook trust](/codexclaw/getting-started/installation/).
