## Delegation Model (subagents)

This file assumes the surface is already chosen and describes the **subagent**
packet. [Dispatch surfaces](dispatch-surfaces.md) owns the choice between a
subagent and a separate Codex task, and the fact that a subagent runs in this
session's own working directory rather than a copy of it.

The main session owns the plan, host goal, and every PABCD transition.
At P, consult a read-only architect; at A, dispatch an independent reviewer.
Use a supported read-only transport for both and a supported write role for bounded
implementation (DISPATCH-AGENT-TYPE-01 and the live schema below).
The executor role resolves to its registered native `executor` type once `cxc subagents register executor` has run; unregistered installs keep the built-in `worker`.
Subagents are leaves (LEAF-TOPOLOGY-01) unless recursion is explicitly granted.
Every dispatch carries a structured TASK packet (DISPATCH-TASK-01):
`TASK`, `SCOPE`, `MUST DO`, `MUST NOT`, `PROOF`, `RETURN FORMAT`, and decision boundary.
Write scopes must be disjoint, with explicit read bounds and peer-edit protections.
Pass the concrete plan and scope; never let a subagent reconstruct the plan.
Subagents return evidence and unresolved judgments; the main session decides and
integrates. Dispatch only specifiable work whose coordination cost is justified
(DISPATCH-ECONOMY-01).

**DISPATCH-PROMOTE-01 (DEFAULT).** After checking a child's evidence, main records a
short synthesis of what it accepted: the reusable result, the failure cause or
procedure worth keeping, its provenance, and any claim still unresolved. This is not
ceremony. A child session is excluded from the host's memory extraction candidates, so
anything learned only inside a lane is learned only once — but main's own assistant
messages and inter-agent communication are retained, which makes main's synthesis the
available promotion route. Child completion is not verification; write what you
verified, not what the child claimed. Durable memory writes keep using the existing
explicit-request gate; do not add an automatic writer.
Repository-only provenance for lifecycle, economy, isolation, skill transport and
topology: `structure/20_pabcd_dispatch_doctrine.md` §3. This is not an installed
prerequisite; do not assume the path exists inside the plugin payload. An explicitly
required task source still must be loaded or reported missing before its governed action.

### Discovery packet

Whether to dispatch stays with `dev`'s Discovery delegation. Once dispatched, the
child packet still includes every DISPATCH-TASK-01 field:

- **TASK:** one independently answerable question.
- **SCOPE:** the child's bounded read area, plus main's separate work.
- **MUST DO:** find or trace the answer; stop when it is answered.
- **MUST NOT:** writes, or work that overlaps main.
- **PROOF:** source anchors (`path:line` quotations, figures, URLs).
- **RETURN FORMAT:** direct answer, key source anchors and unresolved points; omit
  extra candidate lists, exploration narrative and full file dumps.
- **DECISION BOUNDARY / STOP:** return unresolved judgments and any scope growth to main.

Managed routing, isolation, lifecycle, and fallback in this file are unchanged.
For a configured fallback, report creation and completion with the wire fields
below (substitute the actual native IDs). `created` is an outcome, not an action;
creation is not completion. Omit `observedModel` unless runtime evidence proves it.

```json
{"action":"report","outcome":"created","sessionId":"<main-id>","dispatchId":"<task-id>","attemptId":"<attempt-id>","agentId":"<child-id>"}
```

After native completion, use a separate invocation:

```json
{"action":"report","outcome":"complete","sessionId":"<main-id>","dispatchId":"<task-id>","attemptId":"<attempt-id>","agentId":"<child-id>"}
```

### Live tool schema and role transport

Apply `dev`'s Discovery delegation guidance before broad source/log reads.
Explicit native explorer tasks retain explorer despite review-related words in
the task. Legacy hosts that transport reviewers as explorer must use a deliberate
`CXC-ROLE: reviewer` header; keyword inference remains for unspecified roles.
V1 callers may use `message` or `items`, following the live schema. Preserve item
attachments and do not supply both fields to work around model routing.

Use the loaded native tool schema, not a version label, to choose arguments.
`explorer`/`executor` express the intended role; `agent_type` and `task_name` are
not universal fields. Use them only when exposed. Otherwise put the logical
role, task/lens name and exact read/write scope in the task message, without
inventing arguments or claiming a native permission profile was selected.
Prompt labels are not enforcement and cannot bypass an actual worker receipt
requirement or other runtime guard. If the requested protection cannot be
represented, report that gap rather than silently weakening it.

