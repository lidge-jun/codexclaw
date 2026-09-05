# Research wrap — agent-owned skills and scoped hooks

Disposition: user-directed wrap of collected data, 2026-09-05T14:40Z onward.
This is a research handoff, not a whole-program completion or release certificate.
The latest user request supersedes the earlier unlimited-research instruction.
No new model experiments, 050 delivery comparison, or 060 rollout are started.

## Decision supported by the evidence

Keep the implemented candidate for review. Prefer native execution capabilities
and live tool schemas over importing a second JS runtime or guessing hidden flags.
Make skill entrypoints routing instructions; keep detailed rules in their owning
references and load them before the governed action. Reduce instructional hook
pressure while retaining deterministic guards. This supports the user's direction:
modularity stays, references may grow, unnecessary unconditional reading shrinks.

Conceptual ownership after the change:

```text
User request and explicit scope
  -> short skill entrypoint
     -> task-relevant owner and references
        -> agent selects tools using the live schema
           -> native tool execution
              -> deterministic guards and fresh evidence remain
```

This is not a new automatic loader API. The agent still has to discover, fully read
and apply the required references. No V8/Node runtime fork or general-purpose
dispatcher was added. The upstream findings remain the dated source/PR snapshot in
001–005; they were not refreshed during this wrap.

## Implemented, not released

| Area | Candidate change | Boundary |
|---|---|---|
| Evidence | Isolated recorder, analyzer and shared-family evidence support | API/resume populations are not schema2-certified |
| Skills | Shorter dev/pabcd/loop entrypoints; conditional detailed references | Nine plan concepts and owner obligations retained |
| Instructional hooks | Explicit task scope wins; remove natural-language automatic phase entry | Identity, state, attest, receipt, trust and worktree guards remain |
| Phase footer | Latest verified phase replaces stale entry-phase instruction | Native old-footer-only toggle reproduces the old failure |
| Mind dispatch | Use exposed native fields and actual returned handles | No invented agent_type/task_name; no claim of native role enforcement from labels |

Product source: `29bdaea21bb4bdad56c0208fc78b61d98a5dda2d`.
Main documentation HEAD before wrap: `eb29ac70`; `git diff 29bdaea… HEAD -- plugins`
is empty. The branch remains `codex/agent-led-lazy-skills` in the original managed
worktree. No push, merge, release, or production rollout is included.

## Fresh remote verification

On macmini-cf, clean `wp3-candidate-mind-source` at the product SHA above, with an
isolated HOME/CODEX_HOME: build;20-file affected node:test selection; gate; inventory.
Result: **703 passed,0 failed,0 cancelled,0 skipped,0 todo**,32,708.742ms.
Build, gate and inventory also pass; post-check source remains clean.
Inventory:28 skills,23 registered hooks,8 components. Hook count did not decrease.
This is an affected regression selection, not the repository-wide suite or a
separate typecheck. No local tests, build or typecheck were run.

Remote evidence root R:
`/Users/junny/codexclaw-probes/01a0702d-c493-7510-801f-7d8772a2689c`.
Fresh logs: `R/wp3-wrap-{build,regression,gate,inventory}.log`.
Local retained copies: `.codexclaw/evidence/01a0702d-c493-7510-801f-7d8772a2689c/wrap/`.
SHA256 of regression log:
`e7155a2a98a5171284b45437e20a5cbb6d51caae5fb5c120fbc91c0d01151bf7`.
Historical694 at fb7 and290 at29 are separate selections, not984 current-head tests.

## Native findings: behavior and profile are different claims

Pauli reviewed scope, full-read and actual-action evidence; Bohr reviewed the
same-goal N12 resume. Lagrange independently audited the following complete owned
session families using read-only artifacts and identity-based usage joins.

| Population | Requests / attempts | Supported finding | Retained limit |
|---|---:|---|---|
| N20-answer-005 |19/19, all200 | Two authorized Astra/high Minds, returned handles, results and scan; behavior reviewed GREEN | Wrapper deadline; not clean lifecycle |
| N4-state-003 |17/17, all200 | Five turns including actual P/B controls; scoped review and operator-term | Human B flag is not an independent audit certificate |
| N12-controlled-001 + resume002 |57/57;56×200,1×499 | Same-goal resumed functional completion and clean resumed teardown | Original600s timeout and failed request remain |

All93 rows record requested Astra/high and requested/adapter-observed priority.
No effectiveEffort/reasoningWire fields exist in these rows: exact outbound effort
is UNKNOWN, despite source-supported passthrough. Actual scheduler priority is
UNKNOWN. The known default/auto response-echo issue is retained as an annotation,
not pursued as an OCX bug or used as a failure verdict. No per-child cost allocation,
token/time-tuple matching, native-binary attestation or latency win is claimed.

Evidence join: seven owned sessions agree between recursive rollouts and native
thread databases; root identity maps through `sha256(trim(id))[:32]`. No additional
descendants or duplicate request IDs were found. OCX usage row ranges: N20
22227–22251; N4 22359–22375; N12 22252–22358 and22376–22380, filtered by identity.
The499 at22358 is client_closed_request. Serving OCX was verified at clean
`a687eb7`, version2.43.0, PID38505, port10100. No credentials are copied here.

Other useful bounded observations remain in048: explicit read-only, explanation,
plan-only and interview constraints; actual build-only execution; blocked/paused
goal handling; full-read recovery; stale-footer repair. N14-scoped001 truthfully
reports NOT RUN when the authorized runner is absent, with no local fallback.
It is not proof of successful remote testing.

## Active probe stopped, not promoted to a pass

N13a-002 had reached a native requestUserInput callback about validation ownership
and was waiting for an answer. On the user's wrap request the operator did not
fabricate an answer or continue the experiment. After verifying the exact owned
wrapper/root and parent-child relationship, wrapper89030 received TERM.
Server89534 exited; ended.json records operator-term/code0/doctorError:null and
unchanged config/payload/launcher digests. Both PIDs were absent on readback.
The H0 semantic experiment remains partial, not an accepted completed result.
Artifacts: `R/runs/wp3-candidate-n13a-002/native-stdio-preflight-001/`.

## Remaining uncertainty and handoff

Gauss's independent coverage review does not approve whole-WP3 completion.
Outstanding original obligations include H0/N13a+b completion, promised R6/R7 and
old-shape native causal checks, remaining general native coverage mappings,
matched context/cost synthesis, and a source-bound full-WP3 acceptance receipt.
The deterministic regression above closes the current-product check gap only.
050's delivery-method comparisons and060's final installed handoff were not run.

No speed/cost percentage, fewer hook processes, supported-V2 certification or
production-readiness claim follows from this research. The practical outcome is
a tested candidate plus specific behavioral evidence, failures and unknowns.
The original goalplan/FSM remain WP3/C with unmet criteria preserved; they are not
rewritten to manufacture success. Further research requires a new user direction.

The official `cxc loop steer` annotate operation recorded this user direction with
idempotency key `user-wrap-collected-data-20260905`; no criterion was removed.
Fresh `cxc loop validate` exits1, explicitly reporting unfinished wp3,
wp3-delivery and wp4 plus unmet hooks/safety/final/delivery criteria. This is the
expected honest original-program status, separate from the passing code checks.

Final independent review: Gauss reviewed the four-file wrap diff and returned
PASS for the bounded research handoff, with no material corrections. This verdict
does not approve whole-WP3 completion or relax any retained acceptance criterion.
