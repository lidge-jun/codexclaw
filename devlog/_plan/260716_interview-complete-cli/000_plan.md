# 000 — I→P agent override: Plan

## Objective

Add agent I→P override support to `cxc orchestrate P` so the agent can
transition from Interview to Plan when the interview tracker is not ready,
mirroring the human chat override path. No tracker mutation, no new CLI
commands, no scan evidence fabrication.

Evidence base: session `019f65ff` in ima2-gen panicked for 3+ minutes — the
agent tried `interviewComplete:true` and `override:true` but both were rejected
because the agent CLI path has no override support (only the human chat path
does). The agent fell back to `reset → IDLE → P`, losing the I→P audit trail.

## Loop-spec

- Loop archetype: spec-satisfaction (verifier = tests pass + I→P works)
- Write scope: `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts`,
  `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts`,
  `plugins/codexclaw/skills/interview/SKILL.md`
- Out-of-scope: `fsm.ts`, `interview.ts`, `state.ts`, `orchestrate-apply.ts`
- Budget: single work-phase, C2

## Work-phase map

| WP | Doc | Slice | Depends on |
|----|-----|-------|------------|
| 1 | 010 | orchestrate-cli.ts override + tests + skill doc | none |

## Accept criteria

1. `cxc orchestrate P --session <id> --attest '{"from":"I","to":"P","did":"<reason>","override":true}'` succeeds when phase=I with unready tracker.
2. After override, `readState()` shows phase=P, tracker unchanged.
3. Override records ledger entry with `actor:"agent"`, `override:true`, `scanEvidence`.
4. Override rejects empty/placeholder `did` and mismatched `from`/`to`.
5. Ready tracker proceeds via normal path without override.
6. Existing test suite passes with no regressions.
7. Tracker is never modified by the override.
