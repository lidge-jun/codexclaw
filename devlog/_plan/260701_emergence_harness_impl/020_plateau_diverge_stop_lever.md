# 020 — Plateau->Diverge Stop Lever (the one true E2)

Status: PLANNED (no code yet) · 2026-07-01 · emergence_harness_impl WP 020 · class C3 (hook/runtime) · **E2**

> Design source: `../260701_emergence_harness/005` L3 + `006` (plateau switch). Diagnosis register:
> `50_emergence_gap.md` root cause #1/#3. This is the SINGLE genuine runtime lever in the whole
> track — a Stop block the runtime can force. Everything else is doctrine (E7) or tests (E8).

## Why

The only stagnation signal today is `MAX_STOP_BLOCKS` (`hook.ts:396`, a turn-count cap), not
objective non-improvement. `handleStop` (`hook.ts:429`) blocks/releases purely on
`stopBlockCount` (`hook.ts:451-457`). So a session whose true metric has been flat for many
turns keeps grinding the same approach until the turn cap releases it — it never steps back to
diverge. This decade makes a flat true metric arm a "diverge / step-back / re-plan" directive.

## Ground Truth (read before edit)

- `handleStop`: `hook.ts:429` — the function to extend; current block/release logic at
  `hook.ts:451-457`; `MAX_STOP_BLOCKS = 3` at `hook.ts:396`.
- Goal-mode Interview suppression: `hook.ts:254` (I directive suppressed under goal) and the
  Stop-loop-is-PABCD-only guard around `hook.ts:435-440`. CONSEQUENCE: the in-goal directive
  must be "diverge / step-back / re-PLAN" — NOT re-interview.
- `request_user_input` is DENIED under an active goal: `goal-gate.ts:38` (deny reason) +
  `goal-gate.ts:92` (`permissionDecision:"deny"`). So 020 must not emit an interview/ask directive.
- Metric history source: decade 010. Objective-kind gate: decade 015.

## Design (diff-level)

1. 020.1 — in `handleStop`, when objective-kind (015) is `maximize` AND the last N recorded
   metrics (010) show no improvement above a noise floor, inject a "diverge / step-back / re-PLAN"
   directive instead of a plain continuation block. Keep the `MAX_STOP_BLOCKS` cap as the safety
   floor so the loop still can never trap.
   - re-interview is FORBIDDEN under an active goal (`hook.ts:254`, `goal-gate.ts:38`). The in-goal
     directive is re-PLAN only. True re-interview requires pausing/closing the goal first — state
     that in the directive; do NOT emit an interview/ask directive mid-goal.
2. 020.2 — threshold config: `N` (default 2, matching "after 2 non-improving submissions") + a
   noise floor so within-noise deltas count as flat.
3. 020.3 — satisfy-spec goals never arm (no metric -> the branch is unreachable), so ordinary
   build work is untouched.

## Invariants

- FAIL-OPEN: any IO/parse error -> fall back to the existing turn-count behavior; never trap.
- Bounded: the `MAX_STOP_BLOCKS` cap still releases regardless of the metric branch.
- maximize-only: a satisfy goal (no metric) can never arm the diverge directive.
- No re-interview / no `request_user_input` under an active goal — re-PLAN wording only.

## Acceptance

| Check | Evidence |
|-------|----------|
| Flat metric arms diverge | N flat recorded metrics -> diverge/re-PLAN directive |
| Improving metric does not | an improving last delta -> normal continuation |
| satisfy never arms | no metric present -> turn-count behavior only |
| Cap still releases | attempts at MAX_STOP_BLOCKS -> release, never infinite |
| No interview mid-goal | directive contains no `request_user_input` / I-phase ask |
| Fail-open | malformed metric file -> existing behavior, no throw |

## Verification

- `node --test` extending the Stop-hook tests: flat-arms / improving-no-arm / satisfy-no-arm /
  cap-release / fail-open.
- `npm run build` ; `npm test` ; `npm run gate` ; `git diff --check`.

## PABCD plan (one full cycle, FUTURE loop)

- P: lock `N` default + noise floor; confirm re-PLAN-only wording under goal.
- A: gpt-5.4 explorer — does the branch ever emit an ask under an active goal (collision with
  `goal-gate.ts:38`)? is fail-open preserved on every path? can satisfy goals accidentally arm?
  does the cap still bound the loop?
- B: implement the metric-delta branch in `handleStop` + threshold config + tests.
- C: build + unit + gate; capture tails.
- D: close, commit `feat(emergence-020): plateau->diverge Stop lever (E2)`, `goal update`.

## Open Q

arm-divergence threshold vs force-re-diverge threshold — same `N` or different?

## Depends on / feeds

Depends on 010 (metric history) AND 015 (objective-kind, to gate maximize). Feeds 030 (the
doctrine that consumes this E2 signal) and 050 (the race the diverge directive ultimately triggers).
