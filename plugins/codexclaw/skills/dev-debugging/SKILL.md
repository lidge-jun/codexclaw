---
name: cxc-dev-debugging
description: "MUST USE for any real runtime debugging in any language — crashes, silent failures, wrong output, build/test failures, flaky tests, performance regressions, integration bugs. A 5-phase root-cause method: architecture check → investigate → analyze → hypothesize → implement. Triggers: 'debug this', 'why is X failing', 'this test is flaky', 'fix the crash', 'root cause', '왜 안 돼', '디버깅', '원인 분석'."
metadata:
  short-description: "5-phase systematic root-cause debugging method (any language)."
---

# dev-debugging — Systematic Root Cause Analysis

This skill is the **thinking process** for fixing bugs. As a routing role it activates
by change-surface (an error/bug to diagnose), not by any external dispatcher. It enforces a structured
5-phase methodology for every technical issue — test failures, runtime errors,
build failures, performance regressions, integration bugs.

**Boundary**: This skill covers how to reason about bugs. For test harness,
reproduction frameworks, and verification tooling, see `dev-testing`. For
domain-specific context (API errors, hydration issues, query performance),
consult `dev-backend` or `dev-frontend`.

> **C0/C1 work (small local patches):** See `dev` §0.0 Work Classifier + §0.1 Patch Fast-Path before reading references.

```
dev-debugging = root cause methodology (the thinking)
dev-testing   = test harness for reproducing/verifying (the tooling)
dev §2        = summary pointer to this skill (the overview)
```

---

## Core Principle

Check if the problem is structural before debugging code.
Complete root cause investigation before proposing any fix.
If Phase 1 is not done, keep investigating.

---

## When to Activate

- Test failures, runtime errors, build failures, performance regressions
- Integration issues (API, database, third-party), CI pipeline failures
- **Especially**: when under time pressure or when "just one quick fix" seems obvious — that's when methodology matters most

---

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
   the failure point through the call stack until you find the source. Fix at the
   source, not the symptom.

5. **Instrument component boundaries** — for multi-layer systems (API → service →
   database, CI → build → deploy), log input/output at each boundary BEFORE
   proposing fixes.

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
   `references/tool-guides.md`).

2. **Compare systematically** — list every difference between working and broken
   code. No matter how small. Resist assuming "that can't matter."

3. **Read reference docs completely** — official documentation for the library,
   API, or framework involved. Don't skim — read the full relevant section.

4. **Check known issues** — GitHub Issues, changelogs, migration guides. Someone
   may have hit the same bug. Search with the exact error message.

When the bug depends on third-party library/API/framework behavior, current
error workarounds, upstream issues, changelogs, or migration guides, read the
active `search` skill and follow its source-fetch and evidence-status rules
before treating external material as proof.

### Phase 3: Hypothesis and Testing

1. **State hypothesis explicitly** — "X is the root cause because evidence Y
   shows Z." Write it down. If you can't articulate it clearly, you don't
   understand it yet.

2. **Design a test to disprove** — falsification is stronger than confirmation.
   What would you expect to see if your hypothesis is wrong?

3. **Test one variable** — smallest possible change, one variable at a time.
   Never fix multiple things at once.

4. **If it fails** → form a new hypothesis. Revert the failed change and
   start from clean state. Stacking fixes obscures the root cause.

5. **Admit ignorance** — "I don't understand X" is a valid finding. Research
   further rather than guessing. Record the open question explicitly.

### Phase 4: Implementation

1. **Write a failing test first** — the test reproduces the bug. It should fail
   before the fix. Use `dev-testing` for TDD patterns and test harness setup.

2. **Make the minimal fix** — address the root cause, not symptoms. One logical
   change only.

3. **Verify**: the test passes, no regressions (run the full test suite:
   `npm test` / `pytest` / equivalent).

4. **Check for similar patterns** — does the same bug class exist elsewhere in
   the codebase? Search for it. Fix all instances, not just the one you found.

5. **Document** — commit message explains root cause AND fix. Not "fixed bug"
   but "fix: race condition in session middleware caused by missing await on
   Redis write."

---

## Red Flags — Return to Phase 1

If you catch yourself doing any of these, pause — root cause investigation
was likely skipped.

| Red Flag | Why It Fails |
|----------|-------------|
| "Quick fix for now, investigate later" | First fix sets the pattern. Tech debt compounds. You won't investigate later. |
| "Just try changing X and see" | Guessing guarantees rework. You'll be back here within the hour. |
| "Add multiple changes, run tests" | Can't isolate cause if multiple variables changed. Revert, change ONE thing. |
| "It's probably X, let me fix that" | "Probably" without evidence = Phase 1 not done. Go back and trace it. |
| "I don't fully understand but this might work" | Seeing symptoms ≠ understanding root cause. Your "fix" hides the real bug. |
| "One more fix attempt" (after repeated failures) | After repeated failures, pause and reassess architecture/assumptions. See escalation below. |
| "It works on my machine" | Reproduce in the SAME environment as the failure. Local success proves nothing. |
| "Let me add a try/catch around it" | Suppressing errors is not fixing them. Find WHY it throws. |

**Repeated Failure Rule**: After repeated failed fix attempts, pause entirely.
Each fix revealing a new problem in a different place is a sign of
**architectural issues**, not simple bugs. Discuss with the user before
attempting more fixes.

---

## Slop Debugging Patterns

Slop debugging is spray-and-pray: guess, patch, pray, repeat.

