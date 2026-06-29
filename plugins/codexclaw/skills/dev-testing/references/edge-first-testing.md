# Edge-First Testing Workflow

## Principle

Write edge case tests BEFORE happy path tests. Most bugs hide at boundaries, not in the golden path. If you only have time for 5 tests, 4 should be edge cases.

## Test Order by Change Type

| Change Type | First Tests | Then |
|---|---|---|
| New API endpoint | Invalid input, auth failure, rate limit | Happy path |
| Data migration | Empty table, max-size row, concurrent write | Normal migration |
| UI component | Empty state, overflow text, disabled state | Normal render |
| Bug fix | Regression test for the bug | Related edges |
| Config change | Missing value, malformed value, env mismatch | Default behavior |
| Async workflow | Timeout, partial failure, retry exhaustion | Successful completion |

## Edge Case Matrix (11 Classes)

| Class | Examples |
|---|---|
| Boundary | 0, 1, MAX, MAX+1, negative |
| Empty | null, undefined, "", [], {} |
| Type coercion | "1" vs 1, true vs "true", NaN |
| Concurrency | Simultaneous writes, read-during-write, lock contention |
| Timeout | Network timeout, DB timeout, queue timeout, graceful vs hard |
| Permission | No auth, expired token, wrong role, revoked mid-session |
| Encoding | Unicode, emoji, RTL text, special chars (&, <, "), zero-width |
| Size | Extremely long strings, huge payloads, many items, 0 items |
| State | Uninitialized, mid-transition, corrupted, stale cache |
| Order | Out-of-order events, duplicate events, missing sequence |
| Environment | Missing env var, wrong timezone, disk full, DNS failure |

## Banned Patterns

| Pattern | Why | Fix |
|---|---|---|
| Testing only happy path first | Bugs cluster at boundaries; happy-path-only gives false confidence | Write edge tests first, happy path last |
| Mocking the thing you're testing | Proves nothing about real behavior | Mock dependencies, not the subject |
| Tests that pass with any implementation | Zero signal; test is decorative | Assert specific outputs for specific inputs |
| Copy-paste test with one value changed | Hides missing edge classes | Use the 11-class matrix above systematically |
| Asserting no error instead of correct result | Passes on silent wrong output | Assert the exact expected value |

## Definition of Done

- Edge coverage >= happy path coverage (measure by test count per class)
- Every class from the matrix above is represented OR explicitly marked N/A with reason
- Regression test exists for every bug fix before the fix is applied
- No test passes when the implementation is deleted or replaced with a stub
