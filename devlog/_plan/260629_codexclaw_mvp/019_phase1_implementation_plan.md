# 019 — Phase 1 Implementation Plan (mini-P, jawdev-grade)

Status: PLANNING (mini-P)  ·  Phase 1
Purpose: decompose the 020s into directly-implementable tasks with file paths, signatures, and
acceptance criteria. Grounded in: 021.1 (skill schema), 015.1 (porting/role.rs), 022.2 (IPABCD +
flags), 022.3 (interview/goal rules), 023 (goal gate). Cite codex-rs + lazycodex when building.

## Component layout (final for Phase 1)
```
plugins/codexclaw/
├── components/
│   ├── pabcd-state/        # IPABCD FSM + hooks (UserPromptSubmit, Stop)
│   │   └── src/{cli.ts, state.ts, fsm.ts, directives.ts, codex-hook.ts}
│   ├── goal-gate/          # PreToolUse gate(s): create_goal budget + interview-in-goal deny
│   │   └── src/{cli.ts, gate.ts}
│   └── provider-bridge/    # (Phase 2 mostly; Phase1 = no-op SessionStart presence)
├── skills/
│   ├── ipabcd/SKILL.md (+ references/, openai.yaml)
│   └── dev-*/  (13 ported; pilot dev-debugging first)
├── agents/ {explorer,reviewer,executor}.toml   # codex agent-role format
└── hooks/  (json wired to component dist clis)
```

## Task breakdown (each = atomic, testable)

### T-022a — IPABCD state module  (→ 022, 022.1)
- File: `components/pabcd-state/src/state.ts`
- API:
  - `type Phase = "I"|"P"|"A"|"B"|"C"|"D"`
  - `interface State { phase: Phase; slug: string; updatedAt: string; flags: {interview:boolean; auditPassed:boolean; checkPassed:boolean}; supersededBy: string|null }`
  - `readState(cwd): State`  (missing/corrupt → safe default {phase:"I"...}, never throw)
  - `writeState(cwd, State): void`  (atomic write to `.codexclaw/state.json`)
  - `appendLedger(cwd, {ts,from,to,reason,evidence}): void` (→ `.codexclaw/ledger.jsonl`)
- Accept: unit tests for default/corrupt/roundtrip; pure where possible.

### T-022b — FSM predicates  (→ 022.1)
- File: `components/pabcd-state/src/fsm.ts`
- API: `canEnter(from,to,state): {ok:boolean; reason?:string}`; `nextPhase(state): Phase|null`;
  gates `isAuditGateOpen/isBuildGateOpen/isDone`.
- Accept: table-driven tests for every legal/illegal transition incl. I→P only after interview flag.

### T-022c — directive injection  (→ 022, 022.2)
- File: `components/pabcd-state/src/directives.ts` + `codex-hook.ts`
- Behavior: UserPromptSubmit → detect IPABCD/interview triggers; if not goal-mode and not already
  injected this transcript → emit `{hookSpecificOutput:{additionalContext: <phase directive>}}`.
  Idempotent (skip if present / post-compact). Reference omo `ulw-loop/src/codex-hook.ts`.
- Accept: trigger → one injection; repeat prompt → none; goal-mode → none (per 022.3).

### T-023 — goal gate  (→ 023, 022.3)
- File: `components/goal-gate/src/gate.ts`
- `applyCreateGoalBudgetGuard(payload)`: PreToolUse + tool==create_goal + token_budget present →
  deny w/ unlimited-goal reason (omo parity).
- `applyInterviewInGoalGuard(payload)`: PreToolUse + tool==request_user_input + goalActive → deny
  w/ "no interview in goal mode" reason.
- Hooks json: matchers `^create_goal$` and `^request_user_input$`.
- Accept: unit tests both deny paths + passthrough; goalActive detection per Q-GM-1.

### T-024p — dev-debugging pilot  (→ 024, 024.1, 024.2)
- Convert cli-jaw `/Users/jun/.cli-jaw-3459/skills/dev-debugging/SKILL.md` per 024 rules.
- Frontmatter = name/description("MUST USE…")/metadata.short-description ONLY.
- Optional `openai.yaml` with interface + `policy.allow_implicit_invocation`.
- Strip cli-jaw plumbing; port any orchestrate/worker refs per 015.1 table.
- Accept: validates vs codex schema; routes on a debugging prompt; zero cli-jaw paths.

### T-025 — agent roles  (→ 025, 015.1)
- Enrich `agents/{explorer,reviewer,executor}.toml` to codex AgentRoleConfig shape
  (name, description, model="default" Phase1, developer_instructions).
- Verify pickup location (Q-PORT-1) via role.rs `resolve_role_config`/registry.rs before finalizing.
- Accept: `spawn_agent({agent_type:"explorer"})` runs with its instructions on default model.

### T-028.1 — install/activation  (→ 028.1, 027)
- `codexclaw enable`: backup config.toml; `codex features enable multi_agent goals hooks default_mode_request_user_input` (only if not already true); verify via `codex features list`.
- `codexclaw uninstall`: revert exactly those flags.
- Accept: 027 guard test (only declared flags change; backup made; uninstall restores).

### T-070 — build aggregation  (→ 070)
- `scripts/build.mjs`: tsc each component → dist; copy/aggregate skills/hooks/agents into plugin
  root; emit plugin.json hooks list matching produced files.
- Accept: reproducible build; validator clean except known `hooks` false-positive.

## Phase 1 done = 029 gate (S1–S5) all green.

## Mini-A targets after this P (carry)
- Q-GM-1 goal-active detection in hook payload (blocks T-023 interview-deny + T-022c).
- Q-PORT-1 role file pickup path (blocks T-025).
- request_user_input invocation path from a skill/turn (informs Interview skill).
