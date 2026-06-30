# 045 — Harness-First (`evaluate.sh`) Before Any Candidate

Status: PLANNED (no code yet) · 2026-07-01 · emergence_harness_impl WP 045 · class C2 (skill doctrine + metric feed) · E7 + E2 feed

> Design source: `../260701_emergence_harness/004` ("Before any candidate"). A-phase audit finding
> #2: harness-first MUST precede the decade-050 fan-out — building candidates before a faithful
> judge exists is the NYPC root cause (96% local self-play, 3.5/8 official).

## Why

The NYPC trap is optimizing against a proxy that diverges from the true objective. The fix is a
faithful judge built FIRST: a deterministic `evaluate.sh` with fixed seeds that emits
`METRIC name=value` and a clean exit code, with a recorded baseline, BEFORE any optimization or
candidate work-phase. This is jawcode autoresearch Phase 1 translated into codexclaw doctrine.
Without it, decade 050's race compares candidates on a judge that does not predict the real score.

## Ground Truth (read before edit)

- `004` divergence flow ("Before any candidate" step) — the design contract.
- Decade 010 metric substrate — `evaluate.sh`'s `METRIC` output feeds the `source:"evaluate.sh"`
  path automatically (operator-entered stays the remote-judge path).
- Decade 015 objective-kind — only `maximize` goals need a harness; satisfy goals skip this.
- `cxc-loop` doctrine (extended here).

## Design (diff-level)

1. 045.1 — doctrine: for a `maximize` goal, build/validate `evaluate.sh` (deterministic, fixed
   seeds, emits `METRIC name=value`, exit 0/non-0) and confirm a baseline BEFORE the first
   optimization/candidate work-phase. No candidate build may start until the harness + baseline exist.
2. 045.2 — wire `evaluate.sh`'s `METRIC` output into the decade-010 substrate so baseline/best are
   recorded automatically for local harnesses; operator-entered remains the remote-judge path.

## Invariants

- maximize-only: satisfy goals (no metric) skip harness-first entirely.
- The harness is deterministic (fixed seeds) — a non-deterministic judge cannot validate diversity.
- No candidate build before harness + baseline (ordering, enforced as doctrine + 050's prereq).
- No-server: `evaluate.sh` is a short-lived process, not a daemon.

## Acceptance

| Check | Evidence |
|-------|----------|
| Harness-first is doctrine | `cxc-loop` requires evaluate.sh + baseline before candidates |
| METRIC feeds substrate | `evaluate.sh` output records to decade-010 with source=evaluate.sh |
| maximize-only | satisfy goals skip the harness step |
| Deterministic | fixed-seed contract stated; non-deterministic judge flagged |

## Verification

- doc-sync: `cxc-loop` text states the harness-first ordering + the `METRIC` contract.
- a metric-feed test: a sample `METRIC name=value` line records correctly via decade-010.
- `npm run build` ; `npm test` ; `npm run gate` ; `git diff --check`.

## PABCD plan (one full cycle, FUTURE loop)

- P: lock the `METRIC name=value` contract + exit-code semantics + the baseline-confirm step.
- A: gpt-5.4 explorer — can a candidate build start before the harness exists? is determinism
  required explicitly? does the metric feed double-count operator-entered + evaluate.sh?
- B: write the doctrine + the metric-feed wiring.
- C: build + metric-feed test + gate.
- D: close, commit `feat(emergence-045): harness-first evaluate.sh doctrine + metric feed`, `goal update`.

## Depends on / feeds

Depends on 010 (substrate to feed) + 015 (only maximize needs it). Feeds 050 (the race runs each
candidate through THIS harness) and 070 (falsifiability uses the same seed/fold discipline).
