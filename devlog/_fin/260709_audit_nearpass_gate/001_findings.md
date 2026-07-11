# 001 — Root-cause findings (investigation record, 260709)

Investigation ran as a read-only gpt-5.5 explorer dispatch plus main-session
spot checks. No fixes here; this doc is the evidence base for `000_plan.md`.

## Problem 1 — A-phase runs exactly one audit round

### RC1: no frontal "loop until pass/near-pass" rule (severity High, confidence High)

- `plugins/codexclaw/skills/pabcd/SKILL.md:131` — the A-phase body ends with
  "Fold fixes back into the plan and record the verdict. No code changes." That
  wording invites the single-round reading: one review -> fold -> record -> B.
- Re-dispatch is only IMPLIED downstream of a FAIL:
  `pabcd/SKILL.md:132` ("When the verdict is FAIL, fold-back follows
  REVIEW-SYNTHESIS-01 (§11.3) ... before re-planning or re-dispatching the
  reviewer"), `skills/loop/SKILL.md` §Repair-loop ("Reviewer reuse across repair
  rounds"). No sentence makes exit conditional on pass/near-pass.

### RC2: the A>B runtime gate checks form only (severity High, confidence High)

- `components/pabcd-state/src/attest.ts:104-111` (pre-change): the `A>B` branch
  checks only that `auditOutput` is non-empty. No verdict semantics, no round
  counter, no blocker-closure evidence. Confirmed by direct read.
- Contrast: `C>D` (attest.ts:112-126) DOES have a semantic check — non-zero
  `exitCode` is rejected. A>B has no equivalent.
- Tests lock the looseness in: `test/attest.test.ts:38` passes
  `reviewer: GO-WITH-FIXES; 2 blockers folded back` as sufficient;
  `test/orchestrate-cli.test.ts:89` advances on `reviewer: GO; refs verified`.
- Mitigating: `src/hook.ts:538` STOP_NEXT_COMMAND.A nudges
  `did:"independent audit PASS; blockers folded into plan"` — example prose
  only, unverified by the gate.

## Problem 2 — audit dispatches miss $cxc-search

### RC1: A-phase dispatch instruction never names it (severity High, confidence High)

- `pabcd/SKILL.md:131` requires the reviewer to "verify references" but the
  dispatch-packet guidance names no search skill.
- `components/pabcd-state/src/hook.ts:165-168` A directive example lists only
  `$cxc-dev-code-reviewer plus the matching $cxc-dev-* surface skill`.

### RC2: SEARCH-ATTACH-01 scope is "search subagents" only (severity Med-High, confidence High)

- `skills/search/SKILL.md:176-179` — "Any search subagent ... should receive
  THIS skill". Nothing extends it to audit/reviewer dispatches.

### RC3: spawn-attach hook inference is keyword-substring only (severity High, confidence High)

- Hook registered: `hooks/pre-tool-use-attaching-skills.json:13`
  (matcher `^spawn_agent$`), always-on.
- `components/subagent-config/src/spawn-attach-hook.ts:129-136` `inferSurfaces`
  attaches the `search` surface only when the literal substring "search" appears
  in the message. A typical audit message ("audit the plan ... verify
  references") never contains it. Confirmed by direct read.
- The role side ALREADY half-works: `inferRole` (spawn-attach-hook.ts:99-103)
  upgrades audit/review-worded spawns to `reviewer`, but
  `ROLE_BASE_SKILLS.reviewer = ["dev", "dev-code-reviewer"]`
  (spawn-wrapper.ts:81-85) carries no `search`. This is the cheapest fix point.

### Why the omission matters

- `skills/dev-code-reviewer/SKILL.md:43-47` requires the ACTIVE search skill for
  dependency-CVE / release-note / provider-behavior verification during review,
  and `skills/dev/SKILL.md:245-248` binds subagents to the same search policy —
  but no shipped path ever delivers the skill to the reviewer.

## Contradiction check

Nothing in the shipped doctrine mandates a re-audit after fold-back when the
verdict was not FAIL, and nothing gates A>B on verdict content. The user's
observation is consistent with the shipped texts and gate: single-round audits
and search-less reviewers are the DEFAULT outcome, not agent disobedience.
