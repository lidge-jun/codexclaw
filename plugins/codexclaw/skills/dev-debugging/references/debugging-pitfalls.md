## When to Activate

- Test failures, runtime errors, build failures, performance regressions
- Integration issues (API, database, third-party), CI pipeline failures
- **Especially**: when under time pressure or when "just one quick fix" seems obvious — that's when methodology matters most

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
| Claiming "fixed" without running verification | Run the relevant checks, show output, and verify the original symptom |
| Copy-pasting a fix without understanding | Understand why the fix works, then adapt to your codebase |
| Suppressive try/catch (catch-and-ignore, catch-and-return-null) | Fix at the source. Boundary catch with logging/re-throw is fine — see dev-architecture §4. |
| Guessing at types, nulls, or undefined values | Add diagnostic logging, inspect actual runtime values |
| "It works now" after changing something unrelated | Correlation ≠ causation — revert the change and test again |