For implementation dispatch, prefer `executor` when exposed by the live schema.
Existing installations without it may use built-in `worker`; both names route to
logical executor settings and the same receipt gate. The payload resolver selects
worker when `$CODEX_HOME/agents/executor.toml` is missing. If registration exists
but the current session has not loaded it, use the live schema rather than assuming
that disk presence proves availability. Registering `executor` is optional: run
`cxc subagents register executor`, then restart Codex before selecting that native
role. The command updates unchanged managed prompts and preserves user edits,
model choices and permissions. Never substitute a role explicitly forbidden by
the user or host.

Map each logical task to the handle actually returned by the tool: for example,
a V1 agent_id or a V2 canonical task_name. Use the actual handle and supported
follow-up/wait/retirement schema, never a display label or guessed ID. Apply only
supported fork/model/effort/tier fields and honor explicit user constraints;
documented inheritance still needs observed settings when exact identity matters.
Do not mutate shared or persistent role configuration without authorization.
Reading this transport owner does not turn a non-audit task into a PABCD A gate.

**Lifecycle contract.** Discover the actual spawn capability through the host's
catalog/search when available, then use its live schema as described above.
If no discovery/spawn capability exists, report the gap. Fan out independent lanes before waiting, and
reuse the same reviewer throughout the A loop.

Before waiting on dispatched work, read the mode-neutral
[Waiting on work](../../loop/references/waiting.md) rules in either HITL or HOTL.
This route does not authorize an otherwise forbidden dispatch, wait, or mode transition.
A wait timeout is an observation outcome, not a verdict: classify progress,
suspected stagnation, confirmed failure and unavailable observation per that
reference before any retirement. A suspected-stall checkpoint uses
non-interrupting delivery where the family supports it — V1 `send_input`
without `interrupt`, V2 `send_message` — and a queued message is context the
child may not have read yet, never proof of a stall.

### Detect the family first (DISPATCH-SCHEMA-DETECT-01, STRICT)

Two collab families exist and their follow-up and wait contracts differ. Name the
exposed one from the live tool catalog before the first dispatch, and record which
you found — a later reader cannot re-derive it.

`spawn_agent` is registered by **both** families and discriminates nothing. Use
the tools that exist in only one:

| Signal | Family |
|---|---|
| `send_input`, `close_agent`, `resume_agent` | V1 |
| `followup_task`, `send_message`, `interrupt_agent`, `list_agents` | V2 |
| `wait_agent` | neither — V1 always has it, V2 optionally |

V1's namespace is `multi_agent_v1`. V2's is configurable and defaults to
`collaboration`; `multi_agent_v2` is a feature-flag name and never appears as a
namespace. Names reach you either flat (`followup_task`) or with the namespace
concatenated, usually without punctuation (`collaborationfollowup_task`), so
match the bare name and the `collaboration` prefix with an empty, `.` or `_`
separator.

If neither family is exposed, report the capability gap. Do not substitute the
thread surface: a separate Codex task is not a bigger subagent. See
[Dispatch surfaces](dispatch-surfaces.md).

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

