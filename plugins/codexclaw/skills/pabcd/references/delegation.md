## Delegation Model (subagents)

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
Repository-only provenance for lifecycle, economy, isolation, skill transport and
topology: `structure/20_pabcd_dispatch_doctrine.md` §3. This is not an installed
prerequisite; do not assume the path exists inside the plugin payload. An explicitly
required task source still must be loaded or reported missing before its governed action.

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

- **V1:** `wait_agent` returns final status plus content; `send_input` reuses an agent;
  `close_agent` retires it and `resume_agent` restores it.
- **V2:** `wait_agent` is a no-content mailbox; `followup_task` triggers more work;
  `send_message` is context-only, and `interrupt_agent` stops a runaway turn.

**Delegation safeguards:**

- **DISPATCH-ISOLATION-01:** every lane gets explicit read and write access lists;
  never share in-progress output across lanes.
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

Architect dispatch requires `agent_type: "architect"` in the live schema. If it is
missing, report the unmet setup requirement: explicitly register with
`cxc subagents register architect`, start a fresh session, and verify the exposed
role. Registration is a separate authorized installation action; never perform it
as a hidden dispatch side effect or substitute explorer/reviewer. A schema without
an architect role cannot satisfy this dispatch contract. Include the structured
packet and existing skill attachments; the message may retain `CXC-ROLE: architect`
for provenance, but native type owns architect routing even without that marker.
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

On an actual failed call, preserve the failure evidence and apply the existing
retirement rule: at most one retry on the same handle, then a fresh context carrying
the failure and plan. If a second distinct context also fails, main reclaims the
planning work under the existing lifecycle rule, but the missing architect consultation
remains unmet. Report the gap and stop dependent completion; main self-check does not
replace it. Do not silently switch models, register roles, or bypass host restrictions.
Explicit user limits still govern dispatch and completion scope.

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
   `outcome:complete` with that ID on successful completion. Do not confuse a
   successful spawn with successful work.
4. On failure report `outcome:failed`, the original `error`, and `executionState`:
   `not_created`, `stopped`, `unknown`, or `running`. Known no-child failures need
   concrete `reconciliation` evidence. A stopped child requires its recorded
   `agentId` and evidence that work/processes stopped and changes were inspected;
   pass only remaining work to the replacement. Unknown outcomes never authorize
   another child. If native spawn is absent, report `outcome:unavailable` with
   confirmed `not_created` and capability evidence, never a policy denial.
5. `ready` means claim the next attempt. `main-direct` means main reclaims the
   remaining work; `independentReviewRequired` stays true for reviewer tasks.
   Main implementation is never independent review. `stop` or `reconcile` means
   no model switch or direct-execution permission. Inspect the reason and state.

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
