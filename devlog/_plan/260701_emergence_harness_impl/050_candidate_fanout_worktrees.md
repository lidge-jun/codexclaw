# 050 — Candidate Build Fan-Out (Worktrees) + D Race

Status: PLANNED (no code yet) · 2026-07-01 · emergence_harness_impl WP 050 · class C2 (skill doctrine + ledger) · E7 + E2 ledger

> Design source: `../260701_emergence_harness/004` (A+B parallel), `007` (late collapse). The
> worktree isolation pattern already exists in jawcode `team`; this decade is its codexclaw,
> no-server doctrine — not a server-side population manager.

## Why

Late collapse (maximize-unclear) needs N candidates built in isolation and raced on the same
judge. No worktree fan-out doctrine exists in codexclaw. Without isolation, two candidate builds
stomp the same tree; without a defined D race, there is no rule for keep-vs-discard when the
metric does (or does not) separate them.

## Ground Truth (read before edit)

- jawcode `team` worktree isolation pattern (reference only — do NOT copy paths; translate).
- `request_user_input` is DENIED under an active goal: `goal-gate.ts:38` + `:92`. So the human
  gate at D fires only AFTER the goal is paused/closed, or the loop records an autonomous note.
- Decade 045 `evaluate.sh` — the single judge every candidate runs through at C.
- Decade 010 metric ledger — D keeps the metric-best, records the rest.
- AGENTS.md worktree model (NYPC repo): `.worktrees/<name>` on `exp/*` branches, gitignored.

## Design (diff-level)

1. 050.1 — doctrine: late-collapse B builds each candidate in its OWN worktree (reuse the `team`
   isolation pattern, no server); C runs each candidate through the SAME `evaluate.sh` (045).
2. 050.2 — D race: keep the metric-best candidate, discard (revert) the rest. Human gate when the
   metric cannot separate candidates OR none beats baseline. NOTE: `request_user_input` is denied
   under an active goal — so the human gate fires only AFTER the goal is paused/closed, OR the
   loop records an autonomous "kept candidate + unresolved tie" note for later human review. It
   must NOT claim an in-goal `request_user_input`.
3. 050.3 — worktree budget rule: max concurrent / sequential candidates per work-phase (each
   candidate is a full build; keep N small, 2-3, per the 030 doctrine).

## Invariants

- Each candidate isolated in its own worktree; no shared-tree contention.
- Same judge for all candidates (045's `evaluate.sh`) — comparable metrics only.
- No in-goal `request_user_input`; ties recorded autonomously or gated after goal pause.
- No-server: worktrees + ledger, no background manager. Discarded candidates reverted.

## Acceptance

| Check | Evidence |
|-------|----------|
| Isolated builds | doctrine puts each candidate in its own worktree |
| Same-judge race | C runs all candidates through one `evaluate.sh` |
| D keeps best | metric-best kept; rest reverted; tie recorded |
| No in-goal ask | tie handling records a note, never an in-goal request_user_input |
| Budget bounded | max concurrent/sequential candidates stated |

## Verification

- doc-sync: `cxc-loop` states fan-out + D race + budget, consistent with no-server + goal-gate.
- `npm run build` ; `npm test` ; `npm run gate` ; `git diff --check`.

## PABCD plan (one full cycle, FUTURE loop)

- P: lock the worktree budget + the D tie-handling wording (autonomous note vs post-pause gate).
- A: gpt-5.4 explorer — does any path claim an in-goal `request_user_input` (collision with
  `goal-gate.ts:38`)? are discarded candidates actually reverted? is the same-judge invariant explicit?
- B: write the fan-out + race + budget doctrine.
- C: build + doc-sync + gate.
- D: close, commit `feat(emergence-050): worktree candidate fan-out + D race`, `goal update`.

## Open Q

cheap-screen (a stub `evaluate.sh`) before the full build — required always, or only when N>2?

## Depends on / feeds

Depends on 030 (divergence doctrine authorizes the fan-out) + 045 (harness exists before any
build). Feeds 060 (the overfitting guard reads the same race results) and 070 (falsifiability).
