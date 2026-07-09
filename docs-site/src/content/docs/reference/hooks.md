---
title: Hooks
description: codexclaw's twelve Codex hooks — events, matchers, and the commands they run.
---

codexclaw registers twelve hooks in its plugin manifest. Each runs a compiled component CLI
under `node`. All commands resolve `${PLUGIN_ROOT}` to the installed plugin directory.
The removed hook JSON files live under `hooks/_deprecated/` from the 2026-07-05 hook diet.

**Subagent turn guard (2026-07-09):** every `pabcd-state` turn-level hook no-ops when the
stdin payload carries `agent_id`/`agent_type` — codex-rs stamps these into hook inputs for
thread-spawned subagent turns and reuses the parent session id, so without the guard a child
turn would read/write the parent's PABCD state and receive root-only directives
(`request_user_input` is root-thread-only in codex-rs). `SubagentStop` is the intentional
child-scoped surface and stays exempt; the spawn-attach hook only enriches spawn messages
and is also unaffected.

## Hook table

| Hook file | Event | Matcher | Command | statusMessage | Timeout |
|---|---|---|---|---|---|
| `session-start-ensuring-provider-bridge.json` | `SessionStart` | — | `node "${PLUGIN_ROOT}/components/provider-bridge/dist/cli.js" hook session-start` | `(codexclaw) Detecting provider bridge` | 20 s |
| `session-start-announcing-map-affordance.json` | `SessionStart` | — | `node "${PLUGIN_ROOT}/components/cxc-ops/dist/cli.js" hook session-start` | `(codexclaw) Announcing cxc map affordance` | 10 s |
| `user-prompt-submit-checking-pabcd-trigger.json` | `UserPromptSubmit` | — | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook user-prompt-submit` | `(codexclaw) Checking PABCD trigger` | 15 s |
| `stop-checking-pabcd-continuation.json` | `Stop` | — | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook stop` | `(codexclaw) Checking PABCD continuation` | 15 s |
| `pre-tool-use-guarding-goal-budget.json` | `PreToolUse` | `^create_goal$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook pre-tool-use` | `(codexclaw) Guarding goal budget` | 15 s |
| `pre-tool-use-guarding-interview-in-goal.json` | `PreToolUse` | `^request_user_input$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook pre-tool-use` | `(codexclaw) Denying interview/user-input in goal mode` | 15 s |
| `post-tool-use-capturing-interview-answers.json` | `PostToolUse` | `^request_user_input$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook post-tool-use` | `(codexclaw) Capturing interview answer` | 15 s |
| `subagent-stop-verifying-evidence.json` | `SubagentStop` | `^worker$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook subagent-stop` | `(codexclaw) Verifying subagent evidence` | 10 s |
| `pre-tool-use-attaching-skills.json` | `PreToolUse` | `^spawn_agent$` | `node "${PLUGIN_ROOT}/components/subagent-config/dist/spawn-attach-hook.js" hook pre-tool-use` | `(codexclaw) Attaching skills to spawn` | 10 s |
| `post-compact-resetting-reinject-cursor.json` | `PostCompact` | — | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook post-compact` | `(codexclaw) Recovering PABCD state after compaction` | 10 s |
| `pre-tool-use-linting-apply-patch.json` | `PreToolUse` | `^(apply_patch\|Write\|Edit)$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook pre-tool-use-lint` | `(codexclaw) Linting structured edit` | 10 s |
| `post-tool-use-tracking-render-observations.json` | `PostToolUse` | `^(view_image\|browser:control-in-app-browser\|chrome:control-chrome\|computer-use:computer-use\|apply_patch)$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook post-tool-use-render-observation` | `(codexclaw) Tracking render observation` | 10 s |

## What each hook does

### Session lifecycle

- **provider-bridge / session-start** — detects `ocx` status (detect-only) at session start.
- **map-affordance / session-start** — announces `cxc map` availability through the `cxc-ops`
  CLI at session start.

### Prompt & orchestration

- **pabcd-trigger / user-prompt-submit** — parses the orchestrate grammar from the submitted
  prompt and injects the matching phase directive.
- **pabcd-continuation / stop** — under an active goal with an in-flight cycle, blocks Stop to
  keep the loop advancing, bounded by the continuation guards.

### Pre-tool guards

- **goal-budget / pre-tool-use (`create_goal`)** — guards goal creation against the goal budget.
- **interview-in-goal / pre-tool-use (`request_user_input`)** — denies interactive interview
  prompts while a goal is active, so an autonomous goal does not stall on a question.
- **skill-attach / pre-tool-use (`spawn_agent`)** — normalizes known broken/bare cxc
  mentions already present in spawn messages; it never adds omitted role or surface skills.
- **edit-lint / pre-tool-use (`apply_patch|Write|Edit`)** — lints structured edits before they
  apply.

### Post-tool capture

- **interview-capture / post-tool-use (`request_user_input`)** — captures interview Q/A answers
  into the interview ledger.
- **render-observation / post-tool-use (`view_image|browser:control-in-app-browser|chrome:control-chrome|computer-use:computer-use|apply_patch`)** —
  tracks render observations for visual and surface-driving QA evidence.

### Subagent & compaction

- **evidence-verify / subagent-stop (`worker`)** — verifies subagent evidence bundles on
  completion.
- **reinject-cursor / post-compact** — recovers PABCD state and re-injection cursor after context
  compaction.

## Trust

Hooks run only after you trust them in Codex. See
[Installation → Hook trust](/codexclaw/getting-started/installation/).
