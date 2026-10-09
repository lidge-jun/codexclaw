## The Phases

### Phase 0: Is This a Bug or a Design Problem?

Before debugging code, ask: "Could this be a structural/design issue rather
than a code bug?" Patching symptoms of architectural debt creates an endless
stream of "bugs" that are really design consequences.

**Decision Tree — escalate to architecture review if any apply:**

| Signal | Interpretation |
|--------|---------------|
| Same class of bug recurring (3rd time fixing similar issue) | Design problem — add a constraint at the architecture level |
| Bug spans multiple modules / crosses 2+ boundaries | Boundary/coupling issue — see `dev-architecture` |
| Fix would require changing 3+ files simultaneously | Likely structural — single-responsibility violation |
| Symptom appears far from cause (error in UI, root in DB layer) | Tracing/observability gap — instrument boundaries first |

**If structural**: escalate to architecture review. Do not patch the symptom —
the patch creates the next bug.

**Symptom vs Root Cause Fix:**

| Symptom | Likely Patch (wrong) | Root Cause Fix (right) |
|---------|---------------------|----------------------|
| Request timeout | Increase timeout to 30s | Add circuit breaker + fallback |
| OOM crash | Increase container memory | Find and fix the memory leak |
| N+1 query performance | Add a cache layer in front | Fix the query (eager load / join) |
| Duplicate records | Add unique constraint + rescue | Fix the race condition that creates duplicates |
| Flaky test | Add retry/skip annotation | Fix shared mutable state between tests |

**If none of the above apply** — proceed to Phase 1 (it's a code bug, not a
design problem).

---

### Phase 1: Root Cause Investigation

**Feedback loop gate:** For UI, browser, TUI, visual, streaming, or agent-output bugs,
first create a red-capable loop that can fail before the fix: screenshot/assertion,
recorded terminal bytes, Playwright visual check, log fixture, or a manual repro script
with explicit pass/fail evidence. Do not patch from screenshots alone when a repeatable
probe can be built in reasonable time.

**Complete these before attempting any fix:**

1. **Read the full error** — stack trace, line numbers, error code, surrounding
   context. Do not skim. The answer is often in the error message itself.

2. **Reproduce consistently** — exact steps to trigger the bug. If intermittent,
   document frequency, conditions, and environment state. A bug you cannot
   reproduce is a bug you cannot verify as fixed.

3. **Check recent changes** — run `git log --oneline -10` and `git diff`. Check
   new dependencies, config changes, environment variables. Bugs correlate with
   recent changes most of the time.

4. **Trace data flow** — where does the bad value originate? Trace backward from
   the failure point through the call stack until you find the source. Follow the
   full causal chain from trigger → boundary → bad state → failure. Removing the
   visible symptom is not a fix unless the defect that creates the bad state is gone.

5. **Instrument component boundaries** — for multi-layer systems (API → service →
   database, CI → build → deploy), log input/output at each boundary BEFORE
   proposing fixes.

6. **Trace-first for distributed/async/agent failures (DEFAULT)** — capture the
   evidence trail before hypothesizing: request IDs, OpenTelemetry spans/logs,
   Playwright traces/videos, exact agent tool transcripts. For order-dependent or
   intermittent failures logs cannot explain, use time-travel/replay debugging
   (Microsoft TTD on Windows, rr on Linux).

```
For EACH component boundary:
  - Log what data enters the component
  - Log what data exits the component
  - Verify environment/config propagation
Run once → analyze evidence → identify failing layer → investigate THAT layer
```

Work through these steps; skip only if clearly irrelevant to the problem at hand.

### Phase 2: Pattern Analysis

1. **Find working examples** — similar working code in the same codebase. If it
   worked before, use `git bisect` to find the breaking commit (see
   `tool-guides.md`).

2. **Compare systematically** — list every difference between working and broken
   code. No matter how small. Resist assuming "that can't matter."

3. **Read reference docs completely** — official documentation for the library,
   API, or framework involved. Don't skim — read the full relevant section.

4. **Check known issues** — GitHub Issues, changelogs, migration guides. Someone
   may have hit the same bug. Search with the exact error message.

For external/current proof, follow [dev routing](../../dev/SKILL.md#conditional-routes).

### Phase 3: Hypothesis and Testing

Before proceeding, read [RCA entry gates](../SKILL.md#rca-entry-gates).

1. **State the leading hypothesis explicitly** — "X is the root cause because
   evidence Y shows Z." If you can't articulate it clearly, you don't understand
   it yet.

2. **Design a test to disprove** — falsification is stronger than confirmation.
   What would you expect to see if your hypothesis is wrong?

3. **Test one variable** — smallest possible change, one variable at a time.
   Never fix multiple things at once.

4. **If it fails** → move to another listed hypothesis. Revert the failed change and
   start from clean state. Stacking fixes obscures the root cause.

5. **Keep the rejection record** — preserve rejected hypotheses and the evidence
   that rejected them. The final report must include them, not just the winning cause.

6. **Admit ignorance** — "I don't understand X" is a valid finding. Research
   further rather than guessing. Record the open question explicitly.

### Phase 4: Implementation

Before proceeding, read [RCA entry gates](../SKILL.md#rca-entry-gates).

1. **Write a failing test first** — the test reproduces the bug. It should fail
   before the fix. Use `dev-testing` for TDD patterns and test harness setup.

2. **Make the minimal fix** — address the root cause, not symptoms. One logical
   change only.

3. **Verify**: reproduce the repaired behavior and run affected checks at the
   `dev` §3 / `dev-testing` risk floor. Respect user restrictions on local suites.

4. **Check for similar patterns** — does the same bug class exist elsewhere in
   the codebase? Search for it. Fix instances within the authorized scope; report
   additional affected areas rather than silently expanding the patch.

5. **Document** — final report and commit message explain root cause AND fix,
   including rejected hypotheses and rejection evidence. Not "fixed bug"
   but "fix: race condition in session middleware caused by missing await on
   Redis write."

## Compact Summary

When context is limited, preserve: (1) Phase 0 — is it a bug or a design problem?,
(2) Core principle — RCA before permanent repair; preauthorized reversible incident mitigation may come first,
(3) phases 0-4 — architecture check → investigate → analyze → hypothesize → implement,
(4) Repeated Failure Rule — after repeated failures, reassess, (5) one variable at a time,
(6) evidence over intuition, (7) failing test first, (8) comprehension tasks route to
`logic-analysis.md` — "I can't" is a skipped loop.
