## Runtime Status (shipped)

The interview runtime is shipped, not planned:

- `PostToolUse` auto-capture for `request_user_input` records each question/answer
  round to `.codexclaw/interviews/<sessionId>.jsonl` (`handlePostToolUse`,
  `captureInterviewAnswers`).
- L18: after each captured answer, the same PostToolUse hook REINJECTS the rescan
  directive as `additionalContext` (`RESCAN_REINJECT_DIRECTIVE`) when the session is
  in an interactive I-phase — so the Mind contradiction rescan fires after every
  answer instead of fading with transcript distance. Under an active/unreadable goal
  it stays silent (capture only, firewall intact).
- The I-phase directive carries the Mind-dispatch contract (`MIND_DISPATCH_DIRECTIVE`),
  so the main session runs the contradiction-rescan loop: select Minds, dispatch
  read-only contradiction lenses, triage (high -> ask the user; low/medium -> recorded
  assumption), then ask the user to proceed or keep interviewing.
- Mind spawn shape (MIND-SPAWN-SHAPE-01): only when Mind dispatch is authorized,
  read [Mind dispatch](mind-dispatch.md) completely before dispatch.
  It preserves read-only lens roles, non-full forks, snapshot and settings contracts
  while adapting argument fields and returned handles to the live native schema.
- Readiness gating requires recorded scan evidence (`scanRounds >= 1`) before I -> P.
- Agent I→P override: when the agent CLI path (`cxc orchestrate P --session <id>
  --attest-file <path>`, carrying
  `{"from":"I","to":"P","did":"<reason>","override":true}`) encounters
  an unready interview tracker, it bypasses the readiness gate — mirroring the
  human chat override in `applyHumanTransition`. The tracker is NOT modified;
  `flags.interview` is pre-flipped at the transition level. The ledger records
  `actor:"agent"`, `override:true`, and a `scanEvidence` snapshot of the
  pre-override gate state. The `did` narrative must be non-empty and non-placeholder.

Goal firewall: the whole Interview is suppressed under an active goal — the explicit
trigger path, the passive re-injection paths (`UserPromptSubmit` modes 2/3), AND the
`Stop` continuation loop all check goal-active and refuse to drive the Interview, and
`request_user_input` is hard-denied. The Interview is HITL-only; `handleStop` releases
immediately at `phase === "I"` (it never blocks/continues an interview, even mid-cycle
under an active goal). The `InterviewTracker` discipline still governs the four
dimensions and OPEN ASSUMPTIONS.
