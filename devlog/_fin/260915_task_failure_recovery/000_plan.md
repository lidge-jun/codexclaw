# Managed task failure recovery

PR #179 follow-up to [review](https://github.com/lidge-jun/codexclaw/pull/179#discussion_r4013017929).
The prior documentation cycle preserved managed recovery authority. A later review
showed that confirmed task failures have no executable recovery path through it.
This cycle changes that conclusion with direct runtime evidence, not another prose exception.

## Requirements and scope

- Represent confirmed stagnation and unusable final output separately from provider errors.
- Require a recorded child, confirmed termination, partial-work inspection and concrete
  task-failure evidence before handing off remaining work.
- Preserve provider decoding, cancellation/policy stops, identity, claim/spawn deduplication,
  the two-candidate bound and independent-review obligations.
- Retain old dispatch-state compatibility and consistent installed caller guidance.
- Finish with relevant runtime/CLI regression evidence, current CI and no medium-or-higher
  unresolved source or GitHub review findings.

One bounded PABCD cycle follows this specification. The affected report contract receives
C4 review and negative-case coverage. Main owns decisions, integration, records and PR;
the configured executor will own the audited implementation bundle. The configured
architect proposes the contract and reflects on the executable plan before independent audit.

Use the existing subagent-config module, tests, waiting/delegation owners and structure
index. No new dependency, retry framework, watchdog, provider call or installed configuration.
No merge, release or deployment. No user token, cost or wall-clock budget was specified;
the work remains bounded by this PR and its review findings. Preserve other checkouts.

## Reproduction and trust boundary

At `20e50485`, an isolated real `runDispatch` fixture creates and claims an executor,
records its child, then reports unusable final output with `executionState: stopped`,
the recorded identity and reconciliation evidence. First and repeated reports both
return `reconcile`, retain one attempt and request structured OCX evidence that does not
exist for this failure. Existing dispatch/CLI tests pass 23/23; they omit this recovery case.

The assets are exclusive work ownership and bounded model invocation. The boundary is
main-supplied CLI JSON into persisted dispatch state. Malformed or conflicting reports,
quoted child output and stale identities must not create recovery permission. Main can
misreport observations already; these are caller assertions, not authenticated native
receipts. Tests must prove validation and state transitions without claiming to observe
real child termination or judge model output automatically.

The executable file map, decision IDs, acceptance cases and consultation record belong
in `010_recovery.md`. Existing code-only checks and the normal build are available:
dispatch/CLI tests exit 0 (23 tests), `npm run build` exits 0 (181 files), and the gate
exits 0 on the baseline. Tests invoke the actual state machine and separate CLI processes;
the build compiles component source; the gate covers document hygiene only.
