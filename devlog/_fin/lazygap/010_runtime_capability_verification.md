# 010 — Runtime Capability Verification (codex-rs source of truth)

Status: VERIFIED (codex-rs read, 2026-07-01) · evidence: 2 parallel explorers (Euclid/Descartes)
over `/Users/jun/Developer/codex/121_openai-codex/codex-rs` + omo `lazycodex-executor-verify`

> The lazygap roadmap (009) left two runtime facts as OPEN questions that decided whether
> `002` (SubagentStop evidence gate) and `008` (skill-attached dispatch) are real E1/E3
> enforcement or only E5/E7 doctrine. Both are now answered against the Rust runtime, not
> guessed. This doc is the canonical capability record; `002`/`008`/`009` cite it.

## Q1 — Does `SubagentStop` fire for plugin-spawned subagents, with the child's final text? -> YES (E1 confirmed)

`SubagentStop` is a real `HookEventName` variant (10 total: PreToolUse, PermissionRequest,
PostToolUse, PreCompact, PostCompact, SessionStart, UserPromptSubmit, **SubagentStart**,
**SubagentStop**, Stop) — `protocol/src/protocol.rs:1355`, `hooks/src/schema.rs:99`,
`hooks/src/lib.rs:19`.

| Fact | Verdict | codex-rs evidence |
| --- | --- | --- |
| Event exists | YES | `protocol.rs:1355` (enum), `schema.rs:99` (`HookEventNameWire`) |
| Fires for plugin thread-spawned children | YES | `hook_runtime.rs:294-355` maps thread-spawned child turns to `StopHookTarget::SubagentStop`; comment "Root turns run Stop; thread-spawned child turns run SubagentStop" `hook_runtime.rs:300` |
| Parent gets the child's Stop? | NO — child fires `SubagentStop`, parent gets nothing for that child | `hook_runtime.rs:294-355` |
| Internal (non-thread-spawn) subagents | fire NEITHER Stop nor SubagentStop | `hook_runtime.rs:339-341` |
| stdin payload | `session_id, turn_id, transcript_path, agent_transcript_path, cwd, hook_event_name, model, permission_mode, stop_hook_active, agent_id, agent_type, last_assistant_message` | `schema.rs:578-595` (`SubagentStopCommandInput`) |
| Child final text reachable | YES — `last_assistant_message` is filled from finalized output | `stop.rs:116-178`, `turn.rs:321-329`, `turn.rs:1644-1656` |
| `decision:"block"` + `reason` forces continuation | YES — reason becomes a continuation prompt, turn loop re-enters | `stop.rs:263-274,351-358`, `turn.rs:330-340`; one decision variant `block` `schema.rs:476` |
| Plugins may register it | YES | `config/src/hook_config.rs:48`, `:113`; `hooks/src/declarations.rs:12`; app-server schema `config.rs:408`; TUI label "Right before a subagent ends its turn" `hooks_browser_view.rs:755` |

**Consequence for `002`:** the SubagentStop evidence gate is genuine **E1** (it can refuse a
child's "done" and force it to produce a receipt), not doctrine. The matcher keys on
`agent_type` (omo uses `^lazycodex-executor$`, `lazycodex-executor-verify/hooks/hooks.json:3`),
exactly as omo's `runSubagentStopHook` reads `agent_type` + `last_assistant_message` +
`transcript_path` and blocks up to `MAX_ATTEMPTS` (omo `src/codex-hook.ts:11-30`).

### Bonus surface discovered — `SubagentStart`

`SubagentStart` also exists in the same enum (`protocol.rs:1355`). It is a child-spawn entry
point a future loop could use to inject a per-child directive (e.g. the attached-skill TASK
contract for `008`) at the moment the subagent starts, complementing the SubagentStop receipt
check. Not scheduled yet; recorded so the roadmap knows the surface is real.

## Q2 — Does a `^spawn_agent$` PreToolUse matcher fire + allow input-rewrite? -> YES on v1, BLOCKED on v2 (split E3/E5)

| Fact | Verdict | codex-rs evidence |
| --- | --- | --- |
| PreToolUse matches on `tool_name` (+aliases) via handler `matcher` | YES | `engine/dispatcher.rs:47-59`, `events/pre_tool_use.rs:58`, `events/common.rs:146` |
| `^spawn_agent$` is treated as regex | YES (regex when matcher has regex chars; literals are exact) | `events/common.rs:129-161` |
| Spawn tool names | v1 = namespace `multi_agent_v1` + `spawn_agent`; v2 default = plain `spawn_agent`; v2 can be wrapped in a configured namespace | `multi_agents_spec.rs:11,62,93`; v1 `multi_agents/spawn.rs:27`; v2 `multi_agents_v2/spawn.rs:29` |
| Hook-facing name canonicalized to `spawn_agent` | YES for v1 + default v2 (alias `"Agent"`) | `registry.rs:727-734`, `hook_names.rs:46` |
| PreToolUse fires before the spawn handler runs | YES | `registry.rs:502` (hooks) before `:563` (handler); function payload `:107` |
| `updatedInput` rewrite supported + applied pre-dispatch | YES, but **only when `permissionDecision == allow`** | schema `schema.rs:239`,`:126`; parser allow-gate `output_parser.rs:162,434`; applied `registry.rs:523`, `hook_runtime.rs:185` |
| v1 accepts an injected `items` field | YES — v1 args are NOT `deny_unknown_fields` and `items` is a declared field | `multi_agents/spawn.rs:218,221`, spec `:552` |
| v2 accepts an injected `items` field | NO — v2 args are `#[serde(deny_unknown_fields)]` and omit `items`; injection fails parse | `multi_agents_v2/spawn.rs:243-244`, spec `:586`, parse `handlers/mod.rs:77` |
| v2 under a custom namespace | `^spawn_agent$` does NOT match (falls back to `flat_tool_name` = namespace+name, no separator) | `registry.rs:737`, `tools/mod.rs:37`, `tool_name.rs:37` |

**Consequence for `008`:** deterministic skill attachment via E3 (`^spawn_agent$` PreToolUse
`updatedInput` adding `items`) is **REAL on the v1 spawn surface** (`multi_agent_v1__spawn_agent`),
and **structurally impossible on v2** (strict schema rejects `items`). So the routing spine is:

- **E3 (deterministic)** when the runtime exposes v1 `spawn_agent` — attach `items` via the
  allow+updatedInput rewrite. This sharpens (and confirms) the mvp_hard G4 finding.
- **E5 (builder doctrine)** as the durable fallback for v2 / custom-namespaced spawn, where the
  main agent must route through `resolveSpawnPayloadWithSkills` itself because no hook can inject.
- A `^spawn_agent$` hook must therefore **fail-open**: if it cannot prove a v1 surface, it must
  `allow` untouched (never deny), because denying a v2 spawn it cannot rewrite would break dispatch.

## Net effect on the roadmap (009)

- `002` open question -> **RESOLVED YES**: SubagentStop is E1. Promote it from "maybe doctrine"
  to a committed E1 hook; matcher on `agent_type`, payload carries `last_assistant_message`.
- `008` open question -> **RESOLVED SPLIT**: E3 on v1, E5 on v2; the hook fails open. No longer
  "verify first" — verified.
- Receipt convention (009 Q3) stays codexclaw's `--evidence`/`.codexclaw/evidence/` (omo uses
  `.omo/evidence` + `EVIDENCE_RECORDED: <path>`); adopt the same last-line marker contract.
