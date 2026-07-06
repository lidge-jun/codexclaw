---
name: cxc-dev-debugging
description: "MUST USE for any real runtime debugging in any language — crashes, silent failures, wrong output, build/test failures, flaky tests, performance regressions, integration bugs. A phases 0-4 root-cause method: architecture check → investigate → analyze → hypothesize → implement. Triggers: 'debug this', 'why is X failing', 'this test is flaky', 'fix the crash', 'root cause', '왜 안 돼', '디버깅', '원인 분석'."
metadata:
  last-verified: "2026-07-02"
  short-description: "Phases 0-4 systematic root-cause debugging method (any language)."
  keywords: [debug, error, stack trace, root cause, flaky, regression, crash, bisect]
---

# dev-debugging — Systematic Root Cause Analysis

This skill is the **thinking process** for fixing bugs. As a routing role it activates
by change-surface (an error/bug to diagnose), not by any external dispatcher. It enforces a structured
phases 0-4 methodology for every technical issue — test failures, runtime errors,
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

**STRICT (DEBUG-RCA-EVIDENCE-01):** Before investigating any single root-cause
hypothesis or making a root-cause claim, write at least three orthogonal
hypotheses (`H1/H2/H3`) and one falsifier for each. Collapse duplicates, test
against disconfirming evidence, and do not claim root cause until competing
hypotheses have been ruled out by evidence. If fewer than three are plausible,
state why.

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

**STRICT (DEBUG-TOGGLE-PROOF-01):** Enter implementation only after the captured
value matches the hypothesis prediction, the repro repeats, and toggling the
suspected cause off/on removes then restores the bug. Write one paragraph
explaining the causal mechanism before patching.

1. **Write a failing test first** — the test reproduces the bug. It should fail
   before the fix. Use `dev-testing` for TDD patterns and test harness setup.

2. **Make the minimal fix** — address the root cause, not symptoms. One logical
   change only.

3. **Verify**: the test passes, no regressions (run the full test suite:
   `npm test` / `pytest` / equivalent).

4. **Check for similar patterns** — does the same bug class exist elsewhere in
   the codebase? Search for it. Fix all instances, not just the one you found.

5. **Document** — final report and commit message explain root cause AND fix,
   including rejected hypotheses and rejection evidence. Not "fixed bug"
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
tested** (including rejected hypotheses and rejection evidence), **remaining hypotheses** (untested),
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
| `references/methodologies.md` | Choosing a debug approach | Five Whys, bisection, differential diagnosis, subtraction, systematic logging |
| `references/async-debugging.md` | Concurrency issues | Race conditions, deadlocks, event loop blocking, promise/callback |
| `references/tool-guides.md` | Quick cheatsheet | Node inspector basics, pdb basics, Chrome DevTools, git bisect, DB EXPLAIN |
| `references/postmortem-template.md` | After resolving a significant incident | Blameless postmortem template |
| `references/runtimes/node.md` | Node.js / tsx / Bun / Deno | Phase 0 detection, tsx source-map trap, launch recipes, `exec()` patterns, silent-failure table, cleanup |
| `references/runtimes/js/nextjs-react.md` | Next.js 16 / React 19 | Server-vs-client attach split, DevTools MCP, hydration mismatch workflow, React Compiler debug, RSC silent-failures |
| `references/runtimes/js/vite-vitest.md` | Vite 8 / Vitest 4 | forwardConsole agent forwarding, plugin-transform debug, visual regression, HMR + build-time silent-failures |
| `references/runtimes/js/node-backend.md` | Express 5 / Fastify 5 / NestJS 11 | Router debug namespaces, lifecycle hooks, schema serialization drops, DI errors, AsyncLocalStorage loss |
| `references/runtimes/python.md` | Python (CPython 3.9+) | Attach methods, pdb/ipdb/pudb, pytest, asyncio gotchas, PEP 768 safe attach, py-spy/memray, silent-failures |
| `references/runtimes/rust.md` | Rust | Hierarchy (dbg! -> RUST_LOG -> backtrace -> gdb/lldb -> tokio-console -> cargo-expand), Miri UB, silent-failures |
| `references/runtimes/go.md` | Go | Delve launch/attach, goroutine patterns, race detector, pprof, GODEBUG, silent-failures |
| `references/runtimes/c-cpp.md` | C/C++ | Sanitizers (ASan/TSan/MSan/UBSan), GDB/LLDB, Valgrind, CMake debug builds, UB silent-failures |
| `references/runtimes/jvm.md` | Java/Kotlin (JVM) | jcmd live diagnostics, JFR profiling, JDWP/JDB, Kotlin coroutines, GraalVM native-image |
| `references/runtimes/swift.md` | Swift / iOS | LLDB, Instruments, Swift concurrency, simulator CLI, crash symbolication |
| `references/runtimes/ruby.md` | Ruby (3.2+) | debug gem/rdbg, binding.irb, pry, Rails tools, nil-propagation silent-failures |
| `references/runtimes/beam.md` | Elixir/Erlang (BEAM) | IEx.pry, Observer, :dbg/recon, supervision hiding, mailbox/atom/binary leaks |
| `references/tools/playwright.md` | Browser/web-surface bugs | codegen repro, PWDEBUG, trace viewer, console/network listeners, viewport gotchas |

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
(3) phases 0-4 — architecture check → investigate → analyze → hypothesize → implement,
(4) Repeated Failure Rule — after repeated failures, reassess, (5) one variable at a time,
(6) evidence over intuition, (7) failing test first.
