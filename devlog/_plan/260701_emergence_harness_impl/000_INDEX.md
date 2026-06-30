# emergence_harness_impl — Divergence Layer Implementation Track (CANONICAL INDEX)

Status: CANONICAL INDEX (phase-decomposed plan; NO code shipped yet) · 2026-07-01 · follows `../260701_emergence_harness/`

> `../260701_emergence_harness/` (000-007 + `100_patch_plan.md`) is the diagnosis + divergence-layer
> design + the single-file decade plan. THIS track splits that plan into one file per work-phase,
> the same way `../lazygap_impl/` split `../lazygap/`. This loop's deliverable is the plan only —
> per the user instruction "이번 루프는 pabcd 반복하면서 패치플랜까지만 세우는거다." Implementation
> of any decade is a LATER loop with its own full PABCD cycle.
>
> Diagnosis SOT: `structure/50_emergence_gap.md`. Design SOT: `../260701_emergence_harness/001`-`007`.
> Enforcement vocabulary (E1-E8): `structure/40_enforcement_methods.md`.

## Naming convention (inherited from mvp_hard / lazygap_impl)

- `000` = this INDEX. Each work-phase owns a decade: `010`, `020`, ...
- Decade head doc `0X0_<slug>.md`; finer sub-passes `0X1_<slug>.md`.
- Directory sort order == dependency order == execution order. `cxc` is the primary shorthand.
- DONE = shipped + tested only (two-axis status). Every doc here is PLANNED until its own loop ships it.

## Why this track exists

The diagnosis (`50_emergence_gap.md`): PABCD is a convergence (exploitation) machine, not a
divergence machine. Two root causes — `state.ts:18` has no objective-delta memory, and
`attest.ts:98` gates C->D on exitCode/checkOutput (a proxy), never the true objective. The NYPC
symptom: 96% local self-play, stuck 3.5/8 official. The divergence layer closes that gap; this
track sequences it into shippable phases.

## Constraints (LOCKED — inherited from philosophy + the patch plan non-goals)

- No server / daemon / background population manager (no-server philosophy).
- No goal-DB writes; all new state is project-local under `.codexclaw/`.
- No vendored evolutionary framework; the candidate archive = files + ledger.
- No new subagent roles; divergence travels as skills + ledger via the 3 base roles.
- No auto-verification of a remote judge score (operator-entered; a hook cannot read it).
- Every new hook branch FAILS-OPEN: a hook error must never trap a session.
- A-phase of every loop dispatches a gpt-5.4-class explorer for contradiction/blocker review.

## Sequencing principle (dependency order)

Ship the cheap honest scaffolding first (metric state + recording), then the one real runtime
lever (plateau->diverge Stop check, E2), then the doctrine (E7) that depends on those fields,
then the build-time fan-out, last the docs/visual sync + falsifiability. Do not build a later
decade before its prereqs land.

## Work-phase ledger

| WP | decade | scope | design src | strongest tier | depends on | impl-state |
| --- | --- | --- | --- | --- | --- | --- |
| 010 | 010 | objective-metric state substrate (`metrics.jsonl` + `cxc metric` + tests) | `001`,`005` L2 | E2-ready substrate + E8 | — | DONE |
| 015 | 015 | objective-kind signal (explicit tag or session-scoped metrics -> maximize) | `006` | E7 (read by E2 in 020) | — | DONE |
| 020 | 020 | plateau->diverge Stop lever | `005` L3,`006` | **E2 (the key lever)** | 010, 015 | DONE |
| 030 | 030 | divergence-mode + collapse-point doctrine | `004`,`006`,`007` | E7 + persisted state | 010,015,020 | PLANNED |
| 040 | 040 | N>=2 grounded generation via cxc-search | `007` | E7 | 030 | PLANNED |
| 045 | 045 | harness-first (`evaluate.sh`) before any candidate | `004` | E7 doctrine + E2 feed | 010,015 | PLANNED |
| 050 | 050 | candidate build fan-out (worktrees) + D race | `004`,`007` | E7 + E2 ledger | 030,045 | PLANNED |
| 060 | 060 | overfitting guard + intent-question gating | `006`,`007` | E7 | 015,030 | PLANNED |
| 070 | 070 | docs/visual sync + falsifiability | all,`003` | E8 (drift gate) | all | PLANNED |

Final order: 010 -> 015 -> 020 -> 030 -> 040 -> 045 -> 050 -> 060 -> 070.

## The one honest runtime lever

Only decade 020 (the plateau Stop branch) is a true **E2** lever — a Stop block the runtime can
force. Decade 010 is the **E2-ready substrate** (persisted state is not itself a Stop). Decade 030
**consumes** 020's E2 signal but adds no lever of its own. Everything 030-070 except 020 is **E7
doctrine** (agent-followed skill text) or **E8** drift/test gates. The remote judge score stays
operator-entered — no hook can read it. This honesty split is the A-phase-audit (Faraday) verdict
carried over from `../260701_emergence_harness/100_patch_plan.md`.

## A-phase audit carried over (Faraday, 2026-07-01)

The single-file plan's diagnosis was sound but its ORDERING/TIER labels were wrong. Resolved and
baked into this track's file split: objective-kind became its own prerequisite (015, precedes 020);
harness-first became its own prerequisite (045, precedes 050); the goal-mode `request_user_input`
collision is handled in 020/050 (no interview/no `request_user_input` under an active goal); only
020 is labelled E2.

## Document map

| File | Role |
| --- | --- |
| `000_INDEX.md` | this canonical index + ledger + constraints |
| `010_objective_metric_substrate.md` | persist a true-objective metric + history |
| `015_objective_kind_signal.md` | satisfy vs maximize discriminator |
| `020_plateau_diverge_stop_lever.md` | the one true E2 runtime lever |
| `030_collapse_point_doctrine.md` | divergence-mode + early/late collapse skill rules |
| `040_grounded_generation_cxc_search.md` | N>=2 candidates grounded via cxc-search |
| `045_harness_first_evaluate.md` | build the faithful judge before any candidate |
| `050_candidate_fanout_worktrees.md` | late-collapse A-B-C race + D keep/discard |
| `060_overfitting_intent_guards.md` | local!=true-metric stop + user-question gating |
| `070_docs_sync_falsifiability.md` | one reconciled SOT + ablation validation rule |

(Source single-file plan: `../260701_emergence_harness/100_patch_plan.md`, retained as the
decade-overview; this track is its per-phase expansion.)
