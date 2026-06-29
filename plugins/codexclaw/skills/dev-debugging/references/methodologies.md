# Debugging Methodologies Reference

Core structured approaches for isolating root causes. Choose based on the
nature of the bug. These methods are complementary — combine them.

---

## Five Whys

Iterative causal analysis. Ask "why" at each level until you reach a systemic
root cause that, if fixed, prevents the entire class of bug.

**When to Use**: Bug has a clear symptom but unclear cause. Post-incident analysis.

**Steps**:

1. State the symptom precisely: "Users get 500 errors on /api/checkout"
2. Ask: Why? — "The payment service throws NullPointerException"
3. Ask: Why? — "The `card` field is null when passed to the charge function"
4. Ask: Why? — "The frontend form submits before card tokenization completes"
5. Ask: Why? — "The submit button is enabled before the async token callback fires"
6. Root cause: Missing guard — submit should be disabled until tokenization resolves

**Exit Condition**: You reach a cause that is (a) actionable, (b) systemic (not
a one-off mistake), and (c) within your control to fix.

**Anti-pattern**: Stopping too early ("because the developer made a mistake")
or going too deep ("because JavaScript is single-threaded"). Stop at the first
actionable systemic fix.

---

## Binary Search / Bisection

Halve the search space repeatedly to isolate the exact point of failure.

**When to Use**: Regression (it used to work). Large codebase or long history.

**Steps — git bisect (temporal)**:

1. Identify a known-good commit and a known-bad commit
2. `git bisect start && git bisect bad && git bisect good <sha>`
3. Git checks out the midpoint — test it
4. Mark `git bisect good` or `git bisect bad`
5. Repeat until the first bad commit is found
6. `git bisect reset` to return to your branch

**Steps — code bisection (spatial)**:

1. Identify the full path from input to failure
2. Add a diagnostic check at the midpoint of the path
3. If data is correct at midpoint: bug is downstream. If wrong: upstream.
4. Repeat on the failing half until you isolate the exact transformation

**Exit Condition**: Single commit or single code transformation identified as the cause.

**Anti-pattern**: Skipping steps by guessing ("it's probably in the last 3
commits"). Let the bisection narrow it — guessing defeats the purpose.

---

## Differential Diagnosis

Enumerate possible causes, then eliminate each with evidence.

**When to Use**: Multiple plausible causes. Non-obvious failures.
Complex systems with many interacting components.

**Steps**:

1. List ALL plausible causes (aim for 5-10). Do not self-censor unlikely ones.
2. For each cause, identify a test that would confirm or eliminate it
3. Run the cheapest/fastest tests first
4. Cross off eliminated causes with the evidence that eliminated them
5. Remaining cause with supporting evidence = your hypothesis

**Template**:

| # | Possible Cause | Test | Result | Status |
|---|---------------|------|--------|--------|
| 1 | DB connection timeout | Check connection pool metrics | Pool at 2/20 | Eliminated |
| 2 | Bad input data | Log raw request body | Contains null `user_id` | Confirmed |
| 3 | Race condition | Add artificial delay | Not reproducible with delay | Eliminated |

**Exit Condition**: One cause remains with positive evidence confirming it.

**Anti-pattern**: Fixating on the first plausible cause without testing the
others. Confirmation bias is the enemy — seek to eliminate, not confirm.

---

## Subtraction Debugging

Remove components until you reach the minimal reproduction case.

**When to Use**: Bug in complex system with many interacting parts. You cannot
trace the cause forward — instead, simplify until only the cause remains.

**Steps**:

1. Start with the full broken system
2. Remove one component/module/feature (comment out, disable, mock)
3. Does the bug still occur? If yes: removed component is innocent. If no: it's involved.
4. Restore that component, remove the next one
5. Once you identify the guilty component, repeat inside it at a finer granularity

**Exit Condition**: Minimal reproduction — smallest possible code that still
exhibits the bug. Often 5-20 lines.

**Anti-pattern**: Removing multiple things at once (can't tell which mattered).
Giving up too early ("it's too interconnected to simplify").

---

## Rubber Duck Debugging

Explain the problem aloud (or in writing) in simple terms to expose hidden assumptions.

**When to Use**: Stuck for >15 minutes. Going in circles. "I've tried everything."

**Steps**:

1. State what the code is SUPPOSED to do, step by step
2. State what it ACTUALLY does, step by step
3. At each step, verify: does reality match expectation?
4. The step where your explanation falters is where the bug lives

**Exit Condition**: You find the gap between your mental model and reality.

**Anti-pattern**: Skipping the "what it actually does" part and only describing
intent. The value is in forcing yourself to verify each assumption.

---

## Systematic Logging

Strategic placement of structured logs at system boundaries to trace data flow.

**When to Use**: Multi-layer systems. Bugs that only appear in production or
under specific conditions. When you cannot attach a debugger.

**Steps**:

1. Identify all component boundaries the data crosses
2. At each boundary, log: input, output, timing, error context
3. Use structured format (JSON or tagged) so logs are filterable
4. Run the failing scenario once
5. Read logs to identify the boundary where data becomes incorrect

**Template — what to log at each boundary**:

```
[timestamp] [component] [operation]
  INPUT:   {the data entering this layer}
  OUTPUT:  {the data leaving this layer}
  TIMING:  {duration in ms}
  CONTEXT: {request-id, user-id, environment}
  ERROR:   {if applicable: message + stack}
```

**Exit Condition**: You identify the exact boundary where correct input
produces incorrect output.

**Anti-pattern**: Logging everything (noise drowns signal). Log at boundaries
only, not inside tight loops. Remove diagnostic logging after the bug is fixed.
