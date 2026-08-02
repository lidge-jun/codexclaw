# 030 — Phase 3: interview directive discipline

Work-phase `wp4`. Gated: land this ONLY with a concrete delta. Adding text that
restates shipped rules is the failure mode `002_refuted.md` R1 documents.

## The gate

Before editing anything here, check each candidate rule against the live
directive at `hook.ts:210-222` and `skills/interview/SKILL.md`. If the rule is
already stated, adding it again is a no-op. Three deltas survive that check.

## Delta 1 — question independence replaces the implicit count rule

Today `SKILL.md:31` says "Ask one focused question" while `:99` offers "Ask 2-3
more questions", and the injected directive says nothing about count. Three
surfaces, no agreement.

The user's rule, stated directly: *"1-n개 별로 다시 생각할 필요없다면 10개도 가능"*
— independence governs, not a ceiling. `jwc` already encodes exactly this
("bundle only INDEPENDENT questions — never batch questions where one answer
changes another"), so this is adopting a proven formulation, not inventing one.

Amend `SKILL.md` INTERVIEW-Q-01 to state the independence rule and drop the
singular framing. Fix `:99` so the closeout options stop implying a numeric
budget the tracker cannot persist.

Honest limitation to record inline: the host `request_user_input` contract caps a
call at three questions ("Prefer 1 and do not exceed 3"). A round of 10
independent questions is therefore not expressible in one call and must be split.
Document that rather than writing a rule the transport cannot honor.

## Delta 2 — repo-citation becomes a requirement, not a preference

`SKILL.md` currently *prefers* repo-grounded confirmation; the injected directive
compresses it to "Research the repo first, then ask focused questions". gjc makes
it mandatory: cite the file, symbol, or pattern that triggered the question.

Add one clause to `PHASE_DIRECTIVES.I` requiring a brownfield question to name
its triggering evidence. This is the cheapest real defense against the recorded
symptom ("이어서 어느 방향으로 진행할까요?" — a question with no grounding at all).

## Delta 3 — pre-question status render

The user asked for 중간 출력 before the question popup. `renderStatusLine`
(`hook.ts:612-614`) emits only phase and boolean flags — no interview state.

Constraint to respect: hooks can only emit capped `additionalContext` or deny, so
the runtime CANNOT force a render. This must be a directive instruction to the
main session: before calling `request_user_input`, state what is currently known,
which dimension is weakest and why, and what the answer will change. Once phase 2
lands, that block is backed by real persisted scores instead of narration.

## Scope boundary

IN: `components/pabcd-state/src/hook.ts` (`PHASE_DIRECTIVES.I` only),
`plugins/codexclaw/skills/interview/SKILL.md`,
`components/pabcd-state/test/hook-continuation.test.ts`.

OUT: `QUESTION_SHAPE_DIRECTIVE` (leave it alone — see below), the Mind dispatch
directive, any count cap, any numeric ambiguity score.

## On the dead constant

`QUESTION_SHAPE_DIRECTIVE` stays untouched and unwired. Wiring it was refuted; it
duplicates `hook.ts:220-221`. Deleting it would churn
`test/hook-continuation.test.ts:247-252` for no behavioral gain. Record it in the
contradiction register as known-dead-by-decision instead.

## Budget constraint

Injected context is truncated (`hook.ts:451-455`) and already carries
`MIND_DISPATCH_DIRECTIVE`. Each delta above must be one or two lines. gjc parity
by volume is impossible here and is not the goal — see `003_reference_delta.md`.

## Accept criteria

- `c5`: either the three deltas land with tests green, or the phase is recorded
  as NOOP with the refutation evidence that made it unnecessary.

## Risk

Low, but low value if phases 1-2 already restore grounding. Reassess at this
phase's P: if captured answers plus written dimensions already produce specific
questions, delta 3 may be redundant and should be dropped rather than shipped for
completeness.
