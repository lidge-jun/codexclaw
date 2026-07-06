---
name: cxc-dev-testing
description: "MUST USE for testing, QA, regression protection, and release verification — unit, integration, API, contract, Playwright E2E, CI, security-scan, coverage, and TDD strategy. Activates by change-surface when work adds features, fixes bugs, changes APIs, refactors behavior, or prepares a release. Triggers: 'write tests', 'regression test', 'Playwright', 'E2E', 'contract test', 'coverage', 'CI flake', 'TDD', '테스트', '회귀 테스트', '품질 게이트'."
metadata:
  last-verified: "2026-07-02"
  short-description: "Testing and QA router: strategy, harness choice, CI gates, TDD, and coverage."
  keywords: [test, testing, TDD, coverage, regression, e2e, playwright, contract test, CI]
---
# Testing & QA
Balance: ~40% Backend/API, ~40% Frontend/E2E (Playwright), ~20% Cross-cutting (CI, Security, TDD, Coverage) -- directional guidance, not a hard ratio.
**Scope**: test harnesses, fixtures, mock policy, runners, Playwright, CI gates, coverage. Root-cause analysis and debugging playbooks → `dev-debugging`.
This skill activates by change-surface when work needs verification depth, regression coverage, or a reproducible test harness.

> **C0/C1 work (small local patches):** See `dev` §0.0 Work Classifier + §0.1 Patch Fast-Path before reading references.

## Modular References

| File | When to Read | What It Covers |
|------|-------------|----------------|
| `references/core/crud-test-matrix.md` | When choosing verification depth for a classified task, or testing a CRUD slice | Risk-tier minimums, per-operation negatives, UI smoke rule |
| `references/edge-first-testing.md` | New unit/service/integration tests for features (skip for regression/contract tests) | Edge-first principle, test order by change type, 11-class edge matrix |
| `references/backend-testing.md` | Backend/API testing | Supertest patterns, DB fixtures, auth mocking |
| `references/ci-pipeline.md` | CI configuration | GitHub Actions, gates, caching, parallelism |
| `references/load-testing.md` | Performance/load testing, C3+ production readiness | k6/Locust, test types, measure→profile→verify, CI gates |
| `references/ml-evaluation.md` | ML model/LLM evaluation, quality gates | LLM-as-judge, RAGAS, DeepEval, CI eval gate, regression detection |

When tests depend on current external API behavior, provider docs, CI service
behavior, test-environment versions, dependency audit evidence, or recorded
mock/fixture sources, read the active `search` skill and follow its
source-fetch and evidence-status rules.

---
## 1. Test Strategy
### 1.1 Models
| Model | Best For | Emphasis |
|-------|----------|----------|
| Test Pyramid | monoliths, libraries | speed, isolation |
| **Testing Trophy** | modern web apps, REST backends | confidence-to-cost |
| Test Honeycomb | microservices, async systems | boundary verification |

### 1.2 Recommended Trophy Distribution
| Layer | Default Share | Typical Tools |
|-------|---------------|---------------|
| Static analysis | base layer | `tsc`, ESLint, mypy, Ruff |
| Unit | ~25% | Vitest, Jest, pytest |
| **Integration** | **~50%** | Supertest, httpx, Testcontainers |
| Contract | ~10% | Pact, OpenAPI validators, Schemathesis |
| E2E | ~10% | Playwright |
| Manual / exploratory | ~5% | human review |
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
### 1.5 General Rules
- Write tests for **new features, bug fixes, refactors, and behavior changes**.
- Prefer **one behavioral concern per test**.
- Use factories / builders for setup; avoid repeated inline blobs.
- A fast real dependency beats a mock. A mock beats an untested branch.
- If the failure is mysterious, **delegate methodology to `dev-debugging`**, then return here for the regression harness.
- **STRICT (TEST-ANTI-FLAKE-01):** A time-based flake is a bug. Do not use sleep-based synchronization, retry-as-fix, or green-on-retry acceptance without a deterministic cause and harness correction.
- Verification depth follows `dev` §3 `DEV-VERIFY-FLOOR-01`; CRUD per-operation negative coverage is owned by `references/core/crud-test-matrix.md`.
---
## Limited-Oracle / Score-Objective Evaluation

