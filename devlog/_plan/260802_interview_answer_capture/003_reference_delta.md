# 003 — What gjc/jwc do differently

Sources (read-only reference, `/Users/jun/developer/new/700_projects/jawcode`):

- `devlog/_gjc_chase/gajae-code/packages/coding-agent/src/defaults/gjc/skills/deep-interview/SKILL.md` (950 lines)
- `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md` (985 lines)

## The structural difference

gjc and jwc persist a per-round state document and **read it back** to compute the
next question. codexclaw ported the vocabulary of that loop without the write path.

| Concern | gjc / jwc | codexclaw today |
|---------|-----------|-----------------|
| Answer persistence | every round appended to `state.rounds[]` | `answer_recorded` never emitted (E2) |
| Per-dimension scores | scored every round, displayed to the user | fields exist, no writer (E3) |
| Weakest-dimension targeting | computed, named aloud, with the gap | rule exists, input never computed (E4) |
| Component scoping | `topology.components[]` with per-component scores | no topology entity at all |
| Repo grounding | must cite the file/symbol that triggered the question | one clause: "Research the repo first" |
| Question count | gjc: exactly 1. jwc: 1-3, independent only | no rule |
| Round header | jwc `meta` HUD: round/component/targeting/whyNow/ambiguity | none |

## What is portable, and what is not

**Portable now.** The independence rule (jwc already frames it as "bundle only
INDEPENDENT questions — never batch questions where one answer changes another",
which matches the user's own stated preference), and the repo-citation
requirement.

**Portable after phase 2.** Weakest-dimension surfacing. It is meaningless until
dimensions are actually written, which is exactly why the rule currently sits in
`SKILL.md` doing nothing.

**Not portable as-is.** jwc's `meta`/HUD header renders from jwc's own CLI
surface. codexclaw's hook output is a single capped `additionalContext` string
(`hook.ts:451-455`), so there is no render target. The equivalent must be a
main-session-authored status block, not a runtime-forced HUD.

**Not achievable by directive text.** "gjc만큼 상세하게" cannot be reached through
injection: gjc's skill is 950 lines / 80KB while injected context is hard-capped
and truncated. Depth has to come from persisted state that survives across turns,
not from a longer prompt. This is the strongest argument for phases 1 and 2 being
the real fix and phase 3 being cosmetic.

## The one-line summary

gjc's questions are specific because they are **derived from accumulated gaps**,
not because its prompt is long. codexclaw cannot derive anything until answers
are captured.
