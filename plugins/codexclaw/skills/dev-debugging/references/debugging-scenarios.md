## Concrete Debugging Scenarios

### Scenario A: API Returns 500

Root cause pattern: Missing input validation lets undefined values propagate into business logic. Instrument controller/service/repository boundaries to find where the bad value enters. Compare with a working endpoint that validates input with a schema. Fix: add schema validation at the entry point, write a test that sends invalid input and expects 400.

Worked example:

```bash
curl -i -X POST http://localhost:3000/api/orders \
  -H 'content-type: application/json' \
  -d '{"sku":"book-1"}'
```

Observed failure:

```text
HTTP/1.1 500 Internal Server Error
TypeError: Cannot read properties of undefined (reading 'toFixed')
    at calculateTotal (src/orders/service.ts:42:21)
    at createOrder (src/orders/controller.ts:27:18)
```

Competing hypotheses before narrowing:

1. Request validation allows missing `quantity`.
2. Controller mapping drops `quantity` before service call.
3. Repository returns an order row with `quantity = null`.

Boundary instrumentation:

```bash
DEBUG=orders:* npm run dev
curl -s -X POST http://localhost:3000/api/orders \
  -H 'content-type: application/json' \
  -d '{"sku":"book-1"}' | jq .
```

Sample log output:

```text
orders:controller input {"sku":"book-1"}
orders:controller mapped {"sku":"book-1"}
orders:service input {"sku":"book-1"}
orders:repository skipped insert due service error
```

Rejections: repository-null is rejected because the repository is never reached.
Controller-drop is rejected because controller input already lacks `quantity`.
Root cause: entry validation accepts a payload missing a required domain field.
Fix at the entry boundary: schema rejects missing `quantity`; regression test posts
the same payload and expects HTTP 400 with a stable `error.code`.

### Scenario B: React Hydration Mismatch

Root cause pattern: Server renders a value (e.g., date, locale string) that differs from client-side rendering due to environment differences (UTC vs. local timezone). Compare with components that defer environment-dependent rendering to useEffect. Fix: move environment-dependent formatting into a client component.

### Scenario C: N+1 Query Performance

Root cause pattern: List endpoint lazy-loads related records per item (1 query + N queries). Enable query logging to count queries, then compare with an endpoint that uses eager loading. Fix: add include/joinedload, write a test asserting bounded query count.

### Scenario D: Flaky Test (Intermittent Failure)

Root cause pattern: Test passes in isolation but fails in suite due to shared mutable state (database rows, global variables, uncleared mocks). Compare with stable tests that use transaction rollback in beforeEach/afterEach. Fix: add proper test isolation, then search for other tests missing cleanup.

Policy — what CI may do about a flake, when quarantine is permitted, and what
counts as closing one — is [dev-testing CI pipeline](../../dev-testing/references/ci-pipeline.md) §5
(`TEST-FLAKE-*`). This skill owns the diagnosis; that file owns the disposition.
