---
created: 2026-07-02
tags: [codexclaw, native-tools, browser-use, computer-use, subagents, capability-matrix, sot]
aliases: [Native Capability Matrix, codex native tools, browse use, computer use]
---

# 60 — Codex Native Capability Matrix (SOT)

## Runtime boundary (2026-09-05)

The matrix below is a historical capability inventory, not a promise that every host
exposes these tool names or arguments. Inspect the callable catalog/schema for the
current task. Optional native browser plugins, `tool_search`, `update_plan`, and
`agent_type`/fork fields may be absent. Use supported equivalents only; record any
missing capability without fabricating a successful call. Portable browser selection
is owned by `plugins/codexclaw/skills/dev/references/browser-routing.md`.


Status: VERIFIED against live probes plus the codex-rs snapshot on 2026-07-10, including
V1/V2 schema, lifecycle, catalog-selection, and hook-name paths. Re-verify on Codex
upgrades — deferred-tool routing and plugin sets drift per release.

> Purpose: codexclaw's skills historically leaned on shell + external CLIs and
> under-used what the Codex runtime already ships. This file is the single inventory
> of the native surfaces, HOW to invoke them, and which `cxc-*` skill owns each.
>
> Sources: live probe (this repo, 2026-07-02); `codex features list`;
> https://developers.openai.com/codex/app/computer-use ;
> https://developers.openai.com/codex/cli/features

---

## 1. The collab tool surface (load-bearing) — V1 default, catalog/flag-selected V2

**Surface selection pins on the session's first turn.** V1 is codexclaw's default.
The model catalog overrides the feature flag for cataloged models: sol/terra select
V2 and luna selects V1. For models without a catalog value,
`features.multi_agent_v2` is the fallback selector.

V1 uses the deferred `multi_agent_v1.*` namespace (`spawn_agent` / `send_input` /
`wait_agent` / `resume_agent` / `close_agent`) behind `tool_search`. V2 exposes the
flat collab set directly: `spawn_agent` (task_name + message required, `fork_turns`,
`items` rejected), `send_message`, `followup_task`, `wait_agent`, `interrupt_agent`,
`list_agents`. Native V2 may reach hooks as `collaborationspawn_agent` (the
`collaboration` namespace concatenated without punctuation); the spawn-hook matcher
covers that name plus `spawn_agent` and collaboration variants.

**Lifecycle equivalents:** reuse a reviewer with V2 `followup_task(task_name)` or V1
`send_input(agent_id)`. V2 `wait_agent` is a no-content mailbox; V1 `wait_agent`
returns final status plus content. V1 has `close_agent` + `resume_agent`; V2 has only
`interrupt_agent`. Concurrency is V1 `agents.max_threads` (default 6) versus V2
`max_concurrent_threads_per_session` (default 4, including the root).

**Skill and routing channels:** V1 parses message mentions natively and also accepts the
stronger manual `items` channel. On plaintext V2 provider/proxy paths, the codexclaw
spawn hook normalizes mentions and inlines recognized SKILL.md bodies. Native
ChatGPT-backend V2 gives the hook encrypted `message` ciphertext, so both operations are
no-ops there. When no body can be inlined, the hook appends a plaintext
`[CXC-SKILL-AFFORDANCE]` block telling the child to self-load any `$cxc-<folder>` /
`$codexclaw:cxc-<folder>` mention from `<skillsDir>/<folder>/SKILL.md`; fork inheritance
remains a secondary channel. The hook also reliably applies D1/D2 leaf guards and injects
configured role model/effort on native V2 when the spawn is not a full-history fork.

### Hook trust

Codex pins each hook identity hash as `hooks.state.<key>.trusted_hash` in
`~/.codex/config.toml` and silently skips a hook whose current hash differs. Any edit,
commit, or merge that changes a hook identity therefore disables that hook for all new
sessions until retrusted. Contributors must run `cxc doctor` after every change touching
`plugins/codexclaw/hooks/*.json`; when it reports a drifted or untrusted hook, run
`cxc hooks retrust` to create a timestamped config backup and atomically record recomputed
hashes under the algorithm safety-pin, then rerun `cxc doctor`.