| Instead of… | Use… |
|-------------|------|
| Proposing fixes before investigation | Complete Phase 1 checklist first |
| "Might be X" without evidence | "Evidence shows X because [log/trace/diff]" |
| Multiple simultaneous changes | One change at a time, revert between attempts |
| Skimming stack traces | Read every line of stack trace, note line numbers |
| Silent `catch` blocks that suppress errors | Log with context (`[module] error.message`), re-throw or handle |
| Modifying failing tests to pass | Fix the code, not the test — a failing test is evidence |
| Claiming "fixed" without running verification | Run full test suite, show green output, verify the original symptom |
| Copy-pasting a fix without understanding | Understand why the fix works, then adapt to your codebase |
| Suppressive try/catch (catch-and-ignore, catch-and-return-null) | Fix at the source. Boundary catch with logging/re-throw is fine — see dev-architecture §4. |
| Guessing at types, nulls, or undefined values | Add diagnostic logging, inspect actual runtime values |
| "It works now" after changing something unrelated | Correlation ≠ causation — revert the change and test again |

---

## Concrete Debugging Scenarios

### Scenario A: API Returns 500

Root cause pattern: Missing input validation lets undefined values propagate into business logic. Instrument controller/service/repository boundaries to find where the bad value enters. Compare with a working endpoint that validates input with a schema. Fix: add schema validation at the entry point, write a test that sends invalid input and expects 400.

### Scenario B: React Hydration Mismatch

Root cause pattern: Server renders a value (e.g., date, locale string) that differs from client-side rendering due to environment differences (UTC vs. local timezone). Compare with components that defer environment-dependent rendering to useEffect. Fix: move environment-dependent formatting into a client component.

### Scenario C: N+1 Query Performance

Root cause pattern: List endpoint lazy-loads related records per item (1 query + N queries). Enable query logging to count queries, then compare with an endpoint that uses eager loading. Fix: add include/joinedload, write a test asserting bounded query count.

### Scenario D: Flaky Test (Intermittent Failure)

Root cause pattern: Test passes in isolation but fails in suite due to shared mutable state (database rows, global variables, uncleared mocks). Compare with stable tests that use transaction rollback in beforeEach/afterEach. Fix: add proper test isolation, then search for other tests missing cleanup.

---

## When to Escalate vs When to Keep Digging

### Keep Digging When:

- You have untested hypotheses from Phase 2
- You haven't read the full error message or stack trace
- You haven't checked recent changes (`git log`, `git diff`)
- You haven't found working comparison code yet
- The bug is in YOUR code (not a third-party library)
- You still have untested approaches to try

### Escalate When:

- **Repeated fix attempts failed** — likely architectural; needs human judgment
- **Undocumented library behavior** — file an issue upstream, work around it
- **Environment-specific** — requires access you don't have (prod DB, cloud IAM)
- **Security-sensitive** — don't debug auth/crypto/payment alone; flag for human review
- **Multi-team dependency** — bug is in another team's service or API contract
- **Stalled**: if investigation stalls, reassess approach

### How to Escalate Well

Don't just say "I'm stuck." Provide: **symptom** (exact error), **reproduction
steps**, **evidence gathered** (logs, traces, bisect results), **hypotheses
tested** (what you tried, why it failed), **remaining hypotheses** (untested),
and a **recommendation** for next steps.

---

## Post-Mortem Discipline

After resolving any bug that:
- Was user/customer-impacting
- Took >1 hour to diagnose
- Involved 3+ failed fix attempts (per postmortem-template.md)
- Revealed a systemic issue (same bug class exists elsewhere)

Fill out `references/postmortem-template.md` and include it in the PR or commit.
The goal is **learning, not blame**. Every postmortem must produce at least one
action item that prevents the same class of bug from recurring.

---

## Modular References

| File | When to Read | What It Covers |
|------|-------------|----------------|
| `references/methodologies.md` | When choosing a debugging approach | Five Whys, bisection, differential diagnosis, subtraction, rubber duck, systematic logging |
| `references/async-debugging.md` | When debugging concurrency issues | Race conditions, deadlocks, event loop blocking, promise/callback issues |
| `references/tool-guides.md` | When you need stack-specific debugger commands | Node.js inspector, Python pdb/debugpy, Chrome DevTools, git bisect, database EXPLAIN |
| `references/postmortem-template.md` | After resolving a significant incident | Blameless postmortem template with filled example |

---

## Integration with Other Skills

| Skill | Relationship |
|-------|-------------|
| `dev` §2 | Summary of this methodology. This skill is the full version. |
| `dev-testing` | Phase 4 "write failing test first" → use `dev-testing` for test patterns and harness. `dev-testing` provides the tooling; this skill provides the thinking. |
| `dev-backend` | Server-side debugging context: API errors, database issues, middleware chains. |
| `dev-frontend` | Client-side debugging context: hydration, rendering, DevTools, layout shifts. |
| `dev-code-reviewer` | Code review catches bugs before they ship — prevention beats debugging. |

---

## Security-Sensitive Bugs

For security-sensitive bugs (auth bypass, data leak, injection), follow the incident response in `dev-security/SKILL.md` before applying a fix.

---

## Compact Summary

When context is limited, preserve: (1) Phase 0 — is it a bug or a design problem?,
(2) Core principle — no fixes without root cause,
(3) 5 Phases — architecture check → investigate → analyze → hypothesize → implement,
(4) Repeated Failure Rule — after repeated failures, reassess, (5) one variable at a time,
(6) evidence over intuition, (7) failing test first.
