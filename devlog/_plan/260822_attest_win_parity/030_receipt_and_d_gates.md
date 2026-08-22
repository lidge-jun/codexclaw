# 030 - issue #49: two gates that fought legitimate work

Both halves share a shape: a rule written to prevent forgery ended up forcing it.

## 1. `receipt test` refused a validator that rebuilds its own artifacts

```
검증 통과
graph.json 생성 — {nodes: 100, ...}
receipt test: the command changed the source while running (working tree went dirty);
no receipt written — a check cannot certify a tree it rewrote
```

`validate.py --build` IS the documented ontology gate for that repo. It rewrites
`graph.json` by design. The receipt runner treated that as contamination.

The reported workaround is the damning part: commit the generated files, then run
`cxc receipt test -- test -f ...` — a no-op existence check. That produces a
receipt that certifies nothing. **A forged receipt is strictly worse than a loose
one**, because it satisfies CHECK-BINDING-01 while proving less than no receipt
at all.

### Fix: declared, never inferred

```
cxc receipt test --session <id> --generated build -- node validate.mjs
```

`--generated` is repeatable and takes a repo-relative path; a path covers that
file or that directory. Anything NOT declared is still refused, so the escape
hatch cannot be widened by accident:

| scenario | result |
|---|---|
| declared path rewritten | receipt written |
| undeclared path rewritten | still refused |
| wrong path declared, real file rewritten | still refused |
| `build/graph.json` declared, `build/other.json` written | still refused |

The refusal message now names the flag, so the next agent finds the sanctioned
route instead of inventing the `test -f` trick. The receipt records
`generatedPaths`, so a reader can see exactly which rewrites were permitted.

Verified end to end on a throwaway git repo whose validator rewrites its own
output: refused without the flag, receipt written with it, still refused when the
wrong path is declared.

## 2. `orchestrate D` refused a goalplan that was already finished

```
the bound goalplan "<slug>" has no active work-phase to close (CYCLE-COMPLETION-01).
```

`advanceWorkPhase` returns `no_active` for two very different situations, and the
gate treated them the same:

- the plan is EMPTY, or everything is blocked — a real refusal
- every work-phase is `done` — the plan is **complete**

The reported workaround was to write a finished phase back to `in_progress` just
to get past the gate. That is corrupting the record in order to satisfy a check
about the record.

D now closes when every work-phase is done, and the refusal names which of the
two real causes applies:

```
... has no work-phase to close: the plan is empty — register workPhases[] first
... has no work-phase to close: every remaining work-phase is blocked or superseded
```

The goalplan ledger says `cycle closed over an already-complete plan` rather than
`closed null`.

## 3. SOURCE-DELTA-01, documented rather than changed

The issue also asks that a B-phase commit count as B work. It already does — I
hit `the source is unchanged since B began` twice in this session, and both times
the cause was real: I had entered B and then tried to leave it without touching
the tree, because the work had happened in an earlier cycle.

The rule is correct. What was missing is that the message does not say what
counts. Left as-is here rather than loosened; a gate that occasionally annoys is
better than one that lets an empty B through.
