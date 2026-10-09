## 0. Scope split (single ownership)

- `cxc-dev-testing` owns AUTOMATED verification: unit, contract, E2E,
  Playwright suites and CI gates. Browser selection lives in the shared dev policy;
  `dev-testing` §4.7 connects that policy to exploratory tests.
- `cxc-qa` (this skill) owns the manual QA PROCEDURE: scenario matrix,
  faithful channels, evidence contract, adversarial classes, oracle passes,
  teardown receipts.
- Both feed PABCD C. Neither replaces the other: a green suite without a
  driven surface can still ship a broken border or a dead route; a driven
  surface without a suite has no regression guard. Promote a QA flow to a
  deterministic test (dev-testing §4.1) when it must stay guarded.

## 7. Binding to PABCD C

A user-facing surface change closes C with BOTH: the automated gate
(dev-testing) AND this skill's QA matrix — any FAIL verdict blocks the C>D
claim until repaired (LOOP-REPAIR-01 counts apply) or the criterion is
re-scoped through a P-phase amendment, never silently. This is E7 discipline:
no hook reads verdict.json. The E2 touchpoint: QA delegated to a registered `executor`
subagent rides the existing SubagentStop receipt gate (legacy `worker` also supported) — the executor cannot
finish without a non-empty receipt under `.codexclaw/evidence/`.
