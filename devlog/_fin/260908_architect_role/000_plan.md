# Architect role

Status: DONE

Add a configurable design specialist using CXC's existing role store and spawn path. Main retains executable planning and final judgment; architect proposes a design and checks its reflection, while reviewer independently audits. The installed environment is outside this change.

- Loop: satisfy-spec HOTL, triggered by Jun's architect continuation and handoff.
- Goal: fourth role across settings and dispatch, with formal P guidance and truthful lifecycle evidence.
- Non-goals: new skills, philosophy amendment, provider defaults, global role registration, plugin installation, paid inference tests, push/PR/merge, unrelated refactors.
- Verifiers: isolated component tests via `node plugins/codexclaw/scripts/test.mjs`; build via `npm run build`; `npm run gate`; GUI build/typecheck and isolated browser settings roundtrip. Prose gets semantic independent review, not a claim of hook enforcement.
- Stop: all three cycles and criteria complete with source-bound receipts and local commits. Missing authority/capability is NEEDS_HUMAN/BLOCKED, never DONE; no user token/time bound is specified and none is invented. Tools use current authorized capabilities, fixture config/state only for verification, no paid provider tests.
- Memory: this unit and native-cwd goalplan for session 01a0829e-d196-7b31-bed9-9551e9ea3c18.
- Escalation: main resolves bounded implementation/review findings; reclaim a packet after two distinct agent failures. New delegated scope requires plan amendment. External publication and environment installation require Jun.

## Ordered cycles

1. `roadmap`: docs-only roadmap, independent audit, lock this map.
2. `roles`: [010_roles.md](010_roles.md), configuration -> dispatch -> settings, verified together.
3. `workflow`: [020_workflow.md](020_workflow.md), formal planning lifecycle over the verified role; final consistency and independent review.

## Work ownership

Source: /home/jun/code-worktrees/codexclaw/architect-role, branch codex/architect-role. Native FSM and goalplan remain /home/jun/code/codexclaw, officially source-bound. The pre-existing feat/architect-role branch stays untouched.

During roles B, delegate GUI API/pages/client fixtures to registered executor with explicit write scope; main implements store/spawn/contracts/role prompt and their tests. During roadmap main writes plans; independent reviewer audits. No new native architect is installed to bootstrap this change. Available host executor/reviewer roles are exposed; model overrides are omitted, so model-family independence is not claimed.

## Baseline and decision record

See [001_source_evidence.md](001_source_evidence.md). Extend existing owners; do-nothing/config-only cannot admit a fourth role because the enum rejects it. A new planner service or skill would duplicate existing ownership and is rejected. Dependencies remain GUI wire client -> settings API -> store, spawn -> store/prompt. New role is an additive public contract, treated with C4 verification care. Historical philosophy examples stay untouched; current operating docs explain the additive role without changing invariants.

## Continuity

P: source binding and clean starting source verified at 6e97e73. No implementation yet.

Roadmap D conclusion: design roadmap locked after independent review and two concrete amendments. No runtime feature has been implemented in this cycle. Next direction: execute 010_roles.md in the roles cycle, then 020_workflow.md. No design hypothesis was measured or rejected beyond the documented alternative of a new planner service. Reviewer 01a082ab re-audit: "Both blockers are closed. Blockers: none. VERDICT: PASS". Fresh-reader observation: missing Dashboard metadata and observer diagnostic interpretation were unclear; the map now names both explicitly.

Roles B: implemented store/dispatch/spawn and prompt source; executor 01a082b4 delivered GUI API/pages/client test diff, inspected and accepted. Main tightened routing header after independent collision analysis: first marker before TASK wins, explicit native role stays authoritative. Component suite 236/236 and GUI typecheck/client 4/4 passed before Check. Baseline full suite had four root-discovery failures caused by pre-existing /tmp/.git; isolated TMPDIR rerun of all eight root tests passed. Final full suite will use /var/tmp/cxc-architect-01a0829e. No operator config or installed payload changed.

Final D: roadmap, roles and workflow cycles closed with all registered criteria met. Final source contracts at c8d8a89: 28 pass; runtime full suite and isolated UI evidence are recorded in 030_verification.md. Implementation remains local, not installed/pushed. Archive this completed unit under devlog/_fin/260908_architect_role.
