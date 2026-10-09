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

## TDD Evidence Contract (TEST-TDD-EVIDENCE-01, DEFAULT)

When TDD is claimed, durable evidence must show:
- RED: failing test name + failure message (before production code)
- GREEN: same test passing (after production code)
- REFACTOR: full affected suite passing (after cleanup)

A TDD claim without RED evidence is not TDD.
