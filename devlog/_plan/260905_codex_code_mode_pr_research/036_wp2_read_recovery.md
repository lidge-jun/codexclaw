# WP2 incomplete-read recovery: root cause and bounded repair

Status: B repair, not acceptance. Same reviewer Bacon returned FAIL for both
c2-neutral001 variants after fully reconstructing model-visible output.

## Failure delta and main decision

ACCEPT: candidate parent rollout24 truncates3,750 tokens. Later rows28/32 recover
all dev-testing but leave security lines267,269–281,283 absent before implementation
at35. Baseline parent22 truncates2,186 tokens; backend gaps remain unrecovered and
security/testing owners are absent. Both independently pass the original8-case
program oracle, with only allowed3files and no delegation, but this does not
satisfy complete instruction application.

CHECK is actually absent from both neutral developer contexts; no delegation is
observed. This control does not replace the original Korean C2 CHECK conflict.
Language and trigger phrase changed together, so no isolated hook-effect estimate.

The candidate did react to truncation. The remaining mechanism failure is guessed
missing ranges: recovery read320–450 then285–330 missed267–283. More generic
"read completely" text without an unambiguous recovery operation already failed.
No broader source rewrite, production hook or special probe instruction is needed
to test this narrower hypothesis. Required security text must not be dropped to
improve timing. Main accepts the finding before changing the candidate.

The same reviewer passed the narrow plan and static fold-back:314 bytes exactly
once in each intended SKILL, no prior content removed and no hook/runtime edits.
Fresh remote wp2-suite-recovery.log reports118/0/no skips; gate0 and inventory0.
These are static/regression results only; native recovery behavior remains pending.

## Exact proposed delta, before implementation

Only dev/SKILL.md and loop/SKILL.md complete-read guidance changes at the existing
read selection seam. Append this same operational clarification in both locations:

```text
If a selected file's output is truncated, re-read that file separately. Do not
guess missing ranges from an elision marker. If it cannot fit one result, use
numbered, contiguous, non-overlapping chunks through EOF and verify no gaps.
Keep both nested and outer output budgets large enough for each returned chunk.
```

This preserves conditional selection and whole-file scope: it does not request
all references, change C0/C1 exceptions or implement a new loader. There is no
requirement to replay an already complete file. The duplicate four-line operational
affordance reaches ordinary development and loop-only users, while the existing
complete-read obligation remains canonical in the host/development instructions.

Verify the118 remote regression selection, gate/inventory and a fresh candidate
c2-neutral run with unchanged prompt and independent oracle. Baseline comparison
remains separate, and no old failure is removed. Same reviewer reconstructs full
model-visible coverage; command success alone is insufficient. A repeated failure
returns to measured source/owner modularization design, not a stronger hook.

## Fresh native recovery result

Candidate d8c63f0 c2-neutral002 completed with unchanged prompt, exact Astra/high/
priority on8 recorded requests and no delegation. Same-reviewer behavioral PASS:
outer rollout24 still truncates9,970 tokens, but separate file reads and expanded
outer budget fully deliver testing, matrix, reviewer and security at28. No missing
lines remain before RED31–32 and first implementation34. This is successful
recovery, not a claim that truncation never occurred.

Original8 tests go RED then8PASS/0FAIL/0skip in the model's recorded execution.
Main independently reran the unchanged oracle and checked read-only files against
the original fixture, allowed3paths and commit count1. Reviewer verified11 raw
artifact hashes and actual CHECK absence/IDLE state. Operator elapsed112,511ms,
CLI input311,470 including cached260,992; no performance win is inferred from
comparison with incomplete baseline/earlier failed candidates.

Raw run: wp2-candidate-c2-neutral-002 under the existing remote experiment root.
The original Korean C2 CHECK/no-delegation failure, shared-family request limitation,
broader repeated cost tests and integrated HOTL remain open in their downstream
owners. This result resolves only the targeted complete-read recovery fixture.
