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

## Runtime Status

L12 provides this discoverable skill surface. The planned runtime recorder lives
in the mvp_hard L13+ track:

- `PostToolUse` auto-capture for `request_user_input`;
- `.codexclaw/interviews/<sessionId>.jsonl` append-only events;
- narrow Stop guard for pending/high Interview work.

Until that runtime lands, the main session records decisions in devlog and uses
the existing bounded `InterviewTracker` discipline.
