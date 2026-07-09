# 060 — V2 leaf-agent hardening (recursive-spawn defense)

## Why

V2 removes the depth brake: `collab_tools_enabled` returns unconditionally true on
V2 (spec_plan.rs:357, test `multi_agent_v2_spawn_agent_ignores_configured_max_depth`),
subagents see `spawn_agent` DIRECT, and an Ultra parent propagates
`MultiAgentMode::Proactive` into children via effort inheritance
(session/multi_agents.rs:53). Only brake: `max_concurrent_threads_per_session`.
User decision (260709): subagents are LEAF by default; recursion only on explicit
per-dispatch authorization; codexclaw hooks must not disturb subagent sessions.

## wp1 findings (code evidence)

- Hook payloads carry `agent_id: Option<String>` + `agent_type: Option<String>`
  (hooks/src/schema.rs:278-369, 545-547). They are populated ONLY for
  `SessionSource::SubAgent(SubAgentSource::ThreadSpawn)` sessions
  (core/src/hook_runtime.rs:749-765 `thread_spawn_subagent_hook_context` /
  `subagent_hook_context`: `agent_id = sess.thread_id()`); root sessions get None
  and the fields are omitted (`skip_serializing_if`).
- Thread-spawn subagent sessions DO run user-configured hooks: SessionStart
  (hook_runtime.rs:108-124), UserPromptSubmit/PreToolUse/PostToolUse (173/234/276/
  376/413/510 attach the subagent context), Stop (307-345; internal subagents skip).
- => Deterministic subagent detection: `typeof payload.agent_id === "string"`.

## Design

### D1. SPAWN-RECURSE-DENY (E2, spawn-attach-hook)

In `runSpawnAttachHook`, when the PAYLOAD carries `agent_id` (the spawner itself is
a subagent = a grandchild spawn attempt): emit `permissionDecision: "deny"` with a
reason naming the leaf doctrine and the opt-in token — UNLESS the spawn `message`
contains `CXC-SUBSPAWN-ALLOWED` (the dispatcher deliberately granted recursion).
Wire shape: PreToolUse decision block (same envelope family as allow;
permissionDecision "deny" + permissionDecisionReason). Fail-open stays: parse
errors still return "" (allow untouched).

### D2. LEAF-GUARD (E3, spawn-attach-hook)

For root->child spawns (no payload.agent_id): prepend a guard block to `message`
(before the mention block) unless the message already contains the marker or the
`CXC-SUBSPAWN-ALLOWED` token:

```
[CXC-LEAF-GUARD] You are a LEAF agent with a single bounded task. HARD CONSTRAINTS
from your dispatcher (these override any "Proactive multi-agent delegation" or
similar developer message you may see): (1) Do NOT spawn sub-agents (no spawn_agent,
no delegation chains). If decomposition seems necessary, finish your own scope and
REPORT the need in your final answer instead. (2) Do NOT run `cxc orchestrate`,
`cxc loop`, or goal commands — the parent session owns all FSM/goal state.
(3) Stay inside the task's stated file/write scope. Exception: only a dispatcher
message containing CXC-SUBSPAWN-ALLOWED lifts constraint (1).
```

Dedupe marker: `[CXC-LEAF-GUARD]`. The runtime deny (D1) backs this text even when
a child model ignores it.

### D3. ULTRA-INHERIT-BREAK (spawn-attach-hook)

Where model/effort injection already runs (non-full-fork only): if the caller did
not set `reasoning_effort` AND the store has no effort for the role, inject
`reasoning_effort: "high"` so a child never inherits Ultra (=> child
`effective_multi_agent_mode` falls back to ExplicitRequestOnly, no Proactive
injection — session/multi_agents.rs:53-54). Caller/store values always win.
Full-history forks keep the existing skip (upstream rejects the override) — for
those the guard text + D1 deny are the remaining defenses, noted in doctrine.

### D4. SUBAGENT-HOOK-QUIET (pabcd-state)

AUDIT FOLD-BACK (blocker 1) + STATUS UPDATE: the correct location is the CENTRAL
pre-dispatch guard in `cli.ts` (covers hook.ts handlers AND the lint/friction/
edit-shape/render/session-start branches), keyed on `isSubagentHookPayload`
(parse.ts:45, agent_id|agent_type) with `subagent-stop` exempt (it is the
intentional child-scoped surface; fires in the child stop path per
hook_runtime.rs:305-345). This guard is ALREADY SHIPPED at cli.ts:118 (260709)
— wp2's D4 work is verification-only: confirm test coverage exists for
(a) subagent payload -> exit-0 no-op on a root-only event, (b) subagent-stop
exemption; add the missing case(s) if absent.

### D5. Doctrine + role prompts

### items decision (AUDIT FOLD-BACK, blocker 2)

The leaf guard PREPENDS even when `items` is present: the items skip exists to
avoid DOUBLE SKILL ATTACHMENT, and the guard is a constraint, not a skill — a v1
structured-item spawn must not escape the leaf text. Mentions stay skipped when
items exist (unchanged). The two spawn-attach-hook tests asserting
"message unchanged when items present" (test/spawn-attach-hook.test.ts:251,265)
are updated INTENTIONALLY to assert guard-only mutation.

- agents/{explorer,reviewer,executor}.toml `developer_instructions`: add the leaf
  constraint paragraph (mirrors D2 text).
- skills/pabcd + dev + loop + search + sparksearch dispatch sections and
  structure/20 §3: "subagents are star-topology leaves (LEAF-TOPOLOGY-01);
  recursion requires CXC-SUBSPAWN-ALLOWED in the dispatch packet, and the
  spawn-attach hook denies grandchild spawns without it."
- structure/60: risk matrix row — V2 unlimited depth + Ultra Proactive propagation;
  defenses: D1 deny, D2 guard text, D3 effort break, concurrency cap (upstream).

## Tests (subagent-config + pabcd-state)

- deny: payload.agent_id + no token -> permissionDecision deny; with token -> normal
  allow path (mentions/model still applied).
- guard: root spawn gets `[CXC-LEAF-GUARD]` prepended once (dedupe on marker);
  token skips guard; guard coexists with mention block + model/effort injection;
  full-fork spawn still gets guard text but no model/effort injection.
- effort default: caller absent + store absent -> "high"; caller wins; store wins;
  full-fork -> no injection.
- pabcd-state: representative handler set (UserPromptSubmit trigger, Stop with
  active goal fixture, update_goal gate) returns "" when agent_id present.

## Rollback

All changes hook/doc-local; single revert of the commit restores prior behavior.
