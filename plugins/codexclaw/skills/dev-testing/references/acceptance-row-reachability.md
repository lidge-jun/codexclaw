## Acceptance-Row Reachability (TEST-ROW-REACHABLE-01, DEFAULT)

Every row of an acceptance-criteria table must have a CONSTRUCTIBLE precondition. Before
writing a row, ask: is there a call path that reaches this state? Does an earlier guard
consume this condition first, so the branch under test is never entered? Does an operation
that produces this value actually exist?

An unreachable row is decoration, not verification — the implementer tries to write that
test, cannot, and quietly drops it. This applies C-ACTIVATION-GROUNDING-01's requirement
(every conditional path names its activation scenario) to each row of the acceptance table,
not just to the plan's prose.

Common unreachable shapes:

- The row asserts a rejection that an earlier, broader rule already rejects — the specific
  guard is never exercised, so the test passes even if that guard is absent.
- The row needs a state the public API cannot produce (no op creates it).
- The row asserts on a call-site argument the function never receives.
- Two rows in the same table are mutually exclusive on the same tree (e.g. "the gate
  reports a failure here" plus "the gate exits 0 overall").
