---
name: cxc-interview
description: "Use for Codexclaw Interview mode: persistent IPABCD I-phase requirements discovery, contradiction hunting, focused user questions, question/answer evidence recording, and readiness gating before Plan. Triggers: interview, 인터뷰, requirements clarification, ambiguity, contradiction scan, ask me questions, I phase, cxc-interview."
metadata:
  short-description: "Persistent I-phase clarification with contradiction tracking."
---

# cxc-interview

Use this skill to enter or continue Codexclaw's IPABCD Interview phase.

## Contract

- The main session owns questions, user answers, tracker updates, and devlog
  records.
- Subagents may search for contradictions and propose question candidates, but
  they do not ask the user directly.
- Ask across four dimensions: Goal, Constraint, Success criteria, Ontology.
- Re-scan contradictions after every user answer.
- Do not advance to Plan while a high contradiction or pending question remains.
- Record medium/low unresolved items as OPEN ASSUMPTIONS before leaving Interview.

## Question quality (INTERVIEW-Q-01)

- Target the weakest dimension first and name why it is the current bottleneck.
- Ask one focused question that exposes an ASSUMPTION or boundary — not a feature-list roundup.
- Prefer repo-grounded confirmation ("the code does X — is that intended?") over re-asking what
  the codebase already answers.
- Treat every answer as a claim to pressure-test: vague or hedged answers do not raise a
  dimension's readiness; they keep or deepen the gap.

## Rescan + readiness (INTERVIEW-SCAN-01)

- Run a contradiction rescan after every answer, AND one final rescan before any proceed/close
  decision — surface what still remains. (This final rescan is process discipline; the runtime
  does not encode scan recency.)
- Runtime readiness predicate (`isInterviewReady`): all dimensions at `max` + contradictions
  empty + assumptions recorded + `scanRounds >= 1`. Treat readiness as a coverage claim on top of
  that: each dimension has concrete knowns, no unresolved unknown changes scope, and every
  contradiction has exited into an answer or a recorded assumption. Summarize the remaining OPEN
  ASSUMPTIONS before claiming I -> P readiness.

## Closeout fork (INTERVIEW-FORK-01)

In non-goal HITL Interview only (under an active goal the Interview is suppressed and
`request_user_input` is hard-denied — see Goal firewall), after a scan round do not drift forward
silently. Present a numbered choice and let the user pick: `1. Proceed to Plan` ·
`2. Ask 1 more question` · `3. Ask 2-3 more questions` · `4. Record assumptions and pause`.
There is no build/execute path out of Interview — the only forward move is Plan, normally after
the readiness gate passes, unless the human explicitly overrides (override is recorded as an
audit entry). `proceed` means "advance to Plan", not permission to implement; the evolving
plan/devlog stay draft interview artifacts until then.

## Runtime Status (shipped)

The interview runtime is shipped, not planned:

- `PostToolUse` auto-capture for `request_user_input` records each question/answer
  round to `.codexclaw/interviews/<sessionId>.jsonl` (`handlePostToolUse`,
  `captureInterviewAnswers`).
- The I-phase directive carries the Mind-dispatch contract (`MIND_DISPATCH_DIRECTIVE`),
  so the main session runs the contradiction-rescan loop: select Minds, dispatch
  read-only contradiction lenses, triage (high -> ask the user; low/medium -> recorded
  assumption), then ask the user to proceed or keep interviewing.
- Readiness gating requires recorded scan evidence (`scanRounds >= 1`) before I -> P.

Goal firewall: the whole Interview is suppressed under an active goal — the explicit
trigger path, the passive re-injection paths (`UserPromptSubmit` modes 2/3), AND the
`Stop` continuation loop all check goal-active and refuse to drive the Interview, and
`request_user_input` is hard-denied. The Interview is HITL-only; `handleStop` releases
immediately at `phase === "I"` (it never blocks/continues an interview, even mid-cycle
under an active goal). The `InterviewTracker` discipline still governs the four
dimensions and OPEN ASSUMPTIONS.
