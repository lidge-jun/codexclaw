# Strategic programs: owner, metric, cadence, and decision gates

## Program 1 — Control-plane truth and durable execution memory

- Accountable owner: `pabcd-state` component owner.
- Contributors: `subagent-config`, `search`, host capability interface.
- Baseline: no public add-task/resolve-task/capture-criterion; config-only surface inference; reported wait-timeout retirements.
- Metrics (rolling 30 days; every ratio reports population and uses `max(1, denominator)`):
  - `surface_misroute_rate = wrong_surface_dispatches / max(1, governed_dispatches)`.
  - `manual_goalplan_edit_rate = manual_task_or_criterion_edits / max(1, all_task_or_criterion_mutations)`.
  - `timeout_false_death_count = count(children_retired_after_timeout_but_later_completed)` per release candidate.
- Data source: lifecycle matrix tests, goalplan mutation ledger, controlled subagent probes.
- Cadence: every PR; weekly dogfood review; monthly host contract review.
- Entry gate: current capability/goalplan owner map approved.
- Exit gate: zero misroutes in required matrix; all lifecycle mutations public and fail-closed; compaction recovers next work.

## Program 2 — Unified operator experience

- Accountable owner: `messenger-bridge/gui` product owner.
- Contributors: `cxc-ops`, `pabcd-state`, docs.
- Baseline: dashboard lacks PABCD/goalplan/doctor/trust; two channel mutations ignore results; prompt override saves on every change.
- Metrics (per release candidate; first-turn and state-latency report median/P90 or median/P95):
  - `healthy_first_turn_minutes = healthy_turn_at - install_started_at`.
  - `false_success_mutation_count = count(success_UI_without_confirmed_ok)`.
  - `workflow_state_latency_seconds = dashboard_visible_at - state_committed_at`.
- Data source: first-run telemetry kept local, browser QA, API mutation receipts.
- Cadence: weekly UX review; every release candidate.
- Entry gate: one information architecture and installed launch command.
- Exit gate: median <5m; false success 0; phase/workphase/criteria/next action visible <2s.

## Program 3 — Durable correlated operations plane

- Accountable owner: `messenger-bridge` operations owner.
- Contributors: `pabcd-state`, host event interface, privacy/security.
- Baseline: process-memory metrics; 200-event ring; best-effort JSONL; no end-to-end correlation.
- Metrics (rolling 7 days; ratios report population):
  - `traceability_rate = completed_turns_with_full_chain / max(1, completed_turns)`.
  - `silent_log_failure_count = count(log_write_failures_without_operator_signal)`.
  - `MTTD_stuck_operation_minutes = median(detected_at - first_stuck_signal_at)`.
- Data source: local SQLite event schema and doctor/dashboard.
- Cadence: daily dogfood; weekly operations review.
- Entry gate: privacy/redaction threat model and stable correlation IDs.
- Exit gate: >=99% full-chain traceability, restart retention 100%, silent failures 0, MTTD <2m.

## Program 4 — Engineering static-safety and modularity

- Accountable owner: build/CI maintainer.
- Contributors: all component owners.
- Baseline: 21 plugin `src` files >400 LOC, 4 >800, 4 win-exec owners, no typecheck/lint/coverage gate.
- Metrics (every PR; monthly trend):
  - `static_diagnostic_count = type_errors + lint_errors`.
  - `oversized_400_count = count(plugin_src_files_LOC > 400)` and `oversized_800_count = count(plugin_src_files_LOC > 800)`.
  - `platform_helper_owner_count = count(production win-exec owners)`.
  - `changed_file_coverage = covered_changed_lines / max(1, executable_changed_lines)`.
- Data source: CI jobs and repository inventory.
- Cadence: every PR; monthly architecture review.
- Entry gate: non-mutating checks and decomposition map.
- Exit gate: diagnostics 0; >800 files 0; >400 <=8 with waivers; win-exec owners 1; diff coverage >=80% after baseline.

## Program 5 — Candidate-grade distribution, security, and ecosystem

- Accountable owner: release maintainer/security owner.
- Contributors: payload, skill-search, docs, platform owners.
- Baseline: Windows real install lifecycle 0; SAST/SBOM/signing absent; mutable external skill refs; payload map contradiction.
- Metrics (every candidate; monthly supply-chain review):
  - `lifecycle_os_rate = exact_head_lifecycle_green_OS / 3`.
  - `signed_asset_rate = assets_with_SBOM_signature_and_post_publish_verification / max(1, published_assets)`.
  - `immutable_skill_rate = approved_external_skills_with_revision_hash_permission_diff / max(1, approved_external_skills)`.
  - `docs_inventory_drift_count = count(version_skill_hook_component_command_mismatches)`.
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

## Domain accountability ledger

| Domain | Accountable owner | Primary KPI | Principal risk |
| --- | --- | --- | --- |
| Orchestration | pabcd-state | illegal/unsupported transitions = 0 | ceremony mistaken for intellectual quality |
| Goal/task state | pabcd-state | supported lifecycle operations / required operations = 100% | manual JSON or second state source |
| Research/knowledge | search + goalplan | terminal disposition rate >=95% | claim graph becomes unused ceremony |
| Multi-agent | subagent-config | surface misroute rate = 0 | host schema drift and timeout false deaths |
| Evidence/QA | pabcd-state QA/evidence | C3/C4 source-bound final-gate rate = 100% | self-authored receipts create false assurance |
| Trust/security | cxc-ops + security | silent hook skip = 0 | retrust confused with publisher authenticity |
| Release assurance | release maintainer | exact-head lifecycle/SBOM/signature = 100% | source CI mistaken for installed proof |
| Human authority | pabcd-state | unauthenticated free-pass use = 0 | natural language mistaken for human command |
| Onboarding | GUI/product | median healthy first turn <5m | decision overload and hidden trust work |
| Operator console | GUI/product | state visibility latency <2s | browser view invents parallel state |
| Remote/messenger | bridge owner | successful terminal delivery >=99% | full-access remote scope expansion |
| Observability | bridge ops | full-chain traceability >=99% | privacy leakage through centralized logs |
| Capability/tool routing | subagent-config | unknown→available coercions = 0 | disconnected resolver remains test-only |
| Workspace intelligence | cxc-ops | payload map smoke pass or affordance = 0 | dependency size/cross-platform burden |
| Cross-platform | platform owner | exact-head lifecycle OS = 3/3 | source tests hide install defects |
| Maintainability | build/CI | 0 diagnostics; >400 LOC <=8 | feature growth before decomposition |
| Distribution/install | release owner | N-1→candidate lifecycle success = 100% | checkout-only claims leak into payload docs |
| Model/provider portability | provider/subagent settings | rejected saved combinations = 0 | vocabulary/catalog drift |
| Performance operations | build/CI | active-hook baseline coverage = 100% | incomparable-runner benchmark theatre |
| Ecosystem/extensibility | release/security | immutable approved-skill rate = 100% | mutable skill/MCP supply chain |
