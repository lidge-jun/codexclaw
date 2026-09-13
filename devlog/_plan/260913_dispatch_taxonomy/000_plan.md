# 260913 Dispatch taxonomy hardening — roadmap

## Objective

Make the codexclaw skills distinguish two dispatch surfaces that the current
wording lets a reader collapse into one word, "파견":

- **Thread dispatch** — `mcp__codex_app__create_thread` and its family. Creates a
  separate user-owned Codex task with its own worktree, its own session binding,
  its own host goal, and its own PABCD FSM.
- **Subagent dispatch** — `multi_agent_v1__spawn_agent` and its family. Creates a
  leaf that runs **inside the parent's own working tree** with no session state,
  no goal, and no FSM of its own.

The failure this unit closes is concrete. In session `01a0985e` the main agent
planned seven parallel merge lanes, spawned a subagent per lane, and only then
discovered by probe that every lane was writing into the same checkout. It then
had to re-dispatch the lanes as threads. The skills did not say which surface a
parallel lane needs, so the agent had to learn it by experiment.

Host goal: `harden-codexclaw-dispatch-taxonomy-thread-dispat`, session
`01a09876-4f94-7d60-9664-74329d3eb262`. This unit is the docs-only pass required
by LOOP-DOCS-FIRST-01; its D locks the work-phase map below.

## Measured evidence

Everything below was measured in this session on this machine, not recalled.

### A subagent shares the parent's working tree

Probe agent `01a09877-aef9-7872-9470-fc35deac9a00` (nickname Goodall, model
`xai/grok-4.6`) was spawned with `multi_agent_v1__spawn_agent` and asked to
report its own filesystem identity. It returned:

| Probe | Subagent result | Parent |
|---|---|---|
| `pwd` | `/Users/jun/.codex/worktrees/4f59/codexclaw` | identical |
| `git rev-parse --show-toplevel` | `/Users/jun/.codex/worktrees/4f59/codexclaw` | identical |
| `git rev-parse --abbrev-ref HEAD` | `codex/dispatch-taxonomy-hardening` | identical |
| `git rev-parse HEAD` | `af445635b3aa6db480728426ea701212fbdd2d6a` | identical |
| `git worktree list` | the same four entries | identical |
| `CODEX_THREAD_ID` | `01a09877-aef9-7872-9470-fc35deac9a00` | `01a09876-4f94-7d60-9664-74329d3eb262` |

The decisive step was write visibility. The subagent created
`PROBE_SUBAGENT_A.tmp` and then ran git status **against the parent's absolute
path**; the file appeared as `?? PROBE_SUBAGENT_A.tmp` in that worktree's status
before it deleted the file again. A subagent's writes are the parent's working
tree changes, immediately and with no merge step.

### A subagent has a thread id but no session state

The subagent's `CODEX_THREAD_ID` differs from the parent's, so a thread id alone
proves nothing about isolation. After the probe,
`.codexclaw/sessions/` in this worktree still contained exactly one file,
`01a09876-4f94-7d60-9664-74329d3eb262.json` — the parent's. The subagent's id has
no session file, no phase, no ledger, and no goalplan. It cannot hold a PABCD
cycle even if it tried, and `cxc session bind` refuses subagent identities.

### A thread gets its own worktree and its own FSM

Scanning the managed worktree root shows the opposite shape. Every slot under
`~/.codex/worktrees/<slot>/<repo>/.codexclaw/sessions/` holds its own session
json, one per thread: `0292` holds `01a09869-79e9-…`, `6e5e` holds
`01a09869-cb7c-…`, `638d` holds `01a09866-e83f-…`, and so on across the seven
lanes of the opencodex merge run. One thread, one checkout, one FSM.

### The host's own tool text is misleading

`multi_agent_v1__spawn_agent` tells the caller to "instruct the submodel to edit
files directly in its forked workspace". On this build there is no fork: the
measurement above shows the same inode-level directory. The skills must say this
explicitly, because an agent that trusts the tool description will assume an
isolation it does not have and will let two lanes collide on one branch.

## What the hardening must produce

1. A named owner reference for the taxonomy, so every other skill routes to one
   place instead of repeating a partial version of the rule.
2. A routing rule stated as a decision, not a description: parallel branch or
   worktree lanes are threads; bounded slices of the current tree are subagents
   with disjoint write scopes.
3. A tool-schema section that separates V1 from V2 instead of listing both under
   one heading, plus a live-detection step that names the exposed namespace
   before the first dispatch.
4. Thread-surface schema guidance next to the subagent schema, because the
   current delegation reference documents only the subagent side and leaves the
   thread side to be improvised.

## Work-phase map

