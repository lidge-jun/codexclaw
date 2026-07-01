# L2 (Decade 020) -- Directive-Injection Hook

Status: DONE
Cluster: 1 - Phase: 1 - Shorthand: cxc
Source-of-record: 018.2_pass2_P_plan.md; 018.3_state_transition_injection.md; STATUS.md

## Goal (one slice)
Ship the Codex `UserPromptSubmit` hook logic that injects IPABCD directives as additional context,
with passive `Stop` wiring and no runtime phase auto-advance.

## Why now / dependencies
L2 depends on L1 state files for per-session idempotency. It unblocks L3 because the later goal gate
shares the same component CLI, and it unblocks L7 because the compiled hook artifact is one Phase 1
verification surface.

## Scope (decision-complete)
- Files added/edited:
  - `plugins/codexclaw/components/pabcd-state/src/parse.ts`
  - `plugins/codexclaw/components/pabcd-state/src/hook.ts`
  - `plugins/codexclaw/components/pabcd-state/src/cli.ts`
  - `plugins/codexclaw/components/pabcd-state/src/state.ts`
  - `plugins/codexclaw/components/pabcd-state/test/hook.test.ts`
  - `plugins/codexclaw/components/pabcd-state/test/state.test.ts`
- Input parsing is defensive and snake_case:
  - `parseUserPromptSubmit(raw)`
  - `parseStop(raw)`
- Output envelope matches the Codex/omo hook contract:
  - `hookSpecificOutput.hookEventName`
  - `hookSpecificOutput.additionalContext`
  - trailing newline on emitted JSON
- Directive trigger coverage:
  - `interview` / `orchestrate i` / Korean interview trigger -> `I`
  - `orchestrate p` / `plan this` / Korean plan trigger -> `P`
  - `orchestrate a` / `audit this` / Korean audit trigger with strong action marker -> `A`
  - `orchestrate b` / `build this` / Korean build trigger -> `B`
  - `orchestrate c` / `check this` / Korean check trigger -> `C`
- Hybrid injection from 018.3:
  - explicit trigger activates orchestration and injects full directive.
  - active phase diff injects full directive for the current phase.
  - active same phase injects a short per-turn stage header.
- State additions:
  - `injectedTurns: string[]`
  - `lastInjectedPhase: Phase | null`
  - `orchestrationActive: boolean`
- Must-NOT-Have:
  - No goal-mode branch.
  - No `Stop` mutation.
  - No ledger write from `Stop`.
  - No injection in fresh sessions without an explicit trigger.

## IPABCD micro-cycle
- I (if interview-bearing): explicit interview prompts are detected and inject the `I` directive; the
  full request_user_input interview loop remains out of scope.
- P: planned UserPromptSubmit-only injection after confirming `Stop` has no additionalContext channel.
- A: audit found the bare Korean audit-word false positive and the fail-open default `I` injection risk;
  both were fixed.
- B: implemented parse guards, hook envelope builder, trigger detection, same-turn idempotency, bounded
  `injectedTurns` cap of 50, and fail-closed `orchestrationActive`.
- C: Pass 2 reached `node --test` 34/34 after the Korean thanks regression fix; later Phase 1 totals
  reached pabcd-state 52/52 and total `npm test` 73/73.
- D: done = directive injection was deterministic, idempotent, and passive on Stop.

## Acceptance (1-3 testable criteria)
- Same `(session_id, turn_id)` injects once; a new turn can inject again.
- Non-trigger prompts, including ordinary Korean thanks forms, emit no output.
- `Stop` always returns empty output and does not create or append a ledger.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- `node --test` in pabcd-state at Pass 2: 34/34 pass after blocker fix.
- Compiled L7 smoke: `pabcd-state/dist/cli.js hook user-prompt-submit` emits additionalContext and
  writes `orchestrationActive:true` plus `lastInjectedPhase:"I"`.
- Final Phase 1 regression: root `npm test` 73/73.

## Commit unit (one atomic conventional commit)
One hook commit: add parser, directive injection, passive stop branch, CLI dispatch, and hook tests.

## Blocked-on (jun decision id, if any)
None for Phase 1. Runtime FSM self-transition remains a later loop, not a blocker for this slice.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- `devlog/_plan/260629_codexclaw_mvp/018.2_pass2_P_plan.md`
- `devlog/_plan/260629_codexclaw_mvp/018.3_state_transition_injection.md`
- `plugins/codexclaw/components/pabcd-state/src/hook.ts`
- `plugins/codexclaw/components/pabcd-state/src/parse.ts`
- codex-rs `hooks/src/schema.rs` UserPromptSubmit and Stop output shapes.
- omo `rules/src/hook-output.ts` envelope parity.
