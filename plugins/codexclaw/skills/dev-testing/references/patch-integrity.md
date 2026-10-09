## Patch Integrity Gate (TEST-PATCH-INTEGRITY-01, DEFAULT)

Source: sol research (SWE-bench containerized evaluation, addyosmani/agent-skills).

An agent that obtains green by weakening tests has not fixed the bug. Before
claiming implementation complete:

1. **Baseline**: record which tests fail and their failure signatures BEFORE any
   production code change.
2. **Implement**: write the fix/feature.
3. **Re-run originals**: execute the ORIGINAL test suite (not the modified version)
   against the patched source. All baseline failures must now pass.
4. **Classify test changes**: every test/config change is `required` (new test for
   new behavior), `suspicious` (deleted assertion, lowered threshold, added skip,
   reduced coverage exclusion), or `unrelated`.
5. **Justify suspicious changes**: each suspicious change needs a stated reason.
   "The test was wrong" is valid only with evidence of the original test's incorrectness.

Red flags that trigger escalation:
- Deleted assertions without replacement
- Snapshot updates without visual/behavioral verification
- Coverage exclusions added in the same PR as the fix
- `@skip` or `.skip()` added to failing tests — unless it is a `TEST-FLAKE-QUARANTINE-01` quarantine carrying all four required fields (`ci-pipeline.md` §5.3)
- Threshold reductions (e.g., coverage 80% → 60%)
- Type assertion suppressions (`as any`, `@ts-ignore`) in test files