| Phase | Title | Consumes |
|---|---|---|
| wp1 | This roadmap (docs only) | — |
| wp2 | Dispatch-surface taxonomy: thread vs subagent, parallel worktree rule | `010_wp2_dispatch_surfaces.md` |
| wp3 | Delegation tool-schema split into explicit V1 and V2 sections | `020_wp3_schema_v1_v2.md` |
| wp4 | Ship: gate/test, push, PR into dev, dev into main, plugin reinstall | `030_wp4_ship.md` |

wp2 and wp3 both depend on wp1 and touch different regions of the delegation
reference: wp2 owns the new taxonomy file and the routing edges into it, wp3 owns
the schema sections inside `pabcd/references/delegation.md`. wp4 depends on both.

## Scope boundary

In scope: `plugins/codexclaw/skills/**` prose, the new taxonomy reference, this
plan unit, and the version/changelog touch needed to ship.

Out of scope: the FSM, the goalplan schema, hook control flow, and the orchestrate
gates. This unit changes what agents are told, not which transitions are legal.

Explicit non-goal: no new subagent role and no change to
`mcp__codexclaw__subagents_set` defaults.

### Revision 1 — scope amendment after the wp1 research lanes returned

Two lanes ran during P and both changed the boundary.

The inventory lane found that the wrong-surface wording is not only in prose. The
leaf-guard text that is injected into **every** spawned child lives in
`components/subagent-config/src/spawn-attach-hook.ts` and calls the child a
"delegated task" from a "thread-spawn" without ever saying it shares the parent's
checkout. Prompt strings that every subagent reads are the highest-leverage place
to state the shared-tree fact, so they are pulled into scope. Hook control flow is
not.

The source lane found a factual error in a capability declaration.
`components/subagent-config/src/capabilities.ts:22-24` and
`capability-lock.ts:107` declare V2 spawn as a tool called `create_task`. In
`codex-rs` both families register a tool named `spawn_agent`
(`tools/spec_plan.rs:670-694`); V2 differs by namespace — `collaboration`, from
`config/mod.rs:238`, not `multi_agent_v2` — and by requiring `task_name` plus
`message` in the spawn arguments (`multi_agents_spec.rs:100-141`). `create_task`
is not a tool in either family. Correcting a declared wire identity that source
disproves is in scope; the V2-only discriminator that does exist,
`followup_task`, replaces it.

`detectSpawnSurface` is also wrong in a way this unit can fix cheaply: it returns
`"v2"` unconditionally unless an env var says otherwise, while this very session
is running V1. Given an exposed tool list it can decide from evidence. The env
override stays.

### Source-confirmed facts the hardening rests on

From `/Users/jun/developer/codex/121_openai-codex` at `095da4b7e`:

- `MULTI_AGENT_V1_NAMESPACE = "multi_agent_v1"`
  (`tools/handlers/multi_agents_spec.rs:14`).
- `DEFAULT_MULTI_AGENT_V2_TOOL_NAMESPACE = "collaboration"` (`config/mod.rs:238`).
  There is no `multi_agent_v2` namespace string.
- V1 spawn requires nothing and returns `{agent_id, nickname}`; V2 spawn requires
  `task_name` and `message` and returns `task_name`
  (`multi_agents_spec.rs:65-141`, `386-396`).
- V1 wait may carry the final message in `status.completed`; V2 wait is a mailbox
  that returns `{message, timed_out}` and no content
  (`multi_agents_spec.rs:264-292`, `multi_agents_v2/wait.rs:127-160`).
- V2 has `followup_task`, `send_message`, `interrupt_agent`, `list_agents` and
  **no** `close_agent`/`resume_agent` (`spec_plan.rs:675-694`).
- The cwd is copied from the parent turn for both families:
  `config.cwd = turn_cwd` in `apply_spawn_agent_runtime_overrides`
  (`multi_agents_common.rs:237-252`), called from both spawn paths. No
  `WorktreeManager` or `create_worktree` call exists on the spawn path.
- The V2 system prompt states it outright: "All agents share the same directory …
  edits made by one agent are immediately visible to all other agents"
  (`session/multi_agents.rs:53-59`).
- The "forked workspace" phrase is V1 prompt text at
  `multi_agents_spec.rs:713` and describes nothing in the cwd logic.
  `fork_context` and `fork_turns` fork thread history, not the filesystem.

Desktop thread schemas were read from `/Applications/ChatGPT.app`'s bundle rather
than the CLI checkout, so they are recorded as live-observed, not source-cited:
`create_thread` takes `target.environment` of `local` or `worktree`, and a
`worktree` takes `startingState` of `working-tree` or `branch{branchName,
onMissing}`.