Use this section when the real evaluator is scarce, paid, rate-limited, or opaque, and
local tests are proxy metrics for a score/objective. These rules are paired with
`cxc-pabcd` §Optimization-Loop Meta-Rules (plateau discipline). They were observed in a
14-discard optimization plateau where a prefix-only replay gate and hard
draw-protection invariant locked a 3.5/8 score.

- **GATE-ORACLE-VALIDITY-01 (STRICT):** When the true evaluator/oracle is
  rate-limited and local metrics are proxies, evaluator validity is a PREREQUISITE
  gate. Before trusting the proxy for accept/reject, quantify historical divergence:
  cases where the proxy said better/equal but the oracle said worse. A proxy with known
  optimistic bias must not be the sole acceptance evidence.
- **GATE-PREFIX-HORIZON-01 (DEFAULT):** Replay-based evidence, such as recorded logs or
  scripted opponents, is prefix-valid only. It stops being valid as soon as the
  candidate diverges from the recorded trajectory. Candidates that diverge early need
  live adversarial evaluation with a modeled opponent/environment, not replay-only
  acceptance. State the divergence turn/point whenever citing replay evidence.
- **GATE-INVARIANT-EV-01 (DEFAULT):** Every hard invariant in an acceptance gate, meaning
  a metric that must not regress, needs an expected-value justification: the value it
  protects versus the candidate-space it vetoes. If a hard invariant vetoes three or
  more consecutive candidates that target strictly larger gains, downgrade it to a
  soft cost and re-justify or remove it.
- **GATE-HOLDOUT-LEAKAGE-01 (DEFAULT):** Fixed evaluation assets - recorded logs, test
  maps, sparring bots, graders, and even public oracle outcomes - become training data
  once candidates are repeatedly tuned against them (adaptive reuse overfits the
  holdout itself; Blum & Hardt's Ladder, arXiv:1502.04585, and the reusable-holdout
  line, arXiv:1506.02629). Rotate or expand the gate's instance set as tuning
  accumulates, and reserve a blind slice (instances never used for candidate
  selection) as the final acceptance check. A candidate that wins only on the tuned
  set and not on the blind slice is gate-overfit, not improved.
- **GATE-AGREEMENT-STATS-01 (HEURISTIC):** Calibrate a proxy against the scarce oracle
  with agreement statistics, not correlation alone: sign-discordance rate (proxy said
  better/equal, oracle said worse), mean and worst-case proxy-minus-oracle error, and
  rank agreement on paired decisions (Bland-Altman method-comparison doctrine). Track
  these per scenario family - a proxy can be trustworthy on one instance class and
  optimistic on another - and re-derive them whenever the oracle returns new results.

### 1.6 Property-Based & Mutation Testing (verified 2026-07-02)

| Technique | Use for | Default tools | When |
|-----------|---------|---------------|------|
| Property-based | Pure logic, parsers, serializers, state machines, API invariants | fast-check (TS), Hypothesis (Python) | DEFAULT for invariant-heavy code |
| Mutation | Judging test-suite strength on critical logic/validators/security branches | Stryker (JS/TS), mutmut (Python) | Selective, after stable unit/property tests |

- Vitest 4 is the current runner baseline: Browser Mode is stable (visual regression `toMatchScreenshot`, Playwright trace generation, `expect.schemaMatching`).

