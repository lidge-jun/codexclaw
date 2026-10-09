## Delegation Model (subagents)

Choose the surface first in [dispatch surfaces](dispatch-surfaces.md). This file
owns subagent packets, role transport, family schemas and managed fallback.
Before assigning isolation or goal/FSM ownership, follow that surface owner
(DISPATCH-ISOLATION-01, LEAF-TOPOLOGY-01).

### Packet contract

**DISPATCH-TASK-01 (DEFAULT).** Every packet contains `TASK`, `SCOPE`, `MUST DO`,
`MUST NOT`, `PROOF`, `RETURN FORMAT` and a decision/stop boundary. Supply the
concrete plan, read bounds, write scope and peer-edit protections; the child must
not reconstruct the plan. For a managed-worktree worker, name the absolute path
as every shell workdir and use absolute edit paths.

**DISPATCH-ECONOMY-01 (DEFAULT).** Delegate specifiable work only when its
coordination cost is justified. Children return evidence and unresolved judgments;
main decides and integrates.

**DISPATCH-AGENT-TYPE-01 (DEFAULT).** Use supported read-only roles for consultation
and review, and a supported write role for implementation. Formal P and A duties
belong to [Plan](phase-plan.md) and [Audit](phase-audit.md).

A registered executor uses native `executor`; otherwise use built-in `worker`
if permitted. With PABCD enabled, executor receipts are gated on every
SubagentStop; worker receipts are gated only during the parent's active B/C cycle.
Disabled PABCD leaves both gates silent; worker outside that cycle releases
without a receipt.

**DISPATCH-VERIFIER-01 (DEFAULT).** Return one verifier result per required
command, each matching its command with exit 0; no result may name an unrequired
command when the packet specifies commands. Put extra checks in commands-run.
In a shared-read packet, only an explicitly read-only verifier
(`expectedWrites: []`) runs in the shared tree. Declared writes, isolation or
missing declarations require an isolated copy or referral to main. Effect
declarations are claims; codexclaw neither executes the verifier nor proves isolation.

### Optional worker progress checkpoint

Main may grant a specific `PROGRESS.md` path inside a long-running worker's
assigned worktree. Record `Done`, `Remaining` and `Partial files` (absolute
paths and unfinished parts) after a coherent edit or check. Without that grant,
create no checkpoint.

This is a handoff hint, not proof or authority. On interruption, main verifies
termination, reads the checkpoint and partial files, then gives the replacement
the same bounded packet, worktree and remaining work. The replacement checks
actual file state before editing.

**DISPATCH-PROMOTE-01 (DEFAULT).** After verifying child evidence, main records
the accepted reusable result, failure cause or procedure, provenance and unresolved
claims. Record verified findings rather than child claims. Durable memory writes
still require an explicit request; do not add an automatic writer. Load an
explicitly required task source or report it missing before the governed action.

### Discovery packet

Dev owns the discovery decision. Specialize the packet above as follows:

| Field | Discovery content |
|---|---|
| TASK | One independently answerable question |
| SCOPE | Bounded child read area and main's separate work |
| MUST DO | Trace the answer and stop when answered |
| MUST NOT | Writes or overlap with main |
| PROOF | Exact `path:line` quotations, figures and source URLs |
| RETURN FORMAT | Direct answer, key anchors and uncertainties; no full dumps, candidate lists or exploration narrative |
| DECISION BOUNDARY / STOP | Return unresolved judgments and scope growth to main |

