# 010 — Objective-Metric State Substrate (E2-ready)

Status: DONE (shipped + tested) · 2026-07-01 · emergence_harness_impl WP 010 · class C3 (state/runtime)

> Design source: `../260701_emergence_harness/001` + `005` L2. Diagnosis register:
> `structure/50_emergence_gap.md` root cause #1 (no objective-delta memory). This is the
> substrate every later decade reads; nothing downstream can plateau-detect without it.

## Why

`State` (`plugins/codexclaw/components/pabcd-state/src/state.ts:17-33`) persists `phase`,
`flags`, `stopBlock{Phase,Count}` only — never a metric. The ledger stores transitions +
evidence strings, never a value. So the loop literally cannot know it plateaued: there is no
number to compare against a prior number. This is the structural reason PABCD only converges.

## Ground Truth (read before edit)

- `State` interface: `state.ts:17-33` (the fields to extend, or sibling ledger to add).
- `LedgerEntry`: `state.ts:35+` (the append-only transition record shape).
- Persistence helpers: `state.ts` `writeState` / `readState` (atomic `renameSync` pattern) and
  `appendLedger`. Reuse, do not reinvent IO.
- `.codexclaw/` layout convention: session state + `ledger.jsonl`. A new `metrics.jsonl` sits
  alongside, project-local under `cwd`.
- CLI dispatcher to extend with a new verb: `plugins/codexclaw/components/pabcd-state/src/cli.ts`.

## Design (diff-level)

1. 010.1 — add an objective-metric record. Chosen shape:
   - a sibling `.codexclaw/metrics.jsonl` append-only log:
     `{ ts, sessionId, workPhaseId, metric_name, value, baseline, best, source }`.
   `source` ∈ `{ "operator-entered", "evaluate.sh" }` (remote judge -> operator-entered, the
   honest limit from the diagnosis). Metric history is independent of transition cadence and
   survives a fresh context as its own file.
2. 010.2 — a `cxc` CLI verb (e.g. `cxc metric record --name <n> --value <v>` / `cxc metric show`)
   to write/read per work-phase: operator types remote scores; a local harness pipes
   `METRIC name=value` (fed automatically by decade 045).
3. 010.3 — `baseline`/`best` math: first recorded value seeds `baseline`; `best` tracks the max
   (maximize) — direction comes from decade 015's objective-kind, defaulting to "higher is better".

## Invariants

- Append-only; never mutate a past metric row (audit trail).
- All state project-local under `.codexclaw/`; no goal-DB access.
- Atomic writes (reuse `state.ts` `renameSync` pattern); partial-write safe.
- Persisted state is NOT itself E2 — this decade is the E2-READY substrate; the lever is 020.

## Acceptance

| Check | Evidence |
|-------|----------|
| Metric round-trips | record then read returns the same `{name,value,source}` |
| baseline/best math | first value seeds baseline; a higher value advances best |
| Survives compaction | a fresh process reconstructs metric history from `.codexclaw/` |
| Source tagged | operator-entered vs evaluate.sh distinguishable on every row |
| No goal-DB touch | no read/write of `goals_1.sqlite` in this path |

## Verification

- `node --test` on a new `metrics.test.ts`: round-trip, baseline/best, reconstruct-after-fresh.
- `npm run build` (idempotent; +1 module) ; `npm test` (suite green) ; `npm run gate` (exit 0) ;
  `git diff --check`.

## PABCD plan (one full cycle, FUTURE loop)

- P: pick shape (a) sibling jsonl vs (b) ledger field; lock the `cxc metric` verb surface.
- A: gpt-5.4 explorer — is append-only preserved? does best/baseline direction come from 015 or a
  hardcoded "higher is better"? any goal-DB leak? compaction-reconstruct correct?
- B: implement record/read + CLI verb + tests.
- C: build idempotent + unit + gate; capture tails.
- D: close to IDLE, commit `feat(emergence-010): objective-metric state substrate`, `goal update`.

## Closed decision

Use separate `.codexclaw/metrics.jsonl`, not a field on the transition ledger. Reason: metric
history has its own cadence and must be reconstructable independently from phase transitions.

## Depends on / feeds

No prereqs. Feeds 020 (plateau lever reads this history), 045 (harness pipes `METRIC` here),
050 (D race keeps the metric-best candidate).