## 2. Backend & API Testing
> Deep reference: `references/backend-testing.md`
### 2.1 Coverage Map
| Layer | Verify | TypeScript Default | Python Default |
|-------|--------|-------------------|----------------|
| Service layer | validation, orchestration, domain errors | Vitest | pytest |
| API layer | status, envelope, middleware, auth | Supertest | httpx / ASGITransport |
| Repository layer | SQL / ORM correctness | Testcontainers + real DB | Testcontainers + real DB |
| Background jobs | idempotency, retry, dead-letter | Vitest + fake clock | pytest + monkeypatch |
### 2.2 Mock Strategy Hierarchy
```text
real deterministic dependency
→ Testcontainers / ephemeral infra
→ recorded responses / thin fake
→ manual stub / fake
→ framework mock as last resort
```
### 2.3 Service & API Patterns
Mock dependencies at service boundaries. Use Supertest/httpx for route-level integration tests. Match response envelope shape from backend contracts.
### 2.4 Database Truth with Testcontainers
Use a **real database** when verifying migrations, transactions, unique constraints, foreign keys, query translation, and performance-sensitive SQL. Use Testcontainers for real DB truth in correctness-sensitive persistence tests. Start container in beforeAll/fixture setup, capture connection URI.
### 2.5 Fixture / Seed Synchronization
- Prefer builders / factories over copied JSON snapshots.
- Keep shared contract examples in `fixtures/contracts/` or equivalent.
- Seed data should expose **stable IDs** used by Playwright smoke flows.
- If frontend mocks drift from backend fixtures, write or update a **contract test first**.
---
## 3. Contract Testing
Contract tests protect the **frontend↔backend boundary**. They sit between API tests and browser tests.
**Rule**: Playwright proves the experience. Contract tests prove the shared shape.
### 3.1 Contract-Stable Surface
- response envelope: `success`, `data`, `error`, `meta`
- error taxonomy: HTTP status + machine-readable `error.code`
- pagination fields, auth headers, cookie behavior
- `requestId` propagation
- nullability, timestamps, enums, money serialization
### 3.2 Contract Options
| Style | Best For | Tooling |
|-------|----------|---------|
| consumer-driven contract | rapidly changing frontend/backend teams | Pact |
| schema-first contract | OpenAPI-led backends | OpenAPI validators, Schemathesis |
| type-level contract | TS monorepos | shared types / codegen |
| full-stack smoke | final user confidence | Playwright |
### 3.3 Consumer Contract — TypeScript (Pact / PactV4)
`PactV4` (aliased `Pact`) is the current interface (Pact Specification v4); treat `PactV3` as the legacy spec-v3 API. Workflow:
1. Define interaction: provider state + request + expected response (use `MatchersV3` for flexible matching)
2. Execute test against Pact mock server
3. Assert consumer expectations
4. Pact file auto-writes to `pacts/` → publish to broker → provider verifies

See `references/backend-testing.md` for a full example.
### 3.4 Schema Verification
Use schema-based API testing (Schemathesis) to verify OpenAPI/GraphQL contract compliance. (Dredd is legacy/inactive — do not adopt for new projects.)
### 3.5 Rules
- Contract tests are **strongly recommended** for parallel FE/BE, public APIs, and cross-team contracts.
- E2E success does **not** replace provider verification.
- Store golden examples near the contract, not inside one app only.
- If the shape is intentionally breaking, update the contract first, then all consumers.
---
## 4. Playwright Browser Testing
Use Playwright after API and contract tests are already trustworthy. Browser tests should validate rendered flows, accessibility-critical interactions, and real integration seams that lower layers cannot prove alone.
**Helper Scripts Available**:
- `scripts/with_server.py` - Manages server lifecycle (supports multiple servers)
Run scripts with `--help` first — treat as black boxes to avoid context window pollution.
### 4.1 Decision Tree: Choosing Your Approach
```
User task → Static HTML? → Read file → find selectors → write Playwright script
         → Dynamic app? → Server running? → No: `python scripts/with_server.py --help`
                                           → Yes: Recon-then-action (navigate → screenshot → selectors → act)
```
### 4.2 Example: Using with_server.py
```bash
# Single server:
python scripts/with_server.py --server "npm run dev" --port 5173 -- python your_automation.py

# Multiple servers:
python scripts/with_server.py \
  --server "cd backend && python server.py" --port 3000 \
  --server "cd frontend && npm run dev" --port 5173 \
  -- python your_automation.py
```
### 4.3 Reconnaissance-Then-Action Pattern
1. Wait for an explicit app-ready signal or locator assertion → 2. Screenshot/inspect DOM → 3. Identify selectors → 4. Execute actions

