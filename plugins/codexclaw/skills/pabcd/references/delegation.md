## Delegation Model (subagents)

The main session owns the plan, host goal, and every PABCD transition.
At A, dispatch an independent `explorer`; use a `worker` for bounded writes
(DISPATCH-AGENT-TYPE-01).
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

## Speculative dispatch (DISPATCH-SPECULATE-01, HEURISTIC)

Dispatching phase-N+1 work while phase N is building is default-OFF. Only
phase-invariant external research that reads no repository state may overlap phases.
Mark its results `candidate — unverified`, then revalidate them against the landed tree
at the next P; discard them when the phase map changes. See DISPATCH-ECONOMY-01 in
`structure/20_pabcd_dispatch_doctrine.md` §3 (repository-only provenance, not an installed prerequisite).
