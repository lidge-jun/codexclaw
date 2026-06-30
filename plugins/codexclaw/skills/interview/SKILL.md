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
