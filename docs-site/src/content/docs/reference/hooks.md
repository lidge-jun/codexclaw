---
title: Hooks
description: codexclaw's 23 hook files and 24 event handlers — events, matchers, and commands.
---

codexclaw registers 23 hook files with 24 event handlers in its plugin manifest.
The compact-affordance file handles both PostCompact and UserPromptSubmit. Each handler runs a compiled component CLI
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
| `session-start-bootstrapping-pabcd-state.json` | `SessionStart` | — | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook session-start` | `(codexclaw) Bootstrapping PABCD session state` | 15 s |
| `session-start-healing-declared-features.json` | `SessionStart` | — | `node "${PLUGIN_ROOT}/components/config-guard/dist/cli.js" hook session-start` | `(codexclaw) Ensuring declared codex features` | 20 s |
| `session-start-announcing-map-affordance.json` | `SessionStart` | — | `node "${PLUGIN_ROOT}/components/cxc-ops/dist/cli.js" hook session-start` | `(codexclaw) Announcing cxc map affordance` | 10 s |
| `user-prompt-submit-checking-pabcd-trigger.json` | `UserPromptSubmit` | — | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook user-prompt-submit` | `(codexclaw) Checking PABCD trigger` | 15 s |
| `stop-checking-pabcd-continuation.json` | `Stop` | — | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook stop` | `(codexclaw) Checking PABCD continuation` | 15 s |
| `pre-tool-use-guarding-goal-budget.json` | `PreToolUse` | `^create_goal$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook pre-tool-use` | `(codexclaw) Guarding goal budget` | 15 s |
| `pre-tool-use-guarding-interview-in-goal.json` | `PreToolUse` | `^request_user_input$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook pre-tool-use` | `(codexclaw) Denying interview/user-input in goal mode` | 15 s |
| `pre-tool-use-guarding-goal-complete.json` | `PreToolUse` | `^update_goal$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook pre-tool-use` | `(codexclaw) Gating lazy goal completion (E8)` | 15 s |
| `post-tool-use-capturing-interview-answers.json` | `PostToolUse` | `^request_user_input$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook post-tool-use` | `(codexclaw) Capturing interview answer` | 15 s |
| `subagent-stop-verifying-evidence.json` | `SubagentStop` | `^worker$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook subagent-stop` | `(codexclaw) Verifying subagent evidence` | 10 s |
| `subagent-stop-observing-review.json` | `SubagentStop` | `.*` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook subagent-stop-review` | `(codexclaw) Recording review verdict` | 10 s |
| `pre-tool-use-attaching-skills.json` | `PreToolUse` | `^(collaboration[._]?)?spawn_agent$` | `node "${PLUGIN_ROOT}/components/subagent-config/dist/spawn-attach-hook.js" hook pre-tool-use` | `(codexclaw) Attaching skills to spawn` | 10 s |
| `post-compact-resetting-reinject-cursor.json` | `PostCompact` | — | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook post-compact` | `(codexclaw) Recovering PABCD state after compaction` | 10 s |
| `pre-tool-use-linting-apply-patch.json` | `PreToolUse` | `^(apply_patch\|Write\|Edit)$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook pre-tool-use-edit` | `(codexclaw) Checking structured edit` | 10 s |
| `post-tool-use-tracking-render-observations.json` | `PostToolUse` | `^(view_image\|browser:control-in-app-browser\|chrome:control-chrome\|computer-use:computer-use\|apply_patch)$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook post-tool-use-render-observation` | `(codexclaw) Tracking render observation` | 10 s |
| `session-start-injecting-recall-context.json` | `SessionStart` | — | `node "${PLUGIN_ROOT}/components/recall/dist/cli.js" hook session-start` | `(codexclaw) Injecting recall context` | 10 s |
| `post-compact-injecting-recall-context.json` | `PostCompact` | — | `node "${PLUGIN_ROOT}/components/recall/dist/cli.js" hook post-compact` | `(codexclaw) Recovering recall context after compaction` | 10 s |
| `post-compact-injecting-bg-terminal-affordance.json` | `PostCompact` | — | `node "${PLUGIN_ROOT}/components/cxc-ops/dist/cli.js" hook post-compact` | `(codexclaw) Queuing compact affordance recovery` | 10 s |
| `post-compact-injecting-bg-terminal-affordance.json` | `UserPromptSubmit` | — | `node "${PLUGIN_ROOT}/components/cxc-ops/dist/cli.js" hook user-prompt-submit` | `(codexclaw) Restoring queued compact affordances` | 10 s |
| `user-prompt-submit-detecting-recall-intent.json` | `UserPromptSubmit` | — | `node "${PLUGIN_ROOT}/components/recall/dist/cli.js" hook user-prompt-submit` | `(codexclaw) Checking recall intent` | 5 s |
| `session-start-detecting-managed-worktree.json` | `SessionStart` | — | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook worktree-guard` | `(codexclaw) Checking managed-worktree identity` | 10 s |
| `user-prompt-submit-guiding-worktree-rename.json` | `UserPromptSubmit` | — | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook worktree-guard` | `(codexclaw) Checking worktree rename intent` | 10 s |
| `pre-tool-use-guarding-managed-worktree-deletion.json` | `PreToolUse` | `^Bash$` | `node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook worktree-guard-pretool` | `(codexclaw) Guarding managed worktree` | 10 s |

## What each hook does

### Session lifecycle

- **provider-bridge / session-start** — detects `ocx` status (detect-only) at session start.
- **pabcd-bootstrap / session-start** — creates or resumes the per-session PABCD state file
  without clobbering existing state.
- **map-affordance / session-start** — announces `cxc map` availability through the `cxc-ops`
  CLI at session start.
- **recall-context / session-start** — injects recent past-session and memory context at
  session start.

### Prompt & orchestration

- **pabcd-trigger / user-prompt-submit** — parses the orchestrate grammar from the submitted
  prompt and injects the matching phase directive.
- **recall-intent / user-prompt-submit** — detects past-session recall phrasing and routes to
  the disk-artifact search before the agent asks the user.
- **pabcd-continuation / stop** — under an active goal with an in-flight cycle, blocks Stop to
  keep the loop advancing, bounded by the continuation guards.

### Pre-tool guards

- **goal-budget / pre-tool-use (`create_goal`)** — guards goal creation against the goal budget.
- **interview-in-goal / pre-tool-use (`request_user_input`)** — denies interactive interview
  prompts while a goal is active, so an autonomous goal does not stall on a question.
- **goal-complete / pre-tool-use (`update_goal`)** — gates lazy goal completion (E8): a goal
  cannot close while its bound goalplan has undone work or unproven criteria.
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
  completion. The retry budget is TERMINAL: after `MAX_ATTEMPTS` blocks the child is
  released with an unresolved verdict recorded against the session, and
  `GOAL-COMPLETE-GATE-01` denies `update_goal {status:"complete"}` until it is settled
  with `cxc evidence resolve --receipt <path>`. Blocking forever was not a safeguard: a
  read-only child cannot write the receipt, so re-prompting it only hid the outcome from
  the parent. Read-only lanes should dispatch as `explorer`, which is never gated.
- **reinject-cursor / post-compact** — recovers PABCD state and re-injection cursor after context
  compaction.
- **recall-context / post-compact** — invokes the recall recovery handler. On hosts
  accepting only universal PostCompact output, event-specific context is not proof
  that the model received the recall text.
- **bg-terminal-affordance / post-compact** — queues a workspace/session-scoped
  recovery marker and emits no event-specific context. PostCompact cannot carry
  this guidance directly on hosts accepting only universal output fields.
- **bg-terminal-affordance / user-prompt-submit** — consumes that marker once on
  the next root prompt and emits background-terminal, loop, stack and async-question
  guidance through UserPromptSubmit. Either child stamp prevents enqueue/consume;
  explicit `reset --state` clears pending markers. No prompt means no same-turn/Stop
  recovery guarantee. This is hint delivery, not permission or forced tool use.

## Trust

Hooks run only after you trust them in Codex. See
[Installation → Hook trust](/codexclaw/getting-started/installation/).

## Missing session binding

An ordinary Codex fork has its own native thread ID. A missing SessionStart
message or missing `.codexclaw/sessions/<id>.json` must not be repaired by copying
an ID from inherited chat history or by choosing the newest session file.

From the current Codex terminal tool, run `cxc session current --json`. It reads
native `CODEX_THREAD_ID`, corroborates the exact ID and cwd against Codex's local
thread database, and reports whether FSM state exists. Run `cxc session bind`
explicitly in that verified cwd to create missing IDLE state. Existing state is
preserved; malformed state, subagent identity, mismatched cwd and unavailable
native metadata fail with a diagnostic. Do not assign `CODEX_THREAD_ID` yourself.

Binding repairs state only. `hooksVerified: false` means it does not establish that
SessionStart, prompt or Stop hooks ran. Check `cxc doctor` from the installed payload
for installation/trust issues; compare its version to a PATH-level development CLI.
A running process may retain old plugin paths after an update. Refresh/restart that
process when appropriate; successful installation alone is not live hook proof.

Implicit `orchestrate status` uses the verified native identity when present and
never falls back after a native validation failure. Explicit missing state reports
an error with `phase: null`, rather than inventing IDLE. Plain terminals without
native identity retain their read-only latest-file compatibility fallback.