In native Code Mode on a V1 host (observed in this host's catalog), the spawn callable is `tools.multi_agent_v1__spawn_agent`; `wait_agent`, `close_agent`, `send_input`, and `resume_agent` use the same `multi_agent_v1__` prefix. The SessionStart dispatch card prints that exact call only under the `CODEXCLAW_SPAWN_V1=1` override, and always lists dated model aliases. Its resolver identifies the family from companion tools (`send_input`/`close_agent` for V1, `followup_task`/`interrupt_agent` for V2) and spawns V2 with `fork_turns: "none"` so model overrides are accepted. If the card says family unresolved, run its one-cell helper resolver and spawn in that same cell; do not treat the generic V2 default as detection. Follow the managed fallback protocol before native spawn when a role has a first fallback.

The schema marks no argument required, but the runtime still rejects a spawn
carrying neither `message` nor `items`. `nickname` is a display label: never
address an agent by it. A completed agent holds a concurrency slot until closed.

**DELEGATE-MODEL-LIST-01 (STRICT).** The model-override list in the host tool
description is a hint, not an allowlist, and is known to be incomplete. When the
user names a worker model, pass it through as given. Only a real spawn rejection
is evidence of unavailability; absence from the description is not. If a
requested model genuinely fails to spawn, say so to the user — do not substitute
a different model and silently re-plan the ratio. Measured on 2026-09-14:
`spawn_agent({ model: "devin/swe-2" })` returned `{ agent_id, nickname }` and
the child ran to a final message on the parent's branch, while the advertised
list still omitted it; re-confirmed the same day in a second session.

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

The wait difference is the one that bites, in two ways. On V1 the first complete report
may arrive through the host notification OR through `wait_agent`; the same code on V2
returns a status summary and no text, which looks like a silent failure rather than a
schema mismatch — on V2 the final answer arrives as a separate message. And V1's
`wait_agent` waits on named `targets` while V2's waits on the whole mailbox, so a
V1-shaped call carrying `targets` is not a valid V2 call at all.

**DISPATCH-CONSUME-ONCE-01 (DEFAULT).** On V1, consume a child's report once per child
task per turn, from whichever surface delivered it first. Three surfaces can carry the
same completed text and none of them can be told to stay quiet: the spawn-time watcher
injects the completed status independently, `wait_agent` returns terminal statuses that
may include the final message, and `close_agent` returns the status it captured before
closing. There is no content-suppression argument on the wait.

So: a wait already in flight can still hand you a duplicate of something you have
already read — do not issue an extra wait solely to fetch a report you have. Do not skip
`close_agent` to avoid the third copy either; a completed child holds a concurrency slot
until closed, and running out of slots costs more than a repeated paragraph. Where the
execution surface lets you project a result, emit only the status and error metadata for
something already consumed. Deduplicating by agent id alone is wrong when an agent is
reused for a second task, and the last copy you see may be the only one carrying an
error, so never discard unread content.

### The thread surface is a different schema

When the work is thread work (see [Dispatch surfaces](dispatch-surfaces.md)),
none of the above applies. Observed live in Codex Desktop, so confirm the callable
names in your own session:

| Purpose | Tool |
|---|---|
| create | `create_thread({ prompt, target, model?, thinking? })`, where `target.environment` is `local` or `worktree`, and a worktree takes `startingState` of `working-tree` or `branch{branchName, onMissing}` |
| wait | `wait_threads({ targets: [{ threadId, hostId?, afterCursor? }], timeoutMs? })` — 1-8 targets, `timeoutMs` 0-120000 (default 120000) |
| read | `read_thread({ threadId, hostId?, cursor?, turnLimit?, includeOutputs?, maxOutputCharsPerItem? })` — `turnLimit` 1-10, `maxOutputCharsPerItem` 0-20000 |
| list | `list_threads({ limit? })` — `limit` 1-50, applied to non-pinned results only |
| handoff status | `get_handoff_status({ operationId, afterRevision?, waitMs? })` — `waitMs` 0-60000 |
| follow up | `send_message_to_thread({ threadId, prompt, ... })` |
| fork | `fork_thread({ threadId?, environment? })` |
| move | `handoff_thread({ threadId, destinationHostId?, followUpPrompt? })` |

`worktree` is what gives a lane its own checkout. Creating a thread is
user-visible; messaging one is not commanding it.

**Delegation safeguards:**

- **DISPATCH-ISOLATION-01:** subagent lanes are not isolated environments — they
  all run in this session's working directory, so "isolation" here means scope
  discipline, not separation. Give every lane explicit read and write access lists
  with no overlap, and never share in-progress output across lanes. Concurrent
  lanes must never run branch-level git operations (`checkout`, `switch`,
  `branch`, `stash`, `reset`, `rebase`, `merge`, `pull`): those act on one shared
  HEAD and a per-file write scope does not make them safe. Work that genuinely
  needs its own branch or checkout is thread work, not a subagent lane.
- **REVIEW-DECORRELATE-01:** prefer an independent context; use a different model family
  only when host policy and user authorization permit the override. Otherwise inherit
  and record that family-level independence was not established.
- **SPECIALIST-CRUX-01:** when a narrow crux lies outside the builder's domain,
  dispatch a specialist to re-derive it from first principles.
- Returns preserve VERBATIM ANCHORS: exact `path:line` quotations, exact figures,
  and source URLs, so the main session can spot-check the evidence.

### Architect context and routing

Architect is a configurable logical role, with `dev` and `dev-architecture` as its
base skills. It proposes design and checks reflection; it cannot write, own the goal
or FSM, spawn children, or replace the main's judgment or independent reviewer.

Select architect transport from the live spawn schema:

- If `agent_type: "architect"` is exposed, use it. Native type owns architect
  routing even without a message marker.
- If the schema has no `agent_type` field, as on V1, use the supported `message`
  or text-`items` channel with a leading `CXC-ROLE: architect` before `TASK:`.
  Attach `dev` and `dev-architecture` and include the read-only, no-child and
  no-goal/FSM constraints in the task packet. This is supported logical architect
  dispatch, not an exception requiring user approval, registration or restart.
- If the schema supports `agent_type` but does not expose architect, report the
  unmet native setup requirement. With installation authorization, run
  `cxc subagents register architect`, start a fresh session and verify the role.
  Never register as a hidden dispatch side effect or substitute explorer/reviewer.

Logical read-only scope is an instruction, not a native sandbox permission profile.
If the user or host requires native isolation that this transport cannot provide,
report that concrete gap; do not claim equivalent protection. Include the structured
packet and existing skill attachments on either supported route. Real consultation,
same-architect reflection and independent audit remain required; a prompt label
alone does not complete them.

Before reporting a blocker, distinguish missing transport fields from missing work
or protection. A supported no-`agent_type` dispatch with the actual proposal,
same-agent reflection and independent review satisfies those consultation steps.
Do not discard that evidence, ask for a native-role exception, or mark a loop
blocked solely because the tool has no role field. Transport adaptation within
the already authorized task is not a new permission request; preserve applicable
user approvals across continuations. Missing consultation output, failed calls,
or an explicitly required protection that cannot be provided remain real gaps.

The same header supports read-only `reviewer` and `explorer` routing. Explicit native
write/reviewer roles take precedence; a message marker cannot select a write role.
Keep `CXC-ROLE:` lines out of role prompt overrides: injected override text can shift
logical role on a repeated raw hook pass. This is routing hygiene, not a permission
boundary. Pass the role instructions and skill attachments in the supported payload.

Use the configured architect model/effort, retaining default inheritance and explicit
caller overrides; no provider is a universal architect default. For hook-based routing,
use readable message or text-item transport. Ciphertext does not prove
configured-model injection. Without readable role metadata, keyword/default inference
can select another logical role, including explorer on legacy transports. An explicit native architect type retains
architect routing. Payload adaptation alone does not prove runtime settings
injection. Honor full-history fork restrictions. If exact routing
cannot be observed, report it as unverified; do not infer it from the prompt label.

Map this plan to the actual returned handle. Reuse it for proposal, reflection and
named decision revisions within ONE plan; a separate new plan starts a fresh context.
Do not promise cost savings from reuse. Use the host's supported follow-up and wait
operations; an empty timed wait alone is not evidence of a failed call.

On an actual failed call, preserve the failure evidence. With
[configured first fallback](#configured-first-fallback), the returned action governs
recovery: `ready` requires a new claim, only `main-direct` permits reclaim, and
`reconcile`/`stop` permit neither reclaim nor replacement. The unmanaged retry rule
below does not authorize extra calls on this path.

Without managed dispatch, apply the existing retirement rule: at most one retry
on the same handle, then a fresh context carrying the failure and plan. If a second
distinct context also fails, main reclaims the planning work. Confirm prior work
has stopped and inspect partial results before retry, replacement or reclaim.

In either path, a missing architect consultation remains unmet. Report the gap
and stop dependent completion; main self-check does not replace it. Do not silently
switch models, register roles, or bypass host restrictions. Explicit user limits
still govern dispatch and completion scope.

## Speculative dispatch (DISPATCH-SPECULATE-01, HEURISTIC)

Dispatching phase-N+1 work while phase N is building is default-OFF. Only
phase-invariant external research that reads no repository state may overlap phases.
Mark its results `candidate — unverified`, then revalidate them against the landed tree
at the next P; discard them when the phase map changes. See DISPATCH-ECONOMY-01 in
`structure/20_pabcd_dispatch_doctrine.md` §3 (repository-only provenance, not an installed prerequisite).

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
