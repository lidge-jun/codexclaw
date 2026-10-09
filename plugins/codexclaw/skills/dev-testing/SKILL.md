---
name: cxc-dev-testing
description: "Use for tests and release verification. Triggers: regression test, Playwright, E2E, contract test, coverage, CI flake, TDD, 테스트, 회귀 테스트, 품질 게이트."
metadata:
  last-verified: "2026-07-02"
  short-description: "Testing and QA router: strategy, harness choice, CI gates, TDD, and coverage."
  keywords: [test, testing, TDD, coverage, regression, e2e, playwright, contract test, CI]
---
# Testing & QA

Balance: ~40% Backend/API, ~40% Frontend/E2E (Playwright), ~20% Cross-cutting (CI, Security, TDD, Coverage) -- directional guidance, not a hard ratio.
**Scope**: test harnesses, fixtures, mock policy, runners, Playwright, CI gates, coverage. Root-cause analysis and debugging playbooks → `dev-debugging`.
- This skill owns test adequacy; `dev-code-reviewer` owns finding severity and review process.
- CI pipeline ownership and deployment verification: see `dev-devops`.
- Data pipeline testing and ETL validation: see `dev-data`.
- Design direction context for rendered verification: see `dev-uiux-design`.
This skill activates by change-surface when work needs verification depth, regression coverage, or a reproducible test harness.

Class, fast path, rule authority, proof, and safety: [dev](../dev/SKILL.md). Current/public evidence: [dev routing](../dev/SKILL.md#conditional-routes).

### 1.3 Risk-First Priorities
1. auth / session / permission boundaries
2. money movement, quota, credits
3. data mutation and irreversible actions
4. file upload / parsing / external webhooks
5. shared API contracts used by frontend clients
6. error paths, retries, rollback behavior
### 1.4 Harness Selector
| Problem | Primary Harness | Avoid |
|---------|-----------------|-------|
| pure business rule | unit / service test | browser test |
| route + middleware + serialization | API integration test | mocking the route itself |
| DB query / migration / transaction | real DB integration test | fake repository for SQL correctness |
| frontend consuming backend JSON | contract test | manual-only verification |
| rendered critical flow | Playwright smoke | asserting internal React state |

Test-oracle rules apply before accepting green: [oracle integrity](references/test-oracle-integrity.md).

## Modular References

| Condition | Reference |
|---|---|
| Choose verification depth or test a CRUD slice | [core/crud-test-matrix.md](references/core/crud-test-matrix.md) |
| Choose model, distribution, fixture policy, or general test rules | [test-strategy.md](references/test-strategy.md) |
| New feature unit/service/integration tests (not regression/contract) | [edge-first-testing.md](references/edge-first-testing.md) |
| Property/invariant-heavy or mutation testing | [property-and-mutation-testing.md](references/property-and-mutation-testing.md) |
| Backend/API, database, or contract verification | [api-test-patterns.md](references/api-test-patterns.md); [backend-testing.md](references/backend-testing.md) |
| Rendered browser tests or exploratory browser QA | [browser-testing.md](references/browser-testing.md) |
| CI test stages, failures, or flakes | [ci-integration.md](references/ci-integration.md); [ci-pipeline.md](references/ci-pipeline.md) |
| ENFORCE_TDD, AI regressions, or test-induced production guards | [tdd-and-regressions.md](references/tdd-and-regressions.md) |
| Accessibility, trace/log verification, security, coverage, or pre-flight | [acceptance-gates.md](references/acceptance-gates.md) |
| Write acceptance criteria | [acceptance-row-reachability.md](references/acceptance-row-reachability.md) |
| Test expectations, prose seams, override/default/fallback fixtures | [test-oracle-integrity.md](references/test-oracle-integrity.md) |
| Implementation completion with test/config changes | [patch-integrity.md](references/patch-integrity.md) |
| Scarce, paid, rate-limited, or opaque evaluators | [limited-oracle-evaluation.md](references/limited-oracle-evaluation.md) |
| Performance/load or C3+ production readiness | [load-testing.md](references/load-testing.md) |
| ML/LLM evaluation or quality gates | [ml-evaluation.md](references/ml-evaluation.md) |
| Desktop suites and CI matrix | [Native desktop acceptance](../dev-devops/references/native-desktop-acceptance.md) |