For managed discovery, use [configured first fallback](#configured-first-fallback)
reports: `created` records creation, not completion. Validate native completion
before a separate `complete` report; omit `observedModel` without runtime proof.

### Live tool schema and role transport

Use the loaded schema rather than a version label. Explicit native explorer tasks
remain explorer despite review words. On legacy reviewer-as-explorer transports,
use a deliberate `CXC-ROLE: reviewer` header; keyword inference applies only to
unspecified roles. V1 accepts `message` or `items`: preserve attachments and do
not send both as a routing workaround.

Use `agent_type` and `task_name` only when exposed. Otherwise put the logical
role, task/lens and exact read/write bounds in the message. Prompt labels cannot
select native permission profiles or bypass receipts/guards. Report any required
protection the transport cannot represent.

Prefer native `executor` when exposed; built-in `worker` is the permitted
unregistered fallback. The resolver selects worker when
`$CODEX_HOME/agents/executor.toml` is absent. Disk registration does not prove the
current session loaded a role. Optional authorized setup is
`cxc subagents register executor`, then restart Codex; it updates unchanged
managed prompts while preserving user edits, models and permissions. Never
substitute a role forbidden by the user or host.

Use the actual returned handle and live follow-up/wait/retirement schema, not
display labels or guessed IDs. Apply only supported fork/model/effort/tier fields
within user constraints. Observe actual settings before claiming exact identity;
do not mutate shared or persistent role configuration without authorization.
Reading this owner does not turn ordinary work into an A audit.

Discover spawn capability through the host catalog/search where available; report
a missing capability. Fan out independent packets before waiting. Reuse the same
reviewer throughout one A loop. Before waits or retirement, read
[waiting](../../loop/references/waiting.md). Suspected-stall checkpoints are
non-interrupting: V1 `send_input` without `interrupt`, V2 `send_message`.
A queued checkpoint may be unread and proves no stall.

### Detect the family first (DISPATCH-SCHEMA-DETECT-01, STRICT)

Identify and record the exposed family from companion tools before dispatch.
`spawn_agent` alone cannot distinguish families.

| Signal | Family |
|---|---|
| `send_input`, `close_agent`, `resume_agent` | V1 |
| `followup_task`, `send_message`, `interrupt_agent`, `list_agents` | V2 |
| `wait_agent` | Neither; V1 has it, V2 optionally |

V1 uses `multi_agent_v1`; V2 defaults to configurable `collaboration`.
`multi_agent_v2` is a feature flag, never a namespace. Match bare names or the
`collaboration` prefix with empty, dot or underscore separators. If unresolved,
report the capability gap; do not substitute a thread for a subagent.

### SessionStart dispatch card

The SessionStart card states the family (V1 override or unresolved), the dated
`alias=id` line (`?` means absent from the local catalog), and a pointer here.
Run the cell once before the first spawn, replace the probe message with the task,
and apply managed fallback first. With the V1 override, use
`tools.multi_agent_v1__spawn_agent`; wait, close, `send_input` and resume use the
same `multi_agent_v1__` prefix. Catalog membership does not prove runtime routing.

Aliases (map 2026-09-24; local catalog membership only):

| Alias | ID |
|---|---|
| deepseek | `command-code/deepseek-deepseek-v4.1-flash` |
| swe2 | `devin/swe-2` |
| kimi | `kimi/kimi-for-coding-highspeed` |
| sol | `gpt-6-sol` |
| luna | `gpt-6-luna` |

```js
const n = ALL_TOOLS.map(t => t.name), has = r => n.some(x => r.test(x));
const s = n.filter(x => /spawn_agent$/.test(x));
if (s.length !== 1) throw new Error("expected one spawn_agent helper, found " + s.length);
const v1 = has(/(send_input|close_agent|resume_agent)$/), v2 = has(/(followup_task|interrupt_agent|list_agents)$/);
if (v1 === v2) throw new Error("collab family unresolved: v1=" + v1 + " v2=" + v2);
const a = {message:"Report your model and say OK; do not edit files.",model:"command-code/deepseek-deepseek-v4.1-flash",reasoning_effort:"low"};
text(await tools[s[0]](v1 ? a : {...a, task_name:"model_probe", fork_turns:"none"}));
```

### V1 — `multi_agent_v1`

| Concern | V1 |
|---|---|
| spawn | `spawn_agent({ message \| items, model?, reasoning_effort?, fork_context? })` |
| handle | returns `{ agent_id, nickname }`; address by `agent_id` |
| wait | `wait_agent({ targets[], timeout_ms })` returns final status that **may carry the final message**; a timeout is a normal outcome, not failure evidence |
| follow-up | `send_input({ target, message \| items, interrupt? })` |
| stop | `close_agent({ target })`, returning the previous status — which, for a completed child, can contain the ENTIRE report |
| restore | `resume_agent({ id })` |
| history | `fork_context: true` copies the parent's history; default is prompt-only |

A spawn needs `message` or `items` even if the schema marks neither required.
Address `agent_id`, never `nickname`. Before Code Mode spawn, follow
[the dispatch card](#sessionstart-dispatch-card).

**DELEGATE-MODEL-LIST-01 (STRICT).** The advertised model list is a hint, not an
allowlist. Pass a user-named model through unchanged; only an actual spawn
rejection proves unavailability. Report that rejection rather than silently
substitute a model or re-plan the requested ratio.

### V2 — the task-shaped family

| Concern | V2 |
|---|---|
| spawn | `spawn_agent({ task_name, message, ... })` — both fields required |
| handle | the caller-supplied `task_name`, canonical as an agent path |
| wait | `wait_agent` is a **no-content mailbox**: it reports that updates exist, never the text. It is also optional, and takes only `timeout_ms` — there is no `targets` argument |
| follow-up | `followup_task` starts a turn; `send_message` only queues context |
| interrupt | `interrupt_agent` stops the current turn; the agent stays available |
| close/resume | none |
| listing | `list_agents` |
| history | `fork_turns: "none" \| "all" \| "<n>"`, not a boolean; a full-history fork inherits the parent model and rejects overrides |

### V1 consume-once lifecycle

**DISPATCH-CONSUME-ONCE-01 (DEFAULT).** Consume a report once per child task per
turn from whichever surface delivers it first: notification, wait or close.
An in-flight wait may repeat already-read content; issue no extra wait solely to
fetch it again. Still close completed V1 children to release their slots; V2 has
no close operation.

When projection is available, return status/error metadata for already-consumed
content. Deduplication by agent ID alone fails when an agent is reused for another
task. Never discard unread content or new errors. Wait has no content-suppression
argument.

### The thread surface is a different schema

Before thread work, read [lane dispatch](../../loop/references/lane-dispatch.md)
for the single host envelope, and [dispatch surfaces](dispatch-surfaces.md)
for isolation and permission routing (DISPATCH-FORK-LANE-01).

### Delegation safeguards

**REVIEW-DECORRELATE-01 (DEFAULT).** Prefer independent context. Use a different
model family only within host policy and user authorization; otherwise inherit
and disclose that family independence was not established. Review packets carry
the original brief, constraints, rubric and source anchors, excluding main's or
a prior reviewer's conclusion. Repair rounds may include prior findings.

**SPECIALIST-CRUX-01 (DEFAULT).** Have a specialist re-derive a narrow crux outside
the builder's domain. Preserve exact `path:line` quotations, figures and URLs
for main's spot-check.

### Failure classes

Report transport, capacity, timeout and child failure separately. Stop equivalent
retries after transport failure, including encrypted work main cannot read;
change neither settings nor permissions to work around it. A timeout proves
neither rate limiting nor encryption. Retirement belongs to
[waiting](../../loop/references/waiting.md#retirement-and-handoff); managed recovery
belongs to [configured first fallback](#configured-first-fallback).

### Architect context and routing

Architect is a configurable read-only logical role with `dev` and
`dev-architecture` attached. It cannot own goal/FSM, write, spawn children,
replace main's decisions or replace independent review. Select from live schema:

| Available transport | Action |
|---|---|
| Native `agent_type: "architect"` | Use it; native type owns routing even without a marker |
| No `agent_type` field | Lead supported `message` or text-`items` with `CXC-ROLE: architect` before `TASK:`; attach both skills and read-only/no-child/no-goal/FSM boundaries |
| `agent_type` exists but architect is absent | Report unmet setup; only with installation authority register architect, start a fresh session and verify it |

The no-role-field route is supported dispatch, not an exception needing approval,
registration or restart. Never register secretly or substitute explorer/reviewer
for a required architect. Logical read-only scope is an instruction, not a native
sandbox. If native protection is required but unavailable, report the gap.

Consultation, same-architect reflection and independent review follow
[formal P](phase-plan.md#architect-consultation-for-formal-p).
Do not discard real consultation evidence or claim a blocker solely because the
schema lacks a role field. Preserve existing approvals across continuations.
Missing output, failed calls or unavailable required protection remain gaps.

The same header supports read-only reviewer/explorer routing. Explicit native
write/reviewer roles win; a marker cannot select a write role. Keep `CXC-ROLE:`
out of role prompt overrides to avoid shifting role on repeated hook passes.
Use supported payload instructions and skill attachments.

Retain configured model/effort, default inheritance and caller overrides; no
provider is a universal architect default. Hook routing needs readable message
or text-item metadata. Ciphertext does not prove model injection; without readable
metadata, inference may choose another role. Native architect type retains its
routing. Prompt labels or payload adaptation do not prove runtime settings.
Honor full-history fork restrictions and report unobserved routing as unverified.

Use the returned handle for proposal, reflection and decision revisions within
one plan. Start fresh for a new plan; promise no reuse cost savings. Empty timed
waits do not prove failed calls.

Preserve actual call-failure evidence. Managed recovery follows
[configured first fallback](#configured-first-fallback); unmanaged recovery follows
[retirement and handoff](../../loop/references/waiting.md#retirement-and-handoff)
(DISPATCH-RETIRE-01). Main self-check cannot replace missing consultation: report
it and stop dependent completion. Do not silently change models, register roles
or bypass host/user restrictions.

## Speculative dispatch (DISPATCH-SPECULATE-01, HEURISTIC)

Phase-N+1 dispatch during phase N is default-off. Only phase-invariant external
research reading no repository state may overlap. Mark it `candidate — unverified`,
revalidate against the landed tree at the next P and discard it when the phase map
changes (DISPATCH-ECONOMY-01).

## Configured first fallback

When a role has `fallback` configured, the main session uses `cxc subagents dispatch`
with JSON on stdin before its first native call. The command selects and records
candidates; it does not invoke a model or native tool. SessionStart announces this
protocol. A PreToolUse reminder after a direct call cannot retroactively manage it.

1. `start`: supply `sessionId`, a unique `dispatchId`, and `role`.
2. `claim`: supply those IDs and the returned `attemptId`. Only `action:spawn`
   permits one native call. Prepend the returned `marker` and a newline to the
   original bounded task and required skills. Use a fresh context and the returned
   candidate's model/effort (null inherits the original session). Preserve the role.
3. Every report includes `sessionId`, `dispatchId`, and the current `attemptId`.
   Report `outcome:created` and the actual `agentId`, then use native wait. Report
   `outcome:complete` with that ID only after validating the final work. A native
   completed status does not prove the task succeeded; terminal reports cannot be reopened.
4. On provider failure report `outcome:failed`, the original `error`, and `executionState`:
   `not_created`, `stopped`, `unknown`, or `running`. Known no-child failures need
   concrete `reconciliation` evidence. A stopped child requires its recorded
   `agentId` and evidence that work/processes stopped and changes were inspected;
   a stop call returning previous status `running` is not that evidence — verify
   the current terminal state and owned processes first. Pass only remaining work
   to the replacement. Unknown outcomes never authorize
   another child. If native spawn is absent, report `outcome:unavailable` with
   confirmed `not_created` and capability evidence, never a policy denial.
   For confirmed stagnation or unusable final output, use `outcome:task_failed`
   with `taskFailure: {kind: "stagnation" | "unusable_output", evidence: "..."}`.
   This requires a recorded child, `executionState:stopped`, matching `agentId`
   and `reconciliation`; running or unknown work must be reconciled first.
   Task evidence explains the failure; reconciliation explains termination and
   partial-work inspection. Both are non-empty text of at most 2000 characters.
   No other task kinds or taskFailure keys are accepted. Never label cancellation,
   exhausted bounds, a wait timeout alone or a supported disagreement as task failure.
5. `ready` means claim the next attempt. `main-direct` means main reclaims the
   remaining work; `independentReviewRequired` stays true for reviewer tasks.
   Main implementation is never independent review. `stop` or `reconcile` means
   no model switch or direct-execution permission. Inspect the reason and state.

A task-failure report has no provider `error`; for example:

```json
{"action":"report","outcome":"task_failed","sessionId":"<main-id>","dispatchId":"<task-id>","attemptId":"<attempt-id>","agentId":"<child-id>","executionState":"stopped","taskFailure":{"kind":"unusable_output","evidence":"Final answer addresses a different task; the required result is absent."},"reconciliation":"Verified terminal child, no owned processes, and inspected partial edits."}
```

A supplied provider error retains precedence: stop errors stop and unknown errors
reconcile; next-eligible provider errors must use `outcome:failed` instead of a mixed
report. Accepted task failures record `taskFailure` and clear the attempt's provider
`code`. These observations are main's assertions, not authenticated native receipts.

Use `action:status` to recover after interruption. It never reissues an executable
spawn. A claimed attempt with a lost response must be reconciled, not claimed
again. Do not remove locks to make a retry work. If a lock survives a crashed
CLI process, the task owner first verifies that no writer process remains and
reconciles native child status and workspace changes. Preserve the dispatch JSON
as evidence; only then remove that task's empty `.json.lock` directory with
`rmdir` and inspect `status`. A claimed attempt still does not become replayable.
Never delete dispatch state or create a replacement task ID to evade reconciliation. This is a main-followed protocol,
not universal enforcement over callers that bypass it.

OCX owns request retries, cooldown and its existing global/per-model fallback.
CXC bounds its own native attempts to primary plus one fallback; OCX may rewrite
those model IDs downstream. Record `observedModel` only from runtime evidence,
never copy the requested candidate as proof. Structured OCX codes are preferred.
Native wait may return prose: only complete JSON error envelopes, exact code
strings and a small set of canonical quota-message prefixes are decoded. Unknown
prose requires investigation; never invent an error code to force a fallback.
