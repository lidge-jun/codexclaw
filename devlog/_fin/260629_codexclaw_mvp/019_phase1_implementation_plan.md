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
  - `writeState(cwd, State): void`  (atomic write to `.codexclaw/sessions/<sessionId>.json`; per-session, see 016)
  - `appendLedger(cwd, {ts,from,to,reason,evidence}): void` (→ `.codexclaw/ledger.jsonl`)
- Accept: unit tests for default/corrupt/roundtrip; pure where possible.

### T-022b — FSM predicates  (→ 022.1)
- File: `components/pabcd-state/src/fsm.ts`
- API: `canEnter(from,to,state): {ok:boolean; reason?:string}`; `nextPhase(state): Phase|null`;
  gates `isAuditGateOpen/isBuildGateOpen/isDone`.
- Accept: table-driven tests for every legal/illegal transition incl. I→P only after interview flag.

### T-022c — directive injection  (→ 022, 022.2; A3 per 019.2)
- File: `components/pabcd-state/src/directives.ts` + `codex-hook.ts`
- Behavior: UserPromptSubmit → detect EXPLICIT IPABCD/interview triggers only; if triggered and not
  already injected this transcript → emit `{hookSpecificOutput:{additionalContext: <phase directive>}}`.
  Idempotent (skip if present / post-compact). Reference omo `ulw-loop/src/codex-hook.ts`.
- NOTE (A3): goal-active is NOT in the hook payload, so the hook does NOT branch on goal mode.
  Goal-mode interview suppression is carried by the advisory `ipabcd` skill rule + codex-native
  goals.rs continuation suppression. The hook stays conservative (injects only on explicit trigger).
- Accept: explicit trigger → one injection; repeat prompt → none; no trigger → none.

### T-023 — goal gate  (→ 023, 022.3; SPLIT per 019.2)
- File: `components/goal-gate/src/gate.ts`
- PHASE 1 (ships): `applyCreateGoalBudgetGuard(payload)`: PreToolUse + tool==create_goal +
  token_budget present → deny w/ unlimited-goal reason (omo parity, stateless).
- Hooks json: matcher `^create_goal$`.
- DEFERRED (post-Phase1, A3/Q-GM-1-followup): `applyInterviewInGoalGuard` (PreToolUse +
  request_user_input + goalActive → deny). Needs thread-store goal-read; NOT shipped Phase 1.
  Phase 1 "no interview in goal mode" = advisory `ipabcd` text + codex-native goals.rs suppression.
- Accept: unit tests for budget deny path + passthrough; pure guard fn.

### T-024 — port ALL 13 dev-* router skills  (→ 024, 024.1, 024.2)
- Convert ALL 13 cli-jaw dev skills (`/Users/jun/.cli-jaw-3459/skills/dev*`) per 024 rules. They are
  subagent ROUTER roles (dev = always-on universal discipline; surface dev-* referenced by role).
- Recipe anchor: convert `dev-debugging` first end-to-end (024.1) to lock the recipe, then bulk-port
  the remaining 12 with the same diff. This is build sequencing, NOT a reduced deliverable.
- Frontmatter = name/description("MUST USE…")/metadata.short-description ONLY.
- Optional `openai.yaml` with interface + `policy.allow_implicit_invocation`.
- Strip cli-jaw plumbing; port any orchestrate/worker refs per 015.1 table. Keep universal discipline.
- Accept: ALL 13 validate vs codex schema; each routes on a representative surface prompt; zero
  cli-jaw paths; B-opt2 subagent inline instructions reference the matching dev-* router(s).

### T-025 — agent roles  (→ 025, 015.1; B-opt2 per 019.2)
- PHASE 1 = B-opt2 (inline): spawn subagents WITHOUT a registered role; pass full role/specialty
  instructions INLINE in `spawn_agent({message:"TASK: ... SCOPE/DELIVERABLE/VERIFY"})` (omo pattern).
  Zero dependency on plugin role discovery (Q-PORT-1b unproven).
- `agents/{explorer,reviewer,executor}.toml` = enriched to codex AgentRoleConfig shape and used as
  the SOURCE of those inline prompts (and future role files via B-opt1 once pickup is confirmed).
- Accept: `spawn_agent` with explorer/reviewer/executor inline prompt runs on default model and
  honors its scope; toml prompt-source matches injected text.

### T-028.1 — install/activation  (→ 028.1, 027)
- `codexclaw enable`: backup config.toml; `codex features enable multi_agent goals hooks default_mode_request_user_input` (only if not already true); verify via `codex features list`.
- `codexclaw uninstall`: revert exactly those flags.
- Accept: 027 guard test (only declared flags change; backup made; uninstall restores).

### T-070 — build aggregation  (→ 070)
- `scripts/build.mjs`: tsc each component → dist; copy/aggregate skills/hooks/agents into plugin
  root; emit plugin.json hooks list matching produced files.
- Accept: reproducible build; validator clean except known `hooks` false-positive.

## Phase 1 done = 029 gate (S1–S5) all green.

## Mini-A targets — RESOLVED in 019.2
- Finding A (goal-active not in hook payload) → A3 hybrid: advisory+native Phase 1; hard deny
  deferred (Q-GM-1-followup). T-023 interview-deny removed from Phase 1; T-022c goal-mode skip uses
  advisory rule (no payload field needed for the conservative no-inject default).
- Finding B (role pickup) → B-opt2 inline roles; T-025 no longer blocked on Q-PORT-1.
- Non-blocking opens: Q-GM-1-followup (thread-store read), Q-PORT-1b (plugin role discovery).
