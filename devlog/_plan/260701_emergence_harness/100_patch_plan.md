# 100 — Emergence Harness Patch Plan (decade-decomposed)

Status: PLANNED (decomposition; this loop produces the PLAN only — NO implementation) · 2026-07-01 · cxc-loop

> This loop's deliverable is THIS patch plan, nothing more. Per the user instruction:
> "이번 루프는 pabcd 반복하면서 패치플랜까지만 세우는거다." Each decade below is one future
> PABCD work-phase (`I/P→A→B→C→D --attest`); implementation is a LATER loop.
>
> Design source of truth: `000_INDEX.md` → `001`–`007` in this folder. Diagnosis:
> `structure/50_emergence_gap.md`. Enforcement vocabulary: `structure/40_enforcement_methods.md`
> (E1–E8). DONE = shipped + tested (two-axis status), so every row here is PLANNED until its
> own loop ships it.

## Sequencing principle

Ship the cheap honest scaffolding first (state fields + metric recording), then the one real
runtime lever (plateau→diverge Stop check, E2), then the divergence-flow doctrine (E7) that
depends on those fields existing, then the build-time fan-out, last the visualization/docs
sync. Order = dependency order; do not build a later decade before its prereqs land.

> A-phase audit (Faraday, 2026-07-01) folded in: objective-kind gating was split out to
> decade 15 (it must precede the Stop lever), harness-first to decade 45 (it must precede
> any candidate build), the goal-mode `request_user_input` collision was corrected, and the
> tier labels were made honest (only the decade-20 Stop branch is a true E2 lever).

## Decade map

