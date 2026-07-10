---
created: 2026-07-02
tags: [codexclaw, native-tools, browser-use, computer-use, subagents, capability-matrix, sot]
aliases: [Native Capability Matrix, codex native tools, browse use, computer use]
---

# 60 — Codex Native Capability Matrix (SOT)

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
| `multi_tool_use.parallel` | run several tool calls concurrently | `cxc-sparksearch`, `cxc-search` |
| `list_mcp_resources` / `read_mcp_resource` | MCP resource surface | situational |
| `list_available_plugins_to_install` / `request_plugin_install` | plugin discovery/install | `cxc-dev` |

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
| `cxc-sparksearch` / `cxc-ultraresearch` | serial-ish lane guidance | `multi_tool_use.parallel` + wait_agent multi-target patterns (WP-N4) |
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
