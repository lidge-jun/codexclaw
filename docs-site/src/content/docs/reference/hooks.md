---
title: Hooks
description: codexclaw's seventeen Codex hooks — events, matchers, and the commands they run.
---

codexclaw registers seventeen hooks in its plugin manifest. Each runs a compiled component CLI
under `node`. All commands resolve `${PLUGIN_ROOT}` to the installed plugin directory.

## Hook table

| Hook file | Event | Matcher | Command | statusMessage | Timeout |
|---|---|---|---|---|---|
| `session-start-ensuring-provider-bridge.json` | `SessionStart` | — | `node "${PLUGIN_ROOT}/components/provider-bridge/dist/cli.js" hook session-start` | `(codexclaw) Detecting provider bridge` | 20 s |
| `user-prompt-submit-checking-pabcd-trigger.json` | `UserPromptSubmit` | — | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook user-prompt-submit` | `(codexclaw) Checking PABCD trigger` | 15 s |
| `stop-checking-pabcd-continuation.json` | `Stop` | — | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook stop` | `(codexclaw) Checking PABCD continuation` | 15 s |
| `pre-tool-use-guarding-goal-budget.json` | `PreToolUse` | `^create_goal$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook pre-tool-use` | `(codexclaw) Guarding goal budget` | 15 s |
| `pre-tool-use-guarding-interview-in-goal.json` | `PreToolUse` | `^request_user_input$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook pre-tool-use` | `(codexclaw) Denying interview/user-input in goal mode` | 15 s |
| `post-tool-use-capturing-interview-answers.json` | `PostToolUse` | `^request_user_input$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook post-tool-use` | `(codexclaw) Capturing interview answer` | 15 s |
| `subagent-stop-verifying-evidence.json` | `SubagentStop` | `^worker$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook subagent-stop` | `(codexclaw) Verifying subagent evidence` | 10 s |
| `pre-tool-use-attaching-skills.json` | `PreToolUse` | `^spawn_agent$` | `node "${PLUGIN_ROOT}/components/subagent-config/dist/spawn-attach-hook.js" hook pre-tool-use` | `(codexclaw) Attaching skills to spawn` | 10 s |
| `post-compact-resetting-reinject-cursor.json` | `PostCompact` | — | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook post-compact` | `(codexclaw) Recovering PABCD state after compaction` | 10 s |
| `session-start-injecting-project-rules.json` | `SessionStart` | — | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook session-start-rules` | `(codexclaw) Surfacing project rules` | 10 s |
| `pre-tool-use-linting-apply-patch.json` | `PreToolUse` | `^(apply_patch\|Write\|Edit)$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook pre-tool-use-lint` | `(codexclaw) Linting structured edit` | 10 s |
| `post-tool-use-capturing-shell-friction.json` | `PostToolUse` | `^Bash$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook post-tool-use-friction` | `(codexclaw) Recording shell friction` | 10 s |
| `pre-tool-use-advising-on-friction.json` | `PreToolUse` | `^Bash$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook pre-tool-use-friction` | `(codexclaw) Checking shell friction` | 10 s |
| `user-prompt-submit-suggesting-recall.json` | `UserPromptSubmit` | — | `node "${PLUGIN_ROOT}/components/recall/dist/cli.js" hook user-prompt-submit` | `(codexclaw) Checking recall intent` | 10 s |
| `session-start-advertising-recall.json` | `SessionStart` | — | `node "${PLUGIN_ROOT}/components/recall/dist/cli.js" hook session-start` | `(codexclaw) Advertising past-session recall` | 10 s |
| `post-compact-suggesting-recall.json` | `PostCompact` | — | `node "${PLUGIN_ROOT}/components/recall/dist/cli.js" hook post-compact` | `(codexclaw) Suggesting recall after compaction` | 10 s |
| `post-tool-use-detecting-edit-shapes.json` | `PostToolUse` | `^apply_patch$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook post-tool-use-edit-shape` | `(codexclaw) Watching for repeated edit shapes` | 10 s |

## What each hook does

### Session lifecycle

- **provider-bridge / session-start** — detects `ocx` status (detect-only) at session start.
- **project-rules / session-start** — surfaces project-local rules and context at session start.
- **recall-advertise / session-start** — advertises recall availability and read-only index status
  at session start.

### Prompt & orchestration

- **pabcd-trigger / user-prompt-submit** — parses the orchestrate grammar from the submitted
  prompt and injects the matching phase directive.
- **recall-suggest / user-prompt-submit** — detects past-work recall intent and injects a
  `cxc chat search` / `cxc memory search` nudge.
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
- **edit-shape / post-tool-use (`apply_patch`)** — watches repeated edit shapes and can surface a
  process nudge.

### Subagent & compaction

- **evidence-verify / subagent-stop (`worker`)** — verifies subagent evidence bundles on
  completion.
- **reinject-cursor / post-compact** — recovers PABCD state and re-injection cursor after context
  compaction.
- **recall-after-compact / post-compact** — after compaction, steers context recovery through
  recall search.

## Trust

Hooks run only after you trust them in Codex. See
[Installation → Hook trust](/codexclaw/getting-started/installation/).