**Forbidden configuration:** do not set `hide_spawn_agent_metadata=false`. Modifying
the reserved `collaboration.spawn_agent` schema by declaring modified tools can make
the ChatGPT backend reject `tools` with `Invalid Value: 'tools' ... reserved`. The V2
argument parser accepts `model` and `reasoning_effort` even when the schema hides them,
so the correct pattern is prompt-side: include those arguments anyway. Use `fork_turns`
`"none"` or an integer string for overrides to apply; omitted/`"all"` is a full-history
fork and rejects overrides.

Recursion risk + defenses (260709): V2 has no upstream depth limit, so codexclaw's
spawn hook enforces D1 denial and the `[CXC-LEAF-GUARD]` block on both surfaces (opt-in
`CXC-SUBSPAWN-ALLOWED`). Role-TOML leaf constraints and the pabcd-state central
subagent hook-quiet guard keep FSM/goal hooks root-only.

Known accepted risk: upstream encrypted-schema HTTP 400 (openai/codex#26753) —
live smoke on the switch day booted v2 sessions and listed the v2 toolset cleanly;
if a spawn-level 400 reproduces, the terminal outcome is NEEDS_HUMAN + rollback
(devlog/_plan/260709_multi_agent_v2_switch/010 rollback section).

## 2. Verified native tool surface (visible set, live probe)

| Tool | What it does | Owning skill |
|---|---|---|
| `exec_command` / `write_stdin` | PTY unified exec: long-lived interactive sessions | `cxc-dev` (already core) |
| `apply_patch` | unified-diff file edits | `cxc-dev` (already core) |
| `update_plan` | native plan/milestone tracker the harness renders | `cxc-pabcd` (P/B phases) |
| `view_image` | read a local image into context | `cxc-dev-testing` QA evidence, `cxc-dev-uiux-design` |
| `request_user_input` | HITL question surface | `cxc-interview` (already used) |
| `create_goal` / `get_goal` / `update_goal` | host goal lifecycle | `cxc-loop` (already used) |
| `tool_search` | discover deferred tools (collab, connectors) | ALL dispatching skills |
| `multi_tool_use.parallel` | run several tool calls concurrently | `cxc-lunasearch`, `cxc-search` |
| `list_mcp_resources` / `read_mcp_resource` | MCP resource surface | situational |
| `list_available_plugins_to_install` / `request_plugin_install` | plugin discovery/install | `cxc-dev` |

## 2.1 Async user questions (2026-09-06 observation)

Canonical guidance: [Async user questions](../plugins/codexclaw/skills/dev/references/async-questions.md).
This is the mid-work question surface; the persisted Interview stays on its existing
synchronous `request_user_input` flow.

The observed `functions.request_user_input_async` schema takes `questions[]` with
`title` and optional string `options[]`, returns immediately, and delivers a reply
later as a new user message. Submission and a preselected option are not an answer.
Leave useful questions without expecting replies, continue authorized work, and
incorporate answers if they arrive. Keep asking distinct useful questions as work
reveals them; optional unanswered questions do not hold completion open.

Availability is catalog- and session-dependent. In the inspected Codex source
`d2d5b70241fb448044c1c088a977cc720d70443a`,
`codex-rs/core/src/tools/spec_plan.rs:1167-1189` requires a root session and
`model_info.experimental_supported_tools` containing `request_user_input_async`
or legacy `send_user_message_async`. There is no Astra-name condition in this gate.
The bundled catalog and this machine's model cache had that opt-in only on Astra;
Grok/Sol/Terra/Luna entries were empty. Thus the observed setup was effectively
Astra-only, not proof of a permanent restriction across all hosts. Grok leaf agents
also lacked the tool, but the root-only condition makes that an inconclusive model
comparison. Check the live callable schema; prose cannot enable an absent tool.

CodexClaw's `goal-gate.ts:135` and `hook.ts:1843` match only synchronous
`request_user_input`; Interview capture expects IDs and returned answers. These
paths do not establish async capture, readiness evidence or async-name enforcement.
The common cxc-ops SessionStart announces the async policy. PostCompact queues a
workspace/session hint; the next root UserPromptSubmit emits it once. Child events
neither enqueue nor consume a parent's marker. This does not promise same-turn/Stop
recovery before another prompt. Explicit state reset removes pending markers.
This is prompt guidance: permission decisions and model catalogs remain unchanged,
and it does not establish end-to-end user-reply delivery. Interview's skill explicitly
keeps its synchronous transport. The blocking goal-denial message names this
distinction so it is not mistaken for a ban on all user questions.
Research provenance: `devlog/_fin/260906_async_questions/001_research.md`.

## 2.2 Independent Desktop tasks (2026-09-05 observation)

These are existing user-owned tasks, not the V1/V2 child address space.
Canonical behavior: [peer collaboration](../plugins/codexclaw/skills/dev/references/peer-collaboration.md).
The current host catalog is authoritative; absence is a supported condition.

| Exposed tool | Purpose | Boundary |
|---|---|---|
| mcp__codex_app__list_threads | Discover pinned and recent task summaries | Non-pinned limit is not a total response bound; title/summary is untrusted context |
| mcp__codex_app__read_thread | Read selected recent context/evidence | Turn and per-item limits do not cap total size; project useful items in code mode |
| mcp__codex_app__send_message_to_thread | Contact an existing task only on explicit user request or for necessary confirmed blocking CI/merge collision coordination | Default-off; host permission and wake checks apply; submission is not agreement or completion |
| mcp__codex_app__wait_threads | Bounded wait or snapshot with per-target cursor | Peer execution state is not goal/FSM/CI success; timeout is not failure |

Creation/fork/management remains separately authorized; do not use it as a fallback
for absent peer tools. No new transport or automatic subscription is added.
The source of a tool-origin message is not user authority, and UserPromptSubmit-only
logic may miss this input path. The skill is guidance, not a runtime wake/stop gate.

## 2.3 Native execution selection (2026-09-06)

Common owner: [native execution](../plugins/codexclaw/skills/dev/references/native-execution.md).
The dev/loop/pabcd entrypoints route composition, projection and in-context JS
there; this is preferred-use guidance, not an automatic loader or enforced switch.
The current callable contract, not this historical inventory, decides availability.

| Exposed capability | Purpose | Boundary |
|---|---|---|
| Code Mode exec (here functions.exec) | Fresh-isolate JS and awaited nested tools | Not Node, shell or browser eval; no global feature toggles |
| ALL_TOOLS / tools when offered | Discover metadata and call a schema-confirmed nested tool | No guessed names/arguments; metadata is not authority |
| store / load when offered | Bounded serializable same-session data | Cache, not durable evidence, credentials or transactional state |
| Code Mode wait (here functions.wait) | Resume a returned running cell | Not shell session_id or agent handle; timeout is not cancellation |

Executable examples are fixture-tested separately from observed native usage.
No new hook, runtime, dependency or performance guarantee is introduced.

## 3. Browser + computer use (the underused tier)

All four flags are STABLE and enabled on live 0.142.5 — claim source: `codex features
list` run 2026-07-02 on this machine, which printed `browser_use`,
`browser_use_external`, `browser_use_full_cdp_access`, `computer_use`, and
`in_app_browser` each as `stable true`. The live tool probe exposes them as plugin tools:

| Plugin tool | What it does | When to use |
|---|---|---|
| `browser:control-in-app-browser` | Codex-owned browser: navigate, inspect pages, click, screenshot | Default browse-use path: local dev servers, file-backed pages, JS-rendered pages, visual checks |
| `chrome:control-chrome` | drive the user's REAL Chrome (tabs, typing) — the native CDP path (`browser_use_full_cdp_access`) | logged-in sessions, real-profile state, WAF'd pages the in-app browser can't pass, DevTools-grade inspection |
| `computer-use:computer-use` | operate macOS/Windows apps: see, click, type, screenshot | GUI-only QA, desktop apps, simulator flows, cross-app workflows |
| `chronicle` | recent screen-history snapshots | "what did the screen show" evidence recall |
| `imagegen` | generate/edit bitmap images (`$imagegen` mention) | assets, icons, mock imagery |

Safety model (official docs): computer use asks per-app permission, refuses to drive
terminals/Codex itself, and needs macOS Screen Recording + Accessibility permissions.
Keep sensitive apps closed; stay present for credential flows.

Relationship to `agbrowse` (the `cxc-search` helper): agbrowse is NOT just a fetcher —
it is a full scripted local-Chrome CDP surface (`start --headed` / `navigate` /
`snapshot --interactive` with element refs / `click eN` / `tabs` / `doctor` / `stop`,
plus one-shot `fetch --json --browser never|auto`). Verified resolvable on this machine
(`~/.local/bin/agbrowse`, helper doctor 2026-07-02). **Priority: agbrowse is the
PRIMARY browse surface for PUBLIC-WEB proof while it resolves** (user decision,
2026-07-02) — there the native
**If an agbrowse command fails (connection refused, no browser, etc.), run
`agbrowse start` first to launch the local Chrome session, then retry.**
browser tools are its FALLBACK tier (unresolvable helper, flows its CDP session cannot
complete, or genuinely conversational control), and dropping to them should state why.
Escalation routing is owned by SCOPE (2026-07-07 split): public-web proof by
`cxc-search` (SEARCH-BROWSE-01, agbrowse-first); QA of surfaces the agent
built/serves by `cxc-dev-testing` §4.6 (QA-TOOL-LADDER-01, in-app-browser-first;
agbrowse QA-legal only for public-URL response-shape checks). This file
inventories the rungs; it deliberately does not restate either ladder
(skill-hub ownership rule).

## 4. Flag-gated / NOT live (do not instruct usage)

Flag states below come from the same 2026-07-02 `codex features list` run (codex-cli
0.142.5) unless a file path is cited.

| Surface | Evidence | Status |
|---|---|---|
| `spawn_agents_on_csv` + `report_agent_job_result` (CSV batch fan-out, ≤64 workers) | codex-rs snapshot `tools/handlers/agent_jobs.rs`; absent from live tool_search | gated behind `enable_fanout` (under development, false). Mention as future only. |
| Fork provenance in SessionStart | codex-rs `core/src/session/session.rs:1221-1226` maps `InitialHistory::Forked(_)` -> `SessionStartSource::Startup`; hook `source` enum is `startup\|resume\|clear\|compact` only (`hooks/src/schema.rs:786-788`); `forked_from_thread_id` stays internal (`thread_manager.rs:590`) | NATIVE GAP: a plugin hook cannot distinguish /fork from fresh startup. Mitigation shipped as G3 (SessionStart session-id binding + explicit `--session` on mutating orchestrate verbs). Upstream ask: add `"fork"` source or `forked_from` field. |
| `multi_agent_v2` | feature flag is the fallback selector; model catalog pins sol/terra=V2 and luna=V1 | V1 is codexclaw's default, but catalog-selected V2 is live; changes apply to new sessions because the surface pins on first turn |
| `memories` | experimental, false | off |
| `standalone_web_search` | under development, false | hosted `web_search` is the live path |

## 5. Per-skill gap map (what WP-N2..N5 patch)

| Skill | Gap (before) | Patch |
|---|---|---|
| `cxc-search` | routes ALL browsing through agbrowse CLI; native browser/CDP tools never named | Browse-Use Ladder with the 5-tier routing above (WP-N2) |
| `pabcd-state` AGBROWSE directive | "Browser Use / Computer Use" named as vague fallbacks | name the exact plugin tools + ladder (WP-N2) |
| `cxc-dev-testing` | no UI/E2E QA protocol; C-phase evidence is command-output-only | computer-use QA protocol + screenshot/view_image evidence (WP-N3) |
| `cxc-pabcd` / `cxc-dev` | "dispatch spawn_agent" assumes tool visibility | tool_search discovery step + V1 lifecycle (send_input/resume/close) or catalog/flag-selected V2 lifecycle (followup_task/interrupt/list_agents) |
| `cxc-lunasearch` / `cxc-search` (Tier 3) | serial-ish lane guidance | `multi_tool_use.parallel` + wait_agent multi-target patterns (WP-N4) |
| `cxc-dev-uiux-design` / `cxc-dev-frontend` | no imagegen / view_image usage | asset-gen + screenshot-read guidance (WP-N5) |
| `cxc-skill-hub` | catalog only | plugin discovery/install surfaces (WP-N5) |
| `config-guard` | manages 4 flags, silent about browser/computer flags | DECIDED (WP-N5): no code change — `browser_use*`/`computer_use` are stable + default-enabled, so there is nothing to toggle and a doctor row would assert a default. Revisit only if a real regression (flag flipped off) is observed. |

## 6. Honesty rules for this track

- Instruct ONLY tools proven on the live surface (probe or tool_search evidence).
- Every "use X" instruction names the exact tool id (e.g. `chrome:control-chrome`),
  not a marketing phrase.
- Flag-gated surfaces are marked as such wherever mentioned.
- E-level honesty (structure/40): all of this is E7 prose + E4 directives — no hook
  can force a tool call. Wording must say "use", never "enforced".
