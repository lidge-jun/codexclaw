# Require evidence before retiring a subagent

An executor can still be investigating while its working tree is clean. Issue
[#178](https://github.com/lidge-jun/codexclaw/issues/178) records a worker stopped
seconds after a successful read. This unit replaces the wait-count heuristic with
an activity-based decision procedure in the existing waiting reference. It also
keeps repeated busywork, explicit limits and safe handoff in view.

## Scope and completion

- Class C2; one satisfy-spec PABCD work-phase, `wp1`.
- Trigger: implement #178 and open a linked pull request.
- Goal: a coordinator can distinguish slow progress, suspected stagnation,
  confirmed failure and unavailable observations before deciding to retire.
- Out: runtime watchdogs, provider retries, new configuration/schema fields,
  installed-payload changes, merge, release and deployment.
- Tools: local Git/source reads, native V1 subagents, existing checks and GitHub
  branch/PR publication. Writes stay in this task's linked worktree and native
  session evidence. No user token/cost/wall-clock budget was specified; preserve
  explicit limits when present and do not invent a universal timeout.
- Verifier: the baseline commands below plus independent semantic review of
  [the scenario matrix](010_policy.md#acceptance-scenarios).
- Stop: close the cycle with verified text and publish an ordinary PR to `dev`.
  DONE requires a linked PR and accurate check results; unmet evidence stays
  incomplete. Host limits or cancellation are reported as such, never success.
- Memory artifact: this unit, then its `_fin/` archive; raw consultation/dispatch
  handles and receipts remain in untracked native session evidence.
- Escalation: main resolves scope/judgment gaps. A new worker handoff requires a
  plan amendment. Retirement and replacement follow managed dispatch results;
  `reconcile`/`stop` never authorize direct work or another spawn.

## Existing owners and baseline

`plugins/codexclaw/skills/loop/references/waiting.md:31-35` retires after about
three waits. `structure/20_pabcd_dispatch_doctrine.md:181-195` includes bare
timeout among failure reasons. The V1 table in
`plugins/codexclaw/skills/pabcd/references/delegation.md:133` calls a wait timeout
a normal outcome. The waiting reference already owns the shared decision rule;
the other files should point to it rather than copy a second classifier.

Verified on upstream `dev` at `03541398` before edits:

| Command | Result | What it observes |
| --- | --- | --- |
| `npm run gate` | exit 0 | `gate.mjs` scans skill references and `structure/*.md` for claim hygiene and checks inventory; not retirement semantics |
| `node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/test/manifest-policy.test.mjs` | 7 pass, 0 fail | existing owner-route resolution includes `waiting.md`; not model behavior |

No phrase-presence test or unused decision helper will be added. They would test
the wording or a second implementation that the coordinator never executes
(`dev-testing` TEST-PROMPT-SEAM-01). The source is agent-followed E7 guidance;
execution surface: main's judgment; bypass: ignore/misread it; residual: model
variance and missing observations; final enforcement layer: none.

## Architect consultation and main decisions

The native V1 architect proposed D1-D5 from the owner files. Its initial proposal
included phrase tests; its revised proposal withdrew them after the existing
testing rule was supplied. Actual handle, proposal and reflection are retained
with this session's dispatch evidence, outside published project documents.

| Decision | Main disposition |
| --- | --- |
| D1 trigger taxonomy | Accept with amendment: a confirmed stop/cancel is not automatically a provider failure. Separate wait timeout, terminal error and evidenced stagnation. |
| D2 activity evidence | Accept with amendment: new reads or command events are candidate evidence only when they advance the packet. Repeated reads/messages prompt investigation, not an automatic new count threshold. |
| D3 checkpoint | Accept: use supported non-interrupting delivery, explain queued-input limits, request findings/remaining work/next artifact. Reviewers report next review result, not a forced first edit. |
| D4 retirement evidence | Amend: record decision before stop; verify terminal state and owned processes after stop. A returned *previous* `running` status does not prove termination. Preserve managed fallback gates. |
| D5 observation and proof | Accept revised semantic review. No assumed access to child rollouts. Do not link installed skills to repository-only devlogs. |

No-code alternatives: doing nothing retains the contradiction; merely lengthening
three waits still mistakes elapsed observations for failure; a runtime helper has
no existing consumer and expands this change. Reuse the current protocol owners.

Reflection of this concrete plan: ALIGNED on D1-D5, with the named main
amendments accepted. Independent A audit: PASS, no blockers. S3 now explicitly
permits retirement only after stagnation is evidenced; the canonical recovery
rule must also govern shorthand references such as `plan-output.md:18`.

## Change ownership

The executor owns the four bounded source-document edits listed in
[010_policy.md](010_policy.md). Main owns this plan, semantic acceptance decisions,
consultation records, final review/integration, checks and publication. One commit
may carry the coherent document fix; follow repository `[agent] fix(...)` style.
No branch stacking is needed. Preserve unrelated local integration work.
