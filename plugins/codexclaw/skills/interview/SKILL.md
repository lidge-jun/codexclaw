---
name: cxc-interview
description: "Use for requirements interviews. Triggers: interview, ambiguity, contradiction scan, ask me questions, I phase, 인터뷰."
metadata:
  short-description: "Persistent I-phase clarification with contradiction tracking."
---

# cxc-interview

Use this skill for Interview work within the user's scope. Loading it or receiving
a natural-language I hint does not enter the phase. Actual entry uses an explicit
user command or authorized `cxc orchestrate I --session <id>` with the current
SessionStart binding. No-FSM requests remain advisory without a transition.

## Contract

- Interview questions use synchronous `request_user_input`, subject to the host's
  rules. Do not use `request_user_input_async` or a legacy async variant for
  Interview rounds: this workflow needs returned answers and ledger-backed readiness.
  General mid-work questions follow [Async user questions](../dev/references/async-questions.md).
- The main session owns questions, user answers, tracker updates, and devlog
  records.
- Subagents may search for contradictions and propose question candidates, but
  they do not ask the user directly.
- Ask across four dimensions: Goal, Constraint, Success criteria, Ontology.
- Re-scan contradictions after every user answer.
- Do not advance to Plan while a high contradiction or pending question remains.
- Record medium/low unresolved items as OPEN ASSUMPTIONS before leaving Interview,
  with the provenance fields of INTERVIEW-ASSUME-01.
- When Interview reveals work that will span 2+ PABCD cycles, flag the unit as
  multi-cycle so that the first work-phase enters as a docs-only roadmap cycle
  (LOOP-DOCS-FIRST-01, `cxc-loop`). Interview settles unit residence
  (UNIT-RESIDENCE-01) but does not write decade docs — that is the roadmap
  cycle's job.

## Question quality (INTERVIEW-Q-01)

- Target the weakest dimension first and name why it is the current bottleneck.
- Ask focused questions that expose an ASSUMPTION or boundary — not a feature-list roundup.
  Bundle several only when they are INDEPENDENT: never batch two questions where one
  answer changes the other (INTERVIEW-INDEPENDENT-01). Independence governs, not a count.
  Note the transport limit: `request_user_input` accepts at most three questions per call,
  so a larger independent batch has to be split across calls.
- High-impact `proposed` assumptions (INTERVIEW-ASSUME-01) are candidates for the
  next relevant question round. Low-impact ones may stay `proposed`; closeout lists them.
- Prefer repo-grounded confirmation ("the code does X — is that intended?") over re-asking what
  the codebase already answers.
- Treat every answer as a claim to pressure-test: vague or hedged answers do not raise a
  dimension's readiness; they keep or deepen the gap.

## Show the state before asking (INTERVIEW-RENDER-01)

Emit a short status block immediately before `request_user_input`: what is now known, which
dimension is weakest and why it is the current bottleneck, and what the answer will change.
The runtime cannot force this — hooks only inject text — so it is the main session's job.
Without it a well-grounded question still reads as context-blind, because the user cannot see
the reasoning that produced it.

## Conditional References

| Condition | Reference |
| --- | --- |
| Inferring, deferring or confirming assumptions; handing off to Plan | [Assumption provenance](references/assumption-provenance.md) (INTERVIEW-ASSUME-01) |
| Before another question round or recording readiness evidence | [Ledger grounding](references/ledger-grounding.md) (INTERVIEW-GROUND-01) |
| Vague domain, catalog discovery, configurator or option-set design | [Catalog and configurator](references/catalog-configurator.md) |
| Rescan, loop classification, proceed/pause decision or I → P transition | [Readiness and closeout](references/readiness-closeout.md) |
| Runtime hooks, goal firewall or authorized Mind dispatch | [Runtime status](references/runtime-status.md); before Mind dispatch read [Mind dispatch](references/mind-dispatch.md) completely |
