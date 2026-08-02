# 002 — Refuted hypotheses

Recorded so they are not resurrected in a later cycle. Each was believed, tested,
and killed by specific evidence.

## R1. "The dead `QUESTION_SHAPE_DIRECTIVE` is the cause" — REFUTED

`QUESTION_SHAPE_DIRECTIVE` (`hook.ts:346`) is genuinely dead: `rg` finds it only
in `test/hook-continuation.test.ts:247-252`, never in an emission path.

But wiring it changes nothing, because its content is already injected verbatim:

```
hook.ts:220-221  "use request_user_input with background + 2-3 concrete options
                  (recommendation FIRST) + one impact/tradeoff sentence per option."
```

The live directive and the dead constant say the same thing. A constant that
duplicates shipped text cannot explain a behavior the shipped text failed to
produce.

## R2. "Questions always arrive in batches of three" — REFUTED

Questions-per-turn histogram over all 222 recorded questions:

```
{1: 22, 2: 12, 3: 18, 4: 3, 5: 3, 6: 7, 7: 2, 9: 2, 21: 1}
```

Single-question turns are the most common bucket. "Always 3" is not the pattern,
so a count cap would regulate a variable that is not the defect. The user
subsequently confirmed the rule they actually want is **independence, not count**
("1-n개 별로 다시 생각할 필요없다면 10개도 가능"), which is what `jwc` already
encodes.

## R3. "Run the fix as a parallel spike" — REFUTED

Two problems:

1. The option was an artifact of codexclaw's own injected prompt. `hook.ts:219-220`
   literally instructs the model to "offer BOTH (parallel spike, select by
   evidence)". The interview surfaced the option it was told to surface. That is
   not evidence a race is warranted.
2. Both arms mutate the same observable — model-authored question text — in the
   same session, so neither lane's result is attributable. `DIVERGE-TIER-01`
   requires isolated worktrees and a shared `evaluate.sh`; neither is available
   here.

This work is `spec-satisfaction` (a verifier defines done), so `LOOP-ARCHETYPE-01`
says keep ONE strategy and collapse at P.

## R4. "`isInterviewReady` fails only because no writer exists" — PARTLY WRONG

A writer is indeed missing, but readiness is *also* unreachable by design:

```ts
// interview.ts:263
if (!Array.isArray(tracker.contradictions) || tracker.contradictions.length > 0) return false;
```

Readiness requires an empty contradiction array while the I-phase mandates
continuous contradiction scanning. Any interview that finds something can never
be ready. Two override paths already exist
(`orchestrate-apply.ts:121-131`, `orchestrate-cli.ts:293-309`), so this costs an
override line rather than question quality — it is **out of scope** for this unit.

## R5. "`selectMinds` needs to be made adaptive" — UNNECESSARY

`selectMinds` already ranks by lowest dimension level. It degrades to canonical
order only through its null-guard when `dimensions` is unwritten. Fixing the
input (phase 2) fixes the routing; the scorer needs no change.

## R6. "Delete the dead interview fields" — MOSTLY REJECTED

- `triage.ts`: `structure/30_contradiction_register.md:77` explicitly records it
  as *reachable-via-directive, deliberately not hook-invoked*. Deleting it would
  contradict a documented decision.
- `lastScanRoundId`: actively written, tested (`test/scan-cli.test.ts:98,115`),
  and documented. Removal touches the frozen L8 schema plus 5+ tests — larger
  than the fix it would accompany.
- `consecutiveAutoResolves`: live input to `triage.ts`. Only `autoResolveCount`
  is genuinely never read, and it is not worth a frozen-schema change alone.

## R7. "The frozen schema blocks a dimension writer" — FALSE

`computePlanHash` (`freeze.ts:50-56`) hashes plan-file sha256s only.
`evidenceBundle` (which carries `dimensions`) sits beside it and is never hashed.
Filling the existing fields with a writer requires no shape change at all.