### 4.4 Best Practices
- **Use bundled scripts as black boxes** — run `--help` first, invoke directly.
- Use `sync_playwright()` for synchronous scripts; always close the browser.
- Prefer locator-based interactions and web-first assertions: `expect(page.get_by_role("button", name="Save")).to_be_visible()`, then `click()` on that locator.
- Prefer user-facing locators, especially `get_by_role()` with an accessible name. Use `get_by_label()`, `get_by_placeholder()`, or `get_by_test_id()` when role/name cannot express the target.
- Avoid `networkidle`, hard sleeps, and `wait_for_timeout()` in tests. Wait on observable app-ready signals, locator actions, or `expect()` assertions.
- **AI-authored tests (DEFAULT):** Playwright MCP / Test Agents are generation-and-repair aids only — final acceptance still requires deterministic locators, web-first assertions, traces, and a human-readable failure artifact.
### 4.5 Reference Files
- **examples/** - Examples showing common patterns:
  - `element_discovery.py` - Discovering buttons, links, and inputs on a page
  - `static_html_automation.py` - Using file:// URLs for local HTML
  - `console_logging.py` - Capturing console logs during automation
### 4.6 Browser Testing Rules
- Run **contract tests and API tests first** for broken-data bugs.
- Use Playwright for **rendered truth**, not as a replacement for service tests.
- Prefer one smoke flow per critical path over many brittle micro-flows.
- If a failure looks like data-shape drift, go back to **§2 Backend & API Testing** or **§3 Contract Testing**.
---
### 4.6 Native Computer-Use / Browse-Use QA (exploratory tier) (TEST-CU-QA-01)

Playwright owns DETERMINISTIC, repeatable suites. The native tools
(`structure/60_native_capabilities.md`) own the EXPLORATORY tier — use them when the
question is "does this change actually work in the real UI right now", not "guard this
flow forever":

**QA tool ladder (QA-TOOL-LADDER-01, canonical).** Ordered hierarchy for QA of
surfaces the agent built/serves. Rungs 1-3 are all CUA-class control (see, act,
screenshot); rung 4 is the one non-CUA scripted rung. Start at rung 1; state why
when you skip down:

1. **`browser:control-in-app-browser`** — DEFAULT. Drive a local dev server /
   file-backed page: navigate, click, type, screenshot. Owns web-UI spot checks
   after a change.
2. **`chrome:control-chrome`** — the same flow in the user's REAL Chrome (CDP):
   escalate only when the check needs a logged-in session, an extension,
   profile state, or a WAF'd page the in-app browser cannot pass.
3. **`computer-use:computer-use`** — GUI last resort: desktop apps,
   iOS-simulator flows, GUI-only bug repro, browser chrome itself. Per-app
   approval applies; NEVER drive terminals or Codex itself; keep credential
   flows human-supervised.
4. **`agbrowse`** (cxc-search's proof helper) — non-CUA scripted HTTP/CDP
   evidence envelopes. QA-legal ONLY for public-URL response-shape checks
   (e.g. a deployed endpoint's headers/body); never for driving built UI.

**Inversion note vs `cxc-search` SEARCH-BROWSE-01:** the search ladder is
agbrowse-FIRST because it proves PUBLIC-web claims with scripted evidence. This
QA ladder is in-app-browser-first because it drives surfaces the agent itself
serves — the two orderings are scoped, not contradictory.

**Protocol (imported CDP doctrine):** inspect -> act -> re-inspect. Verify state before
and after every action; when DOM inspection fails (canvas/WebGL/shadow-DOM), take a
screenshot, read it back with `view_image`, and use pointer-level interaction. Never
chain blind actions.

**Evidence (binds to PABCD C):** an exploratory QA pass counts as C-phase evidence only
with artifacts — the screenshot(s) read via `view_image`, the exact flow driven, and the
observed result stated. `chronicle` (screen-history snapshots) can recover "what did the
screen show" after the fact. A green exploratory pass does NOT replace the deterministic
suite for regression-worthy flows — promote the flow to Playwright when it must stay
guarded (§4.1).

**Canonical owner note:** this section owns the TOOL ROUTING (which native tool drives
which surface). The manual QA PROCEDURE — scenario matrix, evidence contract under
`.codexclaw/evidence/<session>/qa/`, adversarial classes, oracle passes, teardown
receipts — is canonically owned by `cxc-qa` (`skills/qa/SKILL.md`); load it for any
surface-proof pass.

## 5. CI Pipeline Integration
> Full workflow templates: `references/ci-pipeline.md`
### 5.1 Pipeline Order
```text
quality (lint / typecheck)
→ unit + integration tests
→ contract tests
→ Playwright E2E
→ security scan
→ coverage aggregation + artifacts
```
### 5.2 Pipeline Template
Structure CI jobs in dependency chain: `quality → backend-tests → contract-tests → e2e`

Key configuration:
- `concurrency.cancel-in-progress: true` — avoid wasted runs
- `strategy.fail-fast: false` — for matrix builds
- Shard large suites: `--shard=${{ matrix.shard }}/N`
- Install Playwright deps: `npx playwright install --with-deps chromium`

See `references/ci-pipeline.md` for full GitHub Actions and GitLab CI templates.
### 5.3 Matrix & Parallelization
| Dimension | When to Use |
|-----------|-------------|
| Node / Python version matrix | packages, SDKs, shared libraries |
| OS matrix | native modules, CLI behavior |
| shard matrix | large suites exceeding CI budget |
```bash
npx vitest run --shard=1/4
npx playwright test --shard=1/4 --workers=4
pytest -n auto --dist=loadgroup
```
### 5.4 Flaky Test Remediation
| Symptom | First Fix |
|---------|-----------|
| passes locally, fails in CI | deterministic seeds, containerized deps, explicit waits |
| order-dependent failure | reset shared state in fixtures |
| green on retry only | remove wall-clock / random assumptions |
| screenshot noise | stable CI image, mask dynamic regions |
Protocol: detect → quarantine if blocking → assign owner → reinstate after repeated green runs.
### 5.5 CI-Green Loop
**STRICT (TEST-CI-GREEN-01):** Latest HEAD is the source of truth. Inspect the
failing job and artifacts before editing, make the minimal correct fix, run local
verification when it reduces next-fail risk, then re-watch the latest HEAD.
Repeat until green; never blind-retry a failed job or push another change without
new failure evidence.
### 5.6 Rules
- Do not let Playwright be the **only** blocking job.
- Contract tests should run **before** browser tests.
- Upload artifacts for failures: coverage, junit, traces, screenshots.
- Fail the build on broken thresholds, not only test exit codes.
---
## 6. TDD Enforcement Mode
When `ENFORCE_TDD=true` is set in project instructions or explicitly requested, this section becomes mandatory.
### 6.1 RED → GREEN → REFACTOR
1. **RED** — write the failing test first and verify it fails for the right reason.
2. **GREEN** — write the minimum implementation to pass.
3. **REFACTOR** — clean up after green, then rerun the affected suite.
### 6.2 Self-Audit Checklist
| Check | Pass Criteria |
|-------|--------------|
| Test written before implementation? | test file added / updated before or with code |
| Failure observed before fix? | red state was actually executed |
| Behavior-focused assertions? | checks outputs, side effects, contracts |
| Regression locked in? | failing case is now protected by a persistent test |
### 6.3 Vertical Tracer-Bullet TDD
Prefer one behavior test → minimal implementation → next behavior. Slice by something
a user, caller, or consuming module can observe, not by horizontal layers such as "DB",
"API", then "UI". Assert through public interfaces and durable contracts. Retire shallow
scaffolding tests when a stronger interface or acceptance test covers the same promise.
### 6.4 Default Style
| Style | Best For |
|-------|----------|
| London / mockist | orchestration-heavy boundaries |
| Chicago / classicist | domain logic and transforms |
| **Hybrid** | most production code |
Default to **Hybrid**: mock external systems, keep internal collaboration real unless it becomes too slow or unstable.
### 6.5 Boundary with dev-debugging
- `dev-testing` owns the **regression harness** and enforcement loop.
- `dev-debugging` owns **root-cause methodology** once a failure is mysterious or multi-layered.
- After `dev-debugging` isolates the cause, come back here to lock it in with tests.
---
## 6.6 AI-Assisted Development Regressions

When an AI writes and reviews its own code, it carries the same assumptions into both steps. Automated tests break this feedback loop.

### Common AI Regression Patterns

| Pattern | Description | Test Strategy |
|---------|-------------|---------------|
| Sandbox/production mismatch | Fix applied to one code path, not both | Assert same response shape in both modes |
| SELECT clause omission | New field in response but missing from DB query | Assert all required fields are present and defined |
| Error state leakage | Error set but stale data not cleared | Assert state cleanup on error transitions |
| Missing rollback | Optimistic UI update without recovery on failure | Assert state restoration after simulated API error |

### Regression Naming Convention

Name regression tests with BUG-R{N} convention. Assert all required fields with a loop.

### Sandbox-Mode API Testing

When the project supports a sandbox/mock mode, use it for fast DB-free regression testing:
- Force sandbox mode in test setup: `process.env.SANDBOX_MODE = 'true'`
- Assert sandbox responses match the same contract as production responses.
- Treat sandbox/production parity as a high-priority regression target.
- In sandbox/spike mode, write tests for bugs found — coverage grows organically. For production refactors, see §1.5 (tests required for behavior changes).

---
## 6.7 Test-Induced Production Defense Detection

**Rule:** Do not add production defensive code solely to satisfy unrealistic tests. A production guard is allowed only when the invalid state can occur at a real boundary or represents an explicit domain rule.

| Production change smell | Likely test problem | Required action |
|---|---|---|
| Internal `if (!x) return` added after unit test fails | Test fixture omitted required field | Fix fixture factory or test boundary validation |
| Required field made optional to satisfy test | Test is using invalid domain object | Restore required type and update test data |
| Catch-all added so test passes | Test expects silence instead of failure | Assert typed error or user-visible failure |
| Production default added for impossible state | Test bypassed constructor/parser | Use real constructor/parser in test |
| Private helper exported only for test | Test is coupled to implementation | Test public behavior or move helper to test support |
| Sleep/retry added only for test flake | Test lacks deterministic synchronization | Wait on observable condition or fake clock |
| `NODE_ENV === "test"` branch added | Test-only production behavior | Remove branch; improve test harness |

**Required questions before adding a guard:**
1. Is the input from an untrusted boundary? → If yes, validate at that boundary
2. Can this state happen in production? → If no, fix the test
3. What contract allows this value? → Cite schema/type/domain rule
4. Would this hide a real bug? → If yes, fail fast instead

**Banned patterns:** `process.env.NODE_ENV === "test"` branches, silent fallbacks for impossible internal state, making required types optional for mocks, exporting internals only for tests.

**Allowed guards:** Boundary validation (process/network/user/file boundary), backward compatibility (documented old schema), security checks, domain invariants, observed production bug regressions, external dependency adapters.

---
## 7. Accessibility Testing

### Component Level
- jest-axe / vitest-axe: run axe-core on rendered components
  ```ts
  import { axe, toHaveNoViolations } from 'jest-axe'
  expect.extend(toHaveNoViolations)
  expect(await axe(container)).toHaveNoViolations()
  ```

### Page Level
- Playwright a11y assertions:
  ```ts
  import AxeBuilder from '@axe-core/playwright'
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
  ```

### CI Pipeline
- Gate order (verified 2026-07-02): component axe → page axe (@axe-core/playwright) → keyboard/focus/manual checks. Blocking gate = zero serious/critical axe violations + manual checks; Lighthouse a11y score (≥90) is advisory smoke only
- Pa11y: page-level scanning for WCAG AA violations
- Run a11y tests on EVERY page route, not just the homepage

### Observability Verification

Verify trace propagation in integration tests. Assert that spans appear for critical paths. Check structured log format matches the schema in `dev-backend/references/core/observability.md`.

---

## 8. Security Testing
**→ Delegated**: threat modeling and secure design policy belong to `dev-security`.
This section covers the **automated test hooks and CI gates** that enforce those rules.
### 8.1 Minimum Security Stack
```text
fast local checks
→ Semgrep / CodeQL gate
→ dependency audit
→ auth / validation regression tests
```
### 8.2 Dependency Scanning Commands
```bash
npm audit --audit-level=high
pip-audit --strict --desc
```
### 8.3 Semgrep Gate
```yaml
semgrep:
  runs-on: ubuntu-latest
  container: semgrep/semgrep
  steps:
    - uses: actions/checkout@v4
    - run: semgrep ci --config p/default --config p/javascript --config p/typescript --config p/python
# (returntocorp/semgrep-action is deprecated per its own repo; Opengrep is the active LGPL fork alternative)
```
### 8.4 Security Regressions
Test missing auth (expect 401) and verify error.code matches contract for every auth-protected endpoint.
### 8.5 Rules
- dependency audit in CI
- Semgrep or equivalent SAST
- auth / permission regression tests
- validation tests for malicious or malformed input
- a blocking rule for high / critical dependency findings
---
## 9. Coverage & Quality Gates
### 9.1 Suggested Thresholds
These are project/risk-based, not universal minimums. Adjust for your context.

| Metric | Suggested Floor | Ideal |
|--------|-----------------|-------|
| Line coverage | 70% | 85%+ |
| Branch coverage | 60% | 80%+ |
| Function coverage | 80% | 90%+ |
| Diff coverage | 80% | 90%+ |
### 9.2 Outcome Metrics
| Metric | Target |
|--------|--------|
| Defect detection rate | > 80% |
| Mean time to detect | < 1 CI run |
| Test signal-to-noise | > 95% |
| Contract drift rate | near 0 |
### 9.3 Coverage Workflow
1. generate coverage reports
   ```bash
   npm test -- --coverage
   npx vitest run --coverage
   pytest --cov --cov-report=xml
   ```
2. review by priority: auth, payment, mutations, upload, contracts first
3. write targeted tests for the gaps
4. publish artifacts and fail the merge when thresholds drop
### 9.4 Quality Gate Checklist
- [ ] focused unit / service tests
- [ ] API integration tests for changed routes
- [ ] contract tests for shared payload changes
- [ ] Playwright smoke for critical rendered journeys
- [ ] security scan / dependency scan
- [ ] coverage thresholds and diff coverage
- [ ] CI artifacts uploaded for failure analysis
---
## 10. Pre-Flight Test Checklist
### 10.1 Change-Type Routing
- [ ] pure business logic change → add / update unit or service tests
- [ ] API or middleware change → add / update API integration tests
- [ ] shared frontend↔backend payload change → add / update contract tests
- [ ] rendered user flow change → add / update Playwright smoke coverage
- [ ] auth / upload / billing / external integration change → add security or edge-case regression coverage
### 10.2 Harness Readiness
- [ ] fixtures are deterministic and reusable
- [ ] real dependencies are used where correctness matters
- [ ] Testcontainers are used for DB truth, not mocked SQL
- [ ] external APIs are mocked or recorded intentionally, not accidentally called live
- [ ] `ENFORCE_TDD` requirements were followed if enabled
### 10.3 Contract & Data Integrity
- [ ] response envelope remains stable or contract was updated first
- [ ] error codes are asserted, not only HTTP status
- [ ] `requestId`, pagination, and nullability are verified where relevant
- [ ] frontend fixtures do not drift from backend examples
### 10.4 CI & Reporting
- [ ] relevant CI jobs exist and are actually executed
- [ ] sharding / matrix choices match project size
- [ ] flaky failures were investigated instead of blindly retried
- [ ] coverage / junit / trace artifacts are available on failure
### 10.5 Final Rule (risk-tier)
Verification intensity follows the work class (`dev` §0.0 / `references/core/crud-test-matrix.md`):
for C2 UI work, one focused smoke (manual click-through or one Playwright run) plus targeted
checks IS a complete story; for C3/C4 or release-sensitive work, a single smoke is not enough —
run the affected suites and required negatives. Manual/Playwright smoke is a risk-tier rule,
not a universal blocker.
```text
unit / service
→ API integration
→ contract verification
→ Playwright smoke
→ CI gate + coverage + security scan
```
