# L10 (Decade 100) -- Question Generator, Auto-Mode, Freeze

Status: FROZEN
Cluster: 1 - IPABCD Interview completion - Phase: 1 - Shorthand: cxc
Source-of-record: 080.2, ouroboros 040, 023.1, elicitation 000_findings

## Goal (one slice)
Ship the main-session question generator, severity triage, auto-mode policy, and
freeze handoff from manual interview into later PABCD or goal execution.

This loop turns L9 contradictions into either user questions or recorded
assumptions, edits the plan directly, and freezes the resulting spec boundary.

## Why now / dependencies
L8 must provide readiness and assumptions. L9 must provide normalized
contradictions with severity and evidence.

L10 unblocks L11 because goal-mode hard-deny must know what a frozen interview
artifact is and what must not be reopened after a goal starts.

## Scope (decision-complete)
- Files to add/edit:
  - `plugins/codexclaw/components/pabcd-state/src/hook.ts`
  - `plugins/codexclaw/components/pabcd-state/src/state.ts`
  - `plugins/codexclaw/components/pabcd-state/src/cli.ts`
  - `plugins/codexclaw/components/pabcd-state/test/hook.test.ts`
  - `plugins/codexclaw/components/pabcd-state/test/state.test.ts`
  - `plugins/codexclaw/components/pabcd-state/test/cli.test.ts`
  - `.codexclaw/plan/` format docs if the component owns local fixtures
- Question UX follows 080.2 M1:
  - Explain the background.
  - Explain why the decision matters.
  - Give two or three concrete options.
  - Put the recommendation first.
  - Include impact/tradeoff per option.
- Loop follows M2:
  - subagent contradictions
  - main question
  - main plan edit
  - main re-question
- Reuse/fresh-eyes follows M3:
  - preserve context where possible
  - force skeptical re-evaluation each round
- Auto-mode:
  - low severity -> recorded assumption
  - medium severity -> recorded assumption by default
  - high severity -> user question
  - after three consecutive auto-resolves, the next contradiction goes to user
- Max-round closure:
  - `safe_default` is the default closure path for safe, reversible gaps.
  - (`ledger_only` removed in Pass 1; non-blocking items become recorded assumptions — see L8.3/L10.2)
  - `genuine-deadlock` blocks only for true human-authority gaps.
- Freeze:
  - plan file under `.codexclaw/plan/` is the canonical spec surface.
  - freeze creates or updates a manifest hash that binds the plan revision.
  - goal start compares the manifest hash to the current plan file.
  - if changed, warn and re-freeze current file before use; stale execution is
    not allowed.
- T5 checklist:
  - represent a pending question or require main-session discipline that refuses
    unrelated free-form answers while waiting.
- T8 checklist:
  - namespace `.codexclaw/plan/` by session or slug, or choose an explicit owner
    lock before supporting concurrent sessions.
- T9 checklist:
  - document mutable-current freeze semantics versus immutable snapshot semantics.
- T10 checklist:
  - high severity cannot be safe-defaulted during manual interview; if forced by
    goal backfill it remains a high-severity assumption requiring user review.
- T11 checklist:
  - `flags.interview` must not be set unless `isInterviewReady()` is true.
- Must-NOT-Have:
  - No subagent questions.
  - No goal-mode interview.
  - No hidden assumptions outside `OPEN ASSUMPTIONS`.
  - No assistant-emitted choice fences as the primary selector.

## IPABCD micro-cycle
- I (if interview-bearing): Main session receives L9 contradictions, asks only
  high-severity or rhythm-guarded questions through `request_user_input`, then
  edits the plan directly from the answer.
- P: Add question template text, severity triage, assumption ledger behavior,
  max-round closure rules, and freeze manifest behavior.
- A: Evaluator checks that options are concrete, assumptions are visible, and
  high-severity user-only decisions cannot be silently auto-filled.
- B: Implement directive and helper behavior, pending-question handling, freeze
  manifest commands or helper functions, and tests.
- C: Run node tests plus a CLI dry-run that shows the freeze hash and
  `OPEN ASSUMPTIONS` content.
- D: Done = every contradiction exits through user resolution or recorded
  assumption, readiness can freeze a spec, and stale plan execution is refused.

## Acceptance (1-3 testable criteria)
1. Low and medium contradictions become recorded assumptions; high contradictions
   produce a user question unless explicitly deferred by goal backfill rules.
2. Freeze records a manifest hash for the current plan and detects mismatch at
   the next goal start.
3. Generated questions include background, recommendation-first options, and
   impact text suitable for `request_user_input`.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- `node --test plugins/codexclaw/components/pabcd-state/test/hook.test.ts`
- `node --test plugins/codexclaw/components/pabcd-state/test/state.test.ts`
- `node --test plugins/codexclaw/components/pabcd-state/test/cli.test.ts`
- CLI stdout: `cxc interview freeze --dry-run` prints manifest path, sha256,
  readiness result, and OPEN ASSUMPTIONS count if this command is introduced.

## Commit unit (one atomic conventional commit)
`feat(interview): add question triage and freeze handoff`

## Blocked-on (jun decision id, if any)
None. This loop is frozen once L9's T4/T7 dispatcher boundary is decided.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- `devlog/_plan/260629_codexclaw_mvp/080.2_interview_ux_and_loop_method.md`
- `devlog/_plan/mvp_res/000_research_src/ouroboros_interview/040_auto_mode_and_direct_edit.md`
- `devlog/_plan/260629_codexclaw_mvp/023.1_interview_ipabcd_prompts.md`
- `devlog/_plan/mvp_res/000_research_src/elicitation/000_findings.md`
- `codex-rs/protocol/src/request_user_input.rs`
- `codex-rs/tui/src/bottom_pane/mcp_server_elicitation.rs`
