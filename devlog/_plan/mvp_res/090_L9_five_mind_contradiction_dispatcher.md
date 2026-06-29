# L9 (Decade 090) -- 5-Mind Contradiction Dispatcher

Status: FROZEN (T4=opt1, T7=opt1 resolved; jun 2026-06-30; impl pending)
Cluster: 1 - IPABCD Interview completion - Phase: 1 - Shorthand: cxc
Source-of-record: 080.1, 080.2, 034.5, ouroboros 030/040

## Resolved (jun 2026-06-30)
- **T4 (loop owner) = Option 1**: main-agent prompt-only loop owner. The hook injects the protocol
  directive; the MAIN session owns question generation, plan/devlog edits, state update, and
  re-question. No separate loop-state API in MVP (matches R-E; least surface). Subagent Minds return
  contradictions ONLY (never ask/edit/call-user).
- **T7 (Mind execution boundary) = Option 1**: main-session-only dispatch. Only the top-level main
  session dispatches Minds; if codexclaw is already running AS a subagent, Mind dispatch is reported
  unavailable (no nested orchestration). Inline no-subagent fallback is NOT the primary path.
- SUB-CLOSE applies: a Mind scheduled for M3 fresh-eyes reuse may stay open between rounds, but is
  closed once its dry-run series converges (INDEX Subagent lifecycle rule).

## Goal (one slice)
Define and implement the 5-Mind contradiction dispatcher that reads the current
interview plan context and returns contradictions only.

The selected Minds are Contrarian, Socratic, Ontologist, Evaluator, and
Simplifier. They are lenses, not user-facing interviewers.

## Why now / dependencies
L8 must exist first because dispatch results need `Contradiction` fields,
dimension names, severity values, bounds, and readiness semantics.

L9 unblocks L10 because question generation and auto-mode need a normalized
contradiction stream. It also supplies the evidence surface used by freeze
review and OPEN ASSUMPTIONS.

## Scope (decision-complete)
- Files to add/edit after unblock:
  - `plugins/codexclaw/components/pabcd-state/src/hook.ts`
  - `plugins/codexclaw/components/pabcd-state/src/state.ts`
  - `plugins/codexclaw/components/pabcd-state/test/hook.test.ts`
  - `plugins/codexclaw/components/pabcd-state/test/state.test.ts`
- Add stable Mind identifiers:
  - `contrarian`
  - `socratic`
  - `ontologist`
  - `evaluator`
  - `simplifier`
- Add fixed prompt specs for MVP. Per 034.5/R-F, do not create first-class
  configurable `mind-*` roles or per-Mind model settings in MVP.
- Output contract:
  - `dimension`: `goal | constraint | success | ontology`
  - `contradiction`: short gap or conflict
  - `severity`: `low | medium | high`
  - `evidence`: file:line, section, or exact source quote
- Subagents must return contradictions only. They must not ask questions, edit
  files, call the user, choose options, or write state.
- Routing:
  - Main chooses Minds adaptively by lowest-scoring dimensions.
  - Simple work may call one Mind.
  - Normal work calls two or three.
  - Large decisions may call more, with a recommended concurrent cap of three.
  - No minimum coverage rule is forced.
- T7 checklist:
  - Define behavior when the main session is itself a subagent.
  - Define whether inline Mind prompts are a fallback or the primary MVP path.
  - Preserve one correlation key per Mind result.
- Must-NOT-Have:
  - No user questions in subagent output.
  - No Phase 2 model catalog dependency.
  - No MCP server.
  - No 9-way fan-out.
  - No plan edits from Mind workers.

## IPABCD micro-cycle
- I (if interview-bearing): Trigger when L8 has an active tracker and at least
  one dimension is below max or the current plan has unresolved assumptions.
- P: Add prompt constants, result validation, Mind routing text, correlation
  envelope, and tests for "contradictions only."
- A: Reviewer acts as Contrarian plus Evaluator, checking that no Mind has
  authority to ask, edit, or call tools.
- B: Implement the dispatcher surface chosen by T4/T7, normalize outputs, reject
  malformed results, and attach evidence to each accepted contradiction.
- C: Run hook/state node tests and a CLI dry-run that prints the selected Mind
  names without editing files.
- D: Done = main can obtain a bounded, evidence-bearing contradiction list from
  selected Minds, and subagents remain read-only contradiction producers.

## Acceptance (1-3 testable criteria)
1. Hook directive or dispatcher code contains all five Mind names and the
   "contradictions only" prohibition.
2. Malformed Mind output is ignored or rejected without marking interview ready.
3. A synthetic run correlates each contradiction to its Mind and keeps all user
   question generation in the main session.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- `node --test plugins/codexclaw/components/pabcd-state/test/hook.test.ts`
- `node --test plugins/codexclaw/components/pabcd-state/test/state.test.ts`
- CLI stdout shape: `cxc interview minds --dry-run` prints selected Mind ids and
  normalized contradictions if that command is introduced.

## Commit unit (one atomic conventional commit)
`feat(interview): add five-mind contradiction dispatcher`

## Blocked-on (jun decision id, if any)
None. T4=Option 1 (main-agent prompt-only owner) and T7=Option 1 (main-session-only dispatch)
RESOLVED by jun 2026-06-30 (see "## Resolved" above). The rejected alternatives (T4 loop-state API,
T7 inline fallback) are out of MVP scope.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- `devlog/_plan/260629_codexclaw_mvp/080.1_interview_contradiction_register.md`
- `devlog/_plan/260629_codexclaw_mvp/080.2_interview_ux_and_loop_method.md`
- `devlog/_plan/260629_codexclaw_mvp/034.5_mind_model_injection.md`
- `devlog/_plan/mvp_res/000_research_src/ouroboros_interview/030_mind_to_subagent_map.md`
- `devlog/_plan/mvp_res/000_research_src/ouroboros_interview/040_auto_mode_and_direct_edit.md`
