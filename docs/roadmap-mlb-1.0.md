# MLB 1.0 roadmap: 80-grade Codex-native thin harness

Parent roadmap: #22

## Scorecard

The 20–80 scale treats 50 as a major-league average, 60 as a clear plus tool, 70 as elite, and 80 as category-defining. The resolved baseline is an architectural projection, not a claim that every benchmark has already been run.

| Tool | Resolved baseline | MLB 1.0 target |
| --- | ---: | ---: |
| Codex-native fit | 80 | **80** |
| Context/runtime economy | 75 | **80** |
| Risk-scaled methodology | 75 | **80** |
| Evidence completion | 75 | **80** |
| Delegation contract | 70 | **75** |
| Tool/code intelligence | 50 | **55** |
| Install/update/release | 65 | **75** |
| Cross-platform/trust | 65 | **70** |
| Eval/observability | 65 | **80** |
| Field maturity | 35 | **55–60** |

Tool/code intelligence is deliberately not targeted at 80. Codex should own and improve the editor, shell, browser, computer-use, and scheduler. codexclaw should improve automatically as those native capabilities improve.

## Existing tracks

- #7 — capability resolver
- #8 — PABCD port provenance
- #10 — release metadata synchronization
- #11 — activation traces
- #12 — secret-safe token ingress
- #13 — hook lifecycle benchmark
- lidge-jun/pabcd_initiative#1 — host-neutral activation-economy schema

## Execution issues

- #14 — architecture contract
- #15 — operations and lifecycle evidence
- #16 — stable/canary capability lock
- #17 — typed native dispatch contract
- #18 — Rule Impact Ledger
- #19 — reference league and comparative benchmark
- #20 — sanitized scouting bundle
- #21 — exact-head MLB 1.0 release gate

## Phase 0 — Spring Training: freeze and measure

Land the opt-in activation and hook baselines before changing router sizes, implicit policy, or hook topology.

Measure:

- expected/observed C0–C5 class
- visible skills, activated router bodies, selected references
- subagent skill attachments and duplication
- hook invocation/no-op/process/IO/p50/p95
- verifier result, rework, tokens, and wall time where exposed
- rule violations caught because knowledge was activated

Ordinary tracing-disabled sessions must gain no context or artifact.

## Phase 1 — Triple-A defense: operations without a second runtime

Make `cxc doctor` the single typed source for plugin/capability/state health. Add fresh install, N-1 upgrade, hook reapproval, schema migration, interrupted recovery, uninstall, re-install, offline, and corrupt-state receipts across supported surfaces.

Do not require a global CLI, daemon, proxy, tmux runtime, or default MCP fleet.

## Phase 2 — Rookie season: small capability lock

After #7 centralizes runtime identities, pin only the Codex surfaces codexclaw actually consumes: plugin/hook payload versions, native spawn fields, goals, discovery/source-open capabilities, and relevant model-catalog capabilities. Stable and canary fixtures are separate. Unsupported states fail explicitly; no hidden fallback.

## Phase 3 — Pitch calling: typed dispatch over native spawn

Add a bounded DispatchPacket and DispatchReceipt that express specifiability, verifiability, skill attachments, worktree policy, source identity, and verifier evidence. Keep explorer/reviewer/executor. Keep final judgment with the main agent. Retire a packet after two independent failures on the unchanged contract.

## Phase 4 — Batting average: measure rule value

Join activation cost to verifier outcome. Keep frequently useful rules in router cores, preserve rare high-risk rules as targeted references, move frequently neutral rules deeper, and consolidate duplicate ownership. File size alone is not a deletion criterion.

## Phase 5 — 162-game season: field maturity

Pin representative repository snapshots and run controlled tasks across bare Codex, codexclaw, LazyCodex, and OMX with the same model, effort, sandbox, budget, and verifier where possible. Run stochastic cases at least three times. Add an explicitly generated sanitized support bundle; do not add default telemetry.

## Phase 6 — All-Star gate: exact candidate release

Promote MLB 1.0 only when one candidate manifest links:

- activation and rule-impact reports
- platform-specific hook performance baseline
- install/upgrade/recovery receipts
- capability-lock report
- typed dispatch verification
- reference-league results
- secret-safe/scouting-bundle tests
- exact supported-platform CI for the candidate SHA

## Feature admission

Every new feature must document a native gap, activation point, hot-path cost, failure mode, disable path, sunset condition, and outcome evidence. New hooks are for invariants, not judgment. New roles, default MCPs, daemons, or duplicated native tools require exceptional evidence.

## Protected boundaries

- preserve the 13-skill dev family and on-demand references
- preserve C0/C1 fast paths and C4/C5 escalation
- preserve maintainer ownership of frontend/UIUX design grammar and loading policy
- preserve `pabcd_initiative` as methodology/provenance SoT and codexclaw as the Codex adapter SoT
- preserve the principle: **own judgment and evidence, not replacement runtime machinery**
