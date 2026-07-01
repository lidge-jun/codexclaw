# L20 (Decade 200) -- cli-jaw Command -> codex-native Mapping

Status: DONE
Cluster: 3 · Phase: expansion · Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/090_clijaw_command_mapping.md (J1), 090.1 J-1/J-2/J-7

> AMENDMENT (2026-06-30, interview-confirmed D1', mvp_hard L13/WP1): the `cxc chat-search`
> wrapper described below has been RETIRED and removed from the codebase (see
> `204_L20.4_cxc_chat_search_wrapper.md`). Codex app-server `thread/search` exposes no
> native CLI/agent surface, and wrapping it made codexclaw a self-implemented search
> surface — against the L10/L20.4 boundary. Native `thread/search` with no CLI/agent
> surface is now an explicit NON-GOAL; `chat search` maps to "native-only, no wrapper".
> Lookups route through the `cxc-search` skill. The `chat-search` lines below are
> historical; the live `cxc` surface is `doctor`/`reset`/`orchestrate` only.

## Goal (one slice)
Map the cli-jaw operational command surface onto codex-native tools, and define
the small `cxc` CLI surface for the gaps codex does not cover. codexclaw has no
server, so server-owned cli-jaw commands are either delegated to codex-native
tools or self-implemented behind `cxc`.

## Why now / dependencies
- Upstream: depends on the Phase-1 subagent layer (L5) for the spawn_agent/
  wait_agent mappings and on the install/activation work (L6) for the `cxc`
  binary entry. No skill-content dependency, so it can run alongside L18/L19.
- Downstream: `cxc doctor`/`cxc reset` are consumed by L21 (ops) and the install
  flow; the chat-search wrapper feeds memory/recall workflows.

## Scope (decision-complete)
Mapping table (verdicts from J1 + jun decisions):
- `task` -> codex `update_plan` ONLY (J-1). cli-jaw task persistence, `--owner`
  assign, `--after` ordering, and cross-session lists are NOT ported; the
  in-memory per-turn checklist (`update_plan({explanation?, plan:[{step,status}]})`,
  status in pending/in_progress/completed) is judged sufficient.
- `bgtask` -> default behavior = subagent polling via `spawn_agent` + `wait_agent`
  inside the turn (J-2). The cli-jaw "server-owned durable re-invoke" is out of
  scope for codexclaw (no server); true periodicity defers to the Phase 3 OS
  scheduler (L29). Live terminal-process polling (`exec_command` ->
  `write_stdin` empty poll on `process_id`) covers short-lived waits only.
- `worker status` -> `list_agents`; `worker watch` -> `wait_agent`. codex-native.
- `hooks inspect` -> `codex debug prompt-input` + hook additional_contexts.
- `dispatch` -> `spawn_agent` (+ `send_message`/`followup_task`). codex-native.
- `memory` -> PASS (J-7); delegate to codex built-in memory, codexclaw builds none.
- `service` / `clone` -> delegate to codex runtime (`codex app-server daemon`,
  `codex resume`/`fork`).
- `chat search` -> CANDIDATE: app-server `thread/search` protocol exists
  (`ThreadSearchParams.search_term` required) but no CLI/agent-tool surface, so a
  `cxc chat-search` wrapper over app-server `thread/search` is needed.
- `doctor` -> self-implemented `cxc doctor` (codex install probe delegated to
  `codex doctor`, but codexclaw plugin/skill/hook/agent-config health is plugin-
  specific and self-checked).
- `reset` -> self-implemented `cxc reset` (codexclaw PABCD state, generated
  skill/hook files, GUI/subagent config cleanup; codex config reset delegated).

New `cxc` CLI surface (full form `codexclaw <cmd>` shown once here):
- `cxc doctor` -- evidence-bound PASS/WARN/FAIL plugin health report.
- `cxc reset [--state|--generated|--all]` -- scoped codexclaw state cleanup.
- `cxc chat-search "<query>" [--limit N]` -- wrapper over app-server thread/search.

Must-NOT-Have:
- No persistent task store (J-1).
- No server-owned durable bgtask daemon in MVP (J-2; defer to L29).
- No reimplementation of codex memory (J-7).
- `cxc reset` must never touch codex global config beyond the documented delegate.

## IPABCD micro-cycle
- I: not interview-bearing.
- P: implement `cxc doctor`/`cxc reset` self-checks; implement `cxc chat-search`
  wrapper calling app-server `thread/search`; document the codex-native mappings
  (task/bgtask/worker/hooks/dispatch) as guidance, not code.
- A: audit angle = "does any mapping silently assume a server codexclaw lacks?"
  reviewer verifies bgtask stays subagent-polling and doctor/reset stay local.
- B: build `cxc` subcommands; wire chat-search to app-server protocol; write the
  mapping reference doc shipped with the plugin.
- C: `cxc doctor` stdout shows PASS/WARN/FAIL with evidence; `cxc chat-search`
  returns thread+snippet results from a known session; `cxc reset --state` clears
  only PABCD state files (verify by re-reading state dir).
- D: done = doctor/reset/chat-search run via `cxc`, and the native mappings are
  documented with codex tool names.

## Acceptance (1-3 testable criteria)
1. `cxc doctor` emits an evidence-bound PASS/WARN/FAIL report covering plugin
   skills/hooks/agent config.
2. `cxc chat-search "<term>"` returns thread/snippet results via app-server
   `thread/search` (or a clear "no results" / "unsupported" message).
3. `cxc reset --state` removes only codexclaw PABCD state, leaving codex config
   untouched (verified by diffing config before/after).

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test for `cxc doctor` report shape and `cxc reset` scope safety.
- CLI stdout capture of `cxc chat-search` against a seeded session db.

## Commit unit (one atomic conventional commit)
`feat(cli): add cxc doctor/reset/chat-search and document codex-native mappings`

## Blocked-on (jun decision id, if any)
None. J-1 (task=update_plan), J-2 (bgtask=subagent polling, durable=Phase 3),
J-7 (memory PASS) resolved. chat-search remains a self-implemented wrapper.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/090_clijaw_command_mapping.md (J1 full analysis)
- codex-rs/protocol/src/plan_tool.rs:6 (update_plan args)
- codex-rs/core/src/tools/handlers/shell_spec.rs:83,105 (exec_command/write_stdin)
- codex-rs/core/src/tools/handlers/multi_agents_spec.rs:77,259 (spawn/list_agents)
- codex-rs/core/src/tools/handlers/multi_agents/wait.rs:51 (wait_agent)
- codex-rs/app-server-protocol/src/protocol/v2/thread.rs:1022,1103 (thread/search)
- codex-rs/cli/src/main.rs:211,1701 (debug prompt-input)