| Decade | Work-phase | Scope | Strongest tier | Depends on |
| ------ | ---------- | ----- | -------------- | ---------- |
| 10 | objective-metric state substrate | persist a true-objective metric + history in `State`/ledger | E2-ready substrate + E8 tests | — |
| 15 | objective-kind signal | satisfy vs maximize tag (explicit goal tag or inferred from `evaluate.sh`) | E7 (+ read by E2 in 20) | — |
| 20 | plateau→diverge Stop lever | metric-delta check arms divergence; replaces turn-only cap | **E2 (the key lever)** | 10, 15 |
| 30 | divergence-mode + collapse-point doctrine | `cxc-loop`/`pabcd` skill rules: diverge at I, early-vs-late collapse | E7 doctrine + persisted state (consumes 20's E2) | 10, 15, 20 |
| 40 | N>=2 grounded generation (cxc-search) | I records strong-1+add-1, grounded via cxc-search; user-question gating | E7 | 30 |
| 45 | harness-first (`evaluate.sh`) | build/validate the faithful judge BEFORE any candidate | E7 doctrine + E2 metric feed | 10, 15 |
| 50 | candidate build fan-out (worktrees) | late-collapse A-B-C across worktrees; keep/discard race at D | E7 + E2 ledger | 30, 45 |
| 60 | overfitting guard + intent-question gating | local≠true-metric stop signal; user-question conditional wording | E7 | 15, 30 |
| 70 | docs/visual sync + falsifiability | reconcile 006/007 axes into one SOT; ablation validation rule | E8 (drift gate) | all |

---

## 10 / objective-metric state substrate

Register: `50_emergence_gap.md` root #1 (no objective-delta memory); `005` L2.

Problem: `State` (`plugins/codexclaw/components/pabcd-state/src/state.ts:18`) persists
phase/flags/`stopBlock*` only; the ledger stores transitions + evidence strings, never a
metric. The loop literally cannot know it plateaued.

Work-phases:
1. 10.1 — add an optional objective-metric record to `State` (or a sibling
   `.codexclaw/` ledger): `{metric_name, value, baseline, best, workPhaseId, source}`.
   `source` ∈ {operator-entered, evaluate.sh} (remote judge → operator-entered, the honest
   limit from the diagnosis).
2. 10.2 — a `cxc` CLI verb to record/read the metric per work-phase (operator types remote
   scores; local harness pipes `METRIC name=value`).
3. 10.3 — tests: round-trip persist/read; baseline/best math; reconstruct after compaction.

DONE when: metric history persists across work-phases and survives a fresh context; tests green.
Open Q: separate `.codexclaw/metrics.jsonl` vs a field on the work-phase ledger entry?

Tier note: persisted state is NOT itself E2 (E2 = a Stop block). This decade is the
E2-READY substrate plus E8 tests; the E2 lever lands in decade 20.

## 15 / objective-kind signal (satisfy vs maximize)

Register: `006` (satisfy vs maximize); A-phase audit finding #1 (must precede decade 20).

Problem: `goal-active.ts:62` only reads native goal status `active|inactive|unreadable`;
there is no satisfy/maximize discriminator. Decade 20's Stop lever and decade 30's
divergence doctrine both gate on "maximize-metric goal", so that signal must exist FIRST.

Work-phases:
1. 15.1 — define the objective-kind signal: an explicit goal tag (`satisfy`|`maximize`) or
   inferred from whether decade-10 metric / an `evaluate.sh` exists. satisfy-spec is the
   default so ordinary build work pays zero divergence overhead.
2. 15.2 — surface it to the hook layer (read-only, alongside goal status) so decade 20 can
   gate on it without a new write path to the native goal DB.
3. 15.3 — tests: satisfy vs maximize classification; default is satisfy when unsignalled.

DONE when: the hook can read objective-kind; satisfy is the safe default; tests green.
Open Q: explicit tag vs inferred-from-`evaluate.sh` — which is the default?

## 20 / plateau→diverge Stop lever

Register: `50_emergence_gap.md` root, finding #1/#3; `005` L3; `006` plateau switch.

Problem: the only stagnation signal is `MAX_STOP_BLOCKS` (turn-count), not objective
non-improvement. `handleStop` cannot trigger a step-back on a flat true metric.

Work-phases:
1. 20.1 — in `handleStop`, when a maximize-metric goal is active and the last N recorded
   metrics (decade 10) show no improvement, inject a "diverge / step-back / re-interview"
   directive instead of a plain continuation block. Keep the turn-count cap as the safety
   floor so it still can't trap.
   NOTE (audit #4): re-interview is FORBIDDEN under an active goal (`hook.ts:437` returns
   for phase I; `hook.ts:254` suppresses explicit I in goal mode). So the in-goal directive
   is "diverge / step-back / re-PLAN" only. True re-interview requires pausing/closing the
   goal first — state that, do not emit an interview directive mid-goal.
2. 20.2 — threshold config: N (default 2, matching "after 2 non-improving submissions") +
   noise floor so within-noise deltas count as flat.
3. 20.3 — tests: flat metric arms the directive; improving metric does not; satisfy-spec
   goal never arms (no metric → never fires); cap still releases.

DONE when: a flat true metric provably flips Stop to a diverge directive; tests green.
Open Q: arm-divergence threshold vs force-re-diverge threshold — same N or different?
Depends on: decade 10 (metric history) AND decade 15 (objective-kind, to gate "maximize").

## 30 / divergence-mode + collapse-point doctrine

Register: `004`, `006`, `007` (collapse-point model).

Problem: the divergence flow + collapse-point model live only in this devlog; no skill
encodes them, so the agent has no runtime-facing rule.

Work-phases:
1. 30.1 — `cxc-loop`/`pabcd` SKILL.md: add the collapse-point doctrine — I records N>=2
   (strong-1+add-1), early collapse at P for satisfy-spec, late collapse (A-B-C race at D)
   for maximize-unclear. Label honestly (E7 doctrine + the E2 lever from decade 20).
2. 30.2 — a `.codexclaw/` divergence-mode flag + candidate archive shape so a fresh pass
   knows it is mid-divergence and which candidates exist.
3. 30.3 — tests/lint: skill text matches the shipped Stop behavior (no over-claim — the
   `50_emergence_gap.md` honesty rule).

DONE when: the skills state the model truthfully and the mode flag persists; drift check green.
Open Q: divergence-mode archive shared with decade 50's candidate archive or separate?
Tier note (audit #6): this decade is E7 doctrine + persisted state; it CONSUMES decade-20's
E2 signal but adds no E2 lever of its own. Do not relabel persistence as E2.

## 40 / N>=2 grounded generation via cxc-search

Register: `007` (cxc-search grounding rule).

Problem: N candidates invented from memory collapse to variations of the first idea; the
anti-anchoring rule is empty without grounding.

Work-phases:
1. 40.1 — doctrine in `cxc-loop` (+ `dev` §0 cross-ref): when diverging, ground each
   candidate via cxc-search (Tier 1 discover, Tier 2 prove); user-facing N>=2 question is
   conditional on open intent; strong-1 grounded deep, add-1 at least Tier 1.
2. 40.2 — record the grounding source URLs alongside each recorded candidate in the
   archive (provenance, not memory).

DONE when: the skill requires grounded candidates and the archive carries provenance; doc-sync green.
Open Q: is Tier 3 ultraresearch the default for late-collapse, or opt-in per the search ladder?

## 45 / harness-first (`evaluate.sh`) — before any candidate

Register: `004` ("Before any candidate"); A-phase audit finding #2 (must precede decade 50).

Problem: building candidates before a faithful judge exists is the NYPC root cause. The
harness-first habit (jawcode autoresearch Phase 1) must land BEFORE the fan-out in decade 50.

Work-phases:
1. 45.1 — doctrine: for a maximize goal, build/validate `evaluate.sh` (deterministic, fixed
   seeds, emits `METRIC name=value`, exit 0/non-0) and confirm a baseline BEFORE the first
   optimization/candidate work-phase.
2. 45.2 — wire its `METRIC` output into the decade-10 metric substrate so baseline/best are
   recorded automatically for local harnesses (operator-entered stays the remote-judge path).

DONE when: harness-first is doctrine and feeds the metric substrate; doc-sync green.
Depends on: decade 10 (substrate) + decade 15 (only maximize goals need it).

## 50 / candidate build fan-out (worktrees)

Register: `004` (A+B parallel), `007` (late collapse).

Problem: late collapse needs N candidates built in isolation and raced; no worktree
fan-out doctrine exists in codexclaw (jawcode `team` has the pattern).

Work-phases:
1. 50.1 — doctrine: late-collapse B builds each candidate in its own worktree (reuse the
   `team` isolation pattern, no server); C runs each through the same `evaluate.sh`.
2. 50.2 — D race: keep metric-best, discard (revert) the rest; human gate when metric
   cannot separate or none beats baseline. NOTE (audit #3): `request_user_input` is DENIED
   under an active goal (`goal-gate.ts:36,108`). So the human gate fires only AFTER the goal
   is paused/closed, OR the loop records an autonomous "kept candidate + unresolved tie"
   note for later human review — it must NOT claim an in-goal `request_user_input`.
3. 50.3 — worktree budget rule (max concurrent/sequential per work-phase).

DONE when: the doctrine + D race + budget are specified and consistent with no-server; doc-sync green.
Open Q: cheap-screen (stub `evaluate.sh`) before full build — required, or only when N>2?
Depends on: decade 30 (divergence doctrine) + decade 45 (harness exists before any build).

## 60 / overfitting guard + intent-question gating

Register: `006` (layered selection), `007` (user-question gating), `50_emergence_gap.md`
(96%-local / 3.5-official gap). (Objective-kind moved to decade 15; harness-first to 45.)

Problem: even with the metric loop, the agent can overfit a local proxy and can over-ask
the user. Two doctrine guards remain unowned.

Work-phases:
1. 60.1 — overfitting guard wording: local metric diverging from the true/holdout metric is
   a stop-and-rethink signal, not a "keep" — the exact 96%-local / 3.5-official trap.
2. 60.2 — intent-question gating: I asks the user to choose among approaches ONLY when
   intent is open; with clear intent it records strong-1+add-1 and converges silently
   (`007`). Encode the trigger that flips silent-converge ↔ ask.

DONE when: the overfitting guard and the user-question trigger are doctrine; doc-sync green.
Open Q: what concrete signal flips "converge silently" → "ask the user"?

## 70 / docs + visual sync + falsifiability

Register: all; `003` falsifiability.

Problem: the model now spans 000–007 + HTML in several layers (006 mode-axis, 007
collapse-axis); needs one reconciled SOT and a drift gate, plus the honest validation rule.

Work-phases:
1. 70.1 — fold 006 (plateau mode) + 007 (collapse point) into one reconciled section; keep
   `emergence_gap.html` in sync (sections 07–10).
2. 70.2 — falsifiability rule recorded: validate the divergence layer by OLD-vs-NEW
   ablation on a PREDEFINED seed/fold set (train/validation/holdout split per
   `50_emergence_gap.md:52`), comparing baseline vs new on IDENTICAL seeds, judged by
   median + worst-10% + variance (not mean) against a noise/effect-size threshold. A single
   fixed-seed fixture can itself become the overfit target, so the holdout fold must stay
   untouched during tuning. Official NYPC re-submission is EXTERNAL smoke, never causal proof.
3. 70.3 — optional E8 drift gate: a test asserting skill text ↔ shipped Stop behavior ↔
   this plan stay consistent.

DONE when: one reconciled SOT, HTML in sync, falsifiability rule fixed; drift gate green.

---

## Non-goals (locked, carried from 003)

- No server/daemon/background population manager (no-server philosophy).
- No claim a hook auto-runs a tournament; hooks gate, the agent executes.
- No vendored evolutionary framework; archive = files + ledger.
- No new subagent roles; divergence travels as skills + ledger via the 3 base roles.
- No auto-verification of a remote judge score (operator-entered; hook can't read it).

## This loop's exit condition

This loop is DONE when this patch plan (decades 10–70) is written, reconciled with 000–007,
and committed. Implementation of any decade is a separate future loop with its own PABCD cycle.

## A-phase audit verdict (folded in)

Faraday (read-only adversarial audit, 2026-07-01) found the root diagnosis sound but the
plan's ORDERING and TIER labels wrong. Resolved: decade 15 (objective-kind) and 45
(harness-first) split out as prerequisites; goal-mode `request_user_input` / re-interview
collisions corrected (decades 20, 50); tier labels made honest (only decade-20 Stop is true
E2; decade 10 is E2-ready substrate; decade 30 consumes the E2 signal); decade-70
falsifiability strengthened to train/val/holdout + median/worst-10%. Final decade order:
10 → 15 → 20 → 30 → 40 → 45 → 50 → 60 → 70.
