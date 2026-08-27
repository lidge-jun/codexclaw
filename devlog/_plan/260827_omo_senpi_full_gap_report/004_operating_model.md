# Strategic programs: owner, metric, cadence, and decision gates

## Program 1 — Control-plane truth and durable execution memory

- Accountable owner: `pabcd-state` component owner.
- Contributors: `subagent-config`, `search`, host capability interface.
- Baseline: no public add-task/resolve-task/capture-criterion; config-only surface inference; reported wait-timeout retirements.
- Metrics:
  - `surface_misroutes = wrong_surface_dispatches / governed_dispatches`.
  - `manual_goalplan_edits = manual_task_or_criterion_edits / all_state_mutations`.
  - `timeout_false_deaths = children_retired_after_timeout_but_later_completed`.
- Data source: lifecycle matrix tests, goalplan mutation ledger, controlled subagent probes.
- Cadence: every PR; weekly dogfood review; monthly host contract review.
- Entry gate: current capability/goalplan owner map approved.
- Exit gate: zero misroutes in required matrix; all lifecycle mutations public and fail-closed; compaction recovers next work.

## Program 2 — Unified operator experience

- Accountable owner: `messenger-bridge/gui` product owner.
- Contributors: `cxc-ops`, `pabcd-state`, docs.
- Baseline: dashboard lacks PABCD/goalplan/doctor/trust; two channel mutations ignore results; prompt override saves on every change.
- Metrics:
  - `healthy_first_turn_minutes = healthy_turn_at - install_started_at`.
  - `false_success_mutations = success_UI_without_confirmed_ok`.
  - `workflow_state_latency = dashboard_visible_at - state_committed_at`.
- Data source: first-run telemetry kept local, browser QA, API mutation receipts.
- Cadence: weekly UX review; every release candidate.
- Entry gate: one information architecture and installed launch command.
- Exit gate: median <5m; false success 0; phase/workphase/criteria/next action visible <2s.

## Program 3 — Durable correlated operations plane

- Accountable owner: `messenger-bridge` operations owner.
- Contributors: `pabcd-state`, host event interface, privacy/security.
- Baseline: process-memory metrics; 200-event ring; best-effort JSONL; no end-to-end correlation.
- Metrics:
  - `traceability = completed_turns_with_full_chain / completed_turns`.
  - `silent_log_failures`.
  - `MTTD_stuck_operation`.
- Data source: local SQLite event schema and doctor/dashboard.
- Cadence: daily dogfood; weekly operations review.
- Entry gate: privacy/redaction threat model and stable correlation IDs.
- Exit gate: >=99% full-chain traceability, restart retention 100%, silent failures 0, MTTD <2m.

## Program 4 — Engineering static-safety and modularity

- Accountable owner: build/CI maintainer.
- Contributors: all component owners.
- Baseline: 21 plugin `src` files >400 LOC, 4 >800, 4 win-exec owners, no typecheck/lint/coverage gate.
- Metrics:
  - static diagnostics count.
  - production files >400 and >800 LOC.
  - canonical platform helper owners.
  - changed-file coverage.
- Data source: CI jobs and repository inventory.
- Cadence: every PR; monthly architecture review.
- Entry gate: non-mutating checks and decomposition map.
- Exit gate: diagnostics 0; >800 files 0; >400 <=8 with waivers; win-exec owners 1; diff coverage >=80% after baseline.

## Program 5 — Candidate-grade distribution, security, and ecosystem

- Accountable owner: release maintainer/security owner.
- Contributors: payload, skill-search, docs, platform owners.
- Baseline: Windows real install lifecycle 0; SAST/SBOM/signing absent; mutable external skill refs; payload map contradiction.
- Metrics:
  - exact-head lifecycle OS count / 3.
  - release assets with SBOM/signature/post-publish proof.
  - external skills with immutable revision/hash/permission diff.
  - docs/inventory drift count.
- Data source: release manifest, CI receipts, skill inspection receipts.
- Cadence: every candidate; monthly supply-chain review.
- Entry gate: support matrix and threat model.
- Exit gate: 3/3 lifecycle green; 100% SBOM/signature; 0 mutable-HEAD execution; map smoke passes or affordance removed.

## Dependencies

1. Program 4 static checks precede broad Program 1/2 runtime growth.
2. Program 1 stable IDs and lifecycle state precede Program 3 correlation.
3. Program 5 supply-chain contracts precede external ecosystem expansion.
4. Program 2 console consumes Program 1 and Program 3 state; it must not invent parallel state.
5. Program 3 live wake integration remains blocked until the host exposes authenticated snapshots.
