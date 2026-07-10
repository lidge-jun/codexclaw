---
name: cxc-sparksearch
description: "Codexclaw Spark search lane: cheap parallel public-web discovery via hardcoded gpt-5.3-codex-spark explorer subagents, then hand verified synthesis back to the main model and cxc-search proof discipline. Depends on cxc-search for proof. Use when the user explicitly asks for Spark search, cheap/broad web discovery, parallel research, many source sweeps, 스파크검색, 스파크 서치, 병렬 웹검색, or 싸게 많이 찾아봐."
---

# sparksearch — Cheap Parallel Discovery Lane (depends on cxc-search)

`cxc-sparksearch` is a **dependent tool of `cxc-search`**, not a standalone
search skill. It fans out cheap Spark-model subagents for wide discovery, then
hands every candidate back to the main agent, which runs the `cxc-search` proof
ladder (Tier 1 discover, Tier 2 open-the-source) to settle claims. Spark
discovers; `cxc-search` proves; the main model synthesizes. Never use
sparksearch without this handoff — Spark snippets are leads, not evidence.

## Hardcoded Spawn Path (no catalog probe)

The session surface is pinned on its first turn. V1 is the default unless the model
catalog selects V2 (sol/terra; luna stays V1) or `features.multi_agent_v2` selects it
for a fallback model. If `spawn_agent` is not visible on V1, `tool_search` for it first
(`structure/60_native_capabilities.md` §1). Fan the lanes out as N spawns before
waiting; V1 `wait_agent` returns final status plus content, while V2 `wait_agent` is a
no-content mailbox. Reuse a lane with V1 `send_input(agent_id)` or V2
`followup_task(task_name)`. V1 also has `close_agent`/`resume_agent`; V2 has only
`interrupt_agent`. The concurrency limits are V1 `agents.max_threads` (default 6) and
V2 `max_concurrent_threads_per_session` (default 4, root included).

The user of this skill is already running on Spark, so do **not** call
`catalog_list` or any model-picker probe before spawning. Hardcode the model
directly on every spawn call:

```text
agent_type: "explorer"
model: "gpt-5.3-codex-spark"
reasoning_effort: "medium"
```

If the spawn call returns a model-not-found / invalid-model error, do not retry
with a probe. Fall through to **serial dispatch** immediately: re-issue the same
spawn without the `model` field so the subagent inherits the main session model.
State plainly which path each agent took. No silent fallback to 5.5 and no
catalog round-trip — the error itself is the signal, and the serial retry is the
recovery.

Use `reasoning_effort: "low"` only when the user explicitly asks for maximum
speed. Keep final judgment in the main session regardless.

## Subagent Skill Attachment (attach cxc-search, not prose)

Do not hand-write a tool directive in the spawn message. Attach `cxc-search`
through the preferred `[$cxc-search](skill://<abs SKILL.md path>)` form, or the
plugin-native `$codexclaw:cxc-search` fallback when the path is not link-safe,
so each Spark subagent auto-loads the proof ladder (Tier 1
`web_search` + Tier 2 open-the-source) at launch. The skill body is the single
source of truth for the tool list; this skill only adds the lane assignment and
the Spark model.

The portable default is a **link-form mention in the spawn message**. V1 parses it on
the child's first turn; upstream V2 does not, so the codexclaw spawn hook inlines the
recognized skill's full SKILL.md body into the V2 message:

```text
message: "[$cxc-search](skill://<cxc-search SKILL.md absolute path>)
TASK: one lane in a Spark search swarm. LANE: <source class / query family>. Run 5-10 distinct queries; open the source for every result that matters. Return 3-5 findings with URLs, dates, source type, primary-or-lead flag. No edits, no questions."
```

On the v1 surface the structured `items` channel is equivalent (exact selection)
when routing through the spawn-wrapper builder:

