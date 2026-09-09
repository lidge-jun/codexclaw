## Delegation Model (subagents)

The main session owns the plan, host goal, and every PABCD transition.
At P, consult a read-only architect; at A, dispatch an independent reviewer.
Use a supported read-only transport for both and a supported write role for bounded
implementation (DISPATCH-AGENT-TYPE-01 and the live schema below).
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

Use the loaded native tool schema, not a version label, to choose arguments.
`explorer`/`worker` express the intended role; `agent_type` and `task_name` are
not universal fields. Use them only when exposed. Otherwise put the logical
role, task/lens name and exact read/write scope in the task message, without
inventing arguments or claiming a native permission profile was selected.
Prompt labels are not enforcement and cannot bypass an actual worker receipt
requirement or other runtime guard. If the requested protection cannot be
represented, report that gap rather than silently weakening it.

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
use readable message transport: items-only manual payloads and ciphertext do not prove
configured-model injection. Without readable role metadata, keyword/default inference
can select another logical role, including explorer on legacy transports. An explicit native architect type retains
architect routing; items-only/no-message hook paths still do not prove settings
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
