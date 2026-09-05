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