```text
items: [
  { type: "skill", name: "cxc-search", path: "<cxc-search SKILL.md absolute path>" },
  { type: "text",  text: "TASK: one lane in a Spark search swarm. LANE: <source class / query family>. Run 5-10 distinct queries; open the source for every result that matters. Return 3-5 findings with URLs, dates, source type, primary-or-lead flag. No edits, no questions." }
]
```

(v2 `deny_unknown_fields` rejects `items` — there the recognized mention plus the
hook-inlined body is the attachment.)

Do not duplicate the Tier 1/2 tool list as inline prose — the attached skill
already carries it. A subagent that cannot open pages must flag every finding as
`candidate — unverified snippet` in its return.

## Use Case

Use Spark search when breadth matters and each subtask can be narrow:

- release/news/changelog sweeps across many vendors
- competitor or ecosystem scans
- "find many sources first, judge later" research
- Korean requests such as `스파크검색`, `spark로 5개 돌려봐`, `병렬 웹검색`,
  `싸게 많이 찾아봐`
- workflows where a 5.5 main session should conserve quota by delegating source
  discovery to Spark

Do not use it for local repository grep, one-source latest/current facts,
implementation work, or high-stakes final advice without primary-source proof.

## Swarm Shape

Default to five `explorer` subagents. Use three for smaller research and two for
corroboration only.

Assign one distinct lane per agent. Do not send duplicate prompts — rewrite the
user request into query families, then give each agent one family:

- official docs/changelogs (`site:<docs-domain> changelog`)
- vendor blogs/release notes (`site:<blog-domain> "release notes"`)
- GitHub releases/issues/discussions (`site:github.com <topic>`)
- standards/specs/API references (`filetype:pdf <topic> spec` or
  `intitle:specification <topic>`)
- independent reports, benchmarks, community findings
  (`site:reddit.com OR site:news.ycombinator.com <topic> after:<date>`)

Search English first — it is the largest authoritative corpus. Add a
local-language sweep only when the topic is inherently local or the user asks
for sources in a specific language.

## Spawn Contract

Each Spark subagent gets: (1) the `cxc-search` mention in its message and (2) a short
task naming its lane (see the attachment section above). V1 may use structured `items`
when the caller supplies that channel manually. The skill carries the tool list and
proof rules; the task carries only the lane assignment and return shape. No five-part
hand-written message — the attached skill is the tooling contract.

Spawn all lanes in one turn — parallel, not sequential. Report the spawned
agent ids/nicknames to the user. The runtime may choose nicknames; do not claim
manual naming unless the spawn tool supports it.

## Proof Handoff (to cxc-search)

Spark output is candidate evidence only. After the swarm returns, the main agent
runs the `cxc-search` proof ladder on the strongest candidates:

1. Build a compact claim ledger:
   - claim, source URL, date, source type, Spark lane, status
   - status: `candidate`, `verified`, `contradicted`, or `unreachable`
2. Open primary sources (cxc-search Tier 2) before final synthesis. Prefer
   official docs, release notes, source repositories, specs, and original
   announcements.
3. When sources conflict, state which source wins and why. Do not average.
4. Mark snippet-only or unreachable items as unverified leads.

For a high-risk non-code claim (price, market share, dated, causal), require
>=2 independent source domains plus a counter-search before promoting it to
verified — the ultraresearch claim-ledger gate, applied lightly.

## Final Report

Return compactly:

1. Spawn path: hardcoded Spark used, or serial-fallback after error.
2. Swarm: number of agents and lanes.
3. Verified findings: source-opened claims only.
4. Open leads: promising but unverified Spark results.

Never treat Spark snippets or subagent summaries as final proof.

## Gap note (vs lazycodex ultraresearch)

This skill is intentionally lighter than lazycodex `ultraresearch`. It does not
run the EXPAND convergence loop, keep a session journal, verify by executing
code, or generate reports — those belong to `cxc-search` Tier 3. sparksearch is
the cheap one-shot discovery fan-out; ultraresearch is the deep multi-wave
research protocol. Use sparksearch when breadth-for-cost is the goal; escalate
to `cxc-search` Tier 3 when the question needs iterative expansion and
contested-claim verification.
