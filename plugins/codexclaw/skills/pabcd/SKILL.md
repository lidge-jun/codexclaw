---
name: cxc-pabcd
description: "MUST USE for any non-trivial multi-step development task that benefits from disciplined planning before execution — features, refactors, cross-module changes, or anything large enough to need explore-first planning, an audit gate, staged build, and verification before done. Scales depth by work class (C0-C5). Triggers: 'plan this', 'let's build X properly', 'interview me', 'be thorough', 'do it right', '제대로 만들자', '기획부터', '인터뷰하자', '요구사항 정리'."
metadata:
  last-verified: "2026-07-02"
  short-description: "Codex-native PABCD loop (Interview/Plan/Audit/Build/Check/Done) with class-scaled depth."
---

# PABCD Workflow

A Codex-native reimplementation of the IPABCD development loop (Interview + Plan / Audit / Build / Check / Done). There is no external orchestrator server. State lives in `.codexclaw/sessions/<sessionId>.json` plus `.codexclaw/ledger.jsonl`; transitions are driven by the `pabcd-state` hook component, the chat-side `cxc-orchestrate` surface (human free-pass), and the live `cxc orchestrate` terminal CLI (agent-gated).

> **C0/C1 work (small in-place patches):** See `dev` §0.0 Work Classifier and §0.1 Patch Fast-Path first — full PABCD is mandatory for C4 and conditional for C3, never the baseline for every task.

## Interview Trigger

Two distinct things, do not conflate them:

- **Hook auto-trigger (narrow):** the `pabcd-state` `UserPromptSubmit` hook only
  auto-detects the explicit phrases `interview`, `인터뷰`, and `orchestrate i`
  (`detectTrigger`). These inject the I directive automatically.
- **Agent judgment (broad):** for other phrasings — "요구사항 정리", "스펙 정리해줘",
  "뭘 만들어야 하는지 정리", or any variation that signals unclear requirements — the
  hook does NOT auto-fire; YOU decide to enter Interview by invoking `cxc-interview`
  (or running `cxc orchestrate I --session <id>`). The breadth lives in agent judgment, not in a regex.

**I — Interview**: HITL-only requirements discovery. Canonical rules (four dimensions, contradiction scanning, readiness gating, Q/A capture) live in `cxc-interview`; PABCD owns the phase edge I->P and the return-to-Interview affordance from any phase.

## How It Works

PABCD is a forward progression with Interview return.

```
IDLE ──→ P ──→ A ──→ B ──→ C ──→ D ──→ IDLE
         │      │      │
        gate   gate   gate
         └──────┴──────┴────→ I (Interview, context preserved)
```

You can return to Interview (I) from any phase to clarify requirements; the plan and audit context are preserved. Phases P, A, B pause for confirmation in interactive use; C and D proceed once their work is genuinely done. In goal mode the agent must explicitly run `cxc orchestrate P --session <id>` to start each PABCD cycle; nothing self-advances into P automatically, but the P->D sequence is never skipped. Goal mode is PABCD-only: while a goal is active the Interview NEVER fires — entry is suppressed and `request_user_input` is hard-denied, so the Interview is HITL-only and runs only with no active goal.

## Phase Control / Orchestrate

### Chat Surface

The chat command grammar is:

```text
orchestrate <I|P|A|B|C|D|status|reset> [--attest <json>]
```

Accepted prefixes include `$codexclaw:cxc-orchestrate`, `$cxc-pabcd`,
`cxc orchestrate`, `/orchestrate`, and bare `orchestrate`.

### Semantics

- Chat-submitted commands are the human path.
- Human path can advance legal adjacent phases without attestation.
- Agent/terminal path is the live `cxc orchestrate` CLI and is attest-gated:
  forward edges (P>A, A>B, B>C, C>D) require `--attest` evidence.
- `D` is a closing action that returns to `IDLE`; it is not a resting badge.
- `status` is read-only.
- `reset` is an explicit control action, not a normal phase edge.

### Per-phase artifact obligation (ORCH-ARTIFACT-01)

Advancing a phase is not the same as doing it (see `pabcd` faithful-execution). Each forward
edge must carry its real artifact, not just an `--attest` string: P = the actual diff-level plan;
A = an audit/review verdict that names blockers (`A>B` attest requires a non-empty
`auditOutput` — the pasted tail of the dispatched reviewer subagent's verdict — plus
the main agent's `auditVerdict` judgment, AUDIT-LOOP-01); B = the
implementation delta; C = fresh `tsc`/test/gate output (`C>D` attest requires a non-empty
`checkOutput`; `exitCode` is optional but, if supplied, must be `0`); D = a cycle summary with
evidence and the next-phase decision. A phase whose artifact is absent is not done, regardless
of adjacency.

**ATTEST-EVIDENCE-01 (DEFAULT):** write `did` with artifact pointers, not only a
sentence: plan/devlog paths, changed files, commands with exit codes, and evidence or
ledger paths when present. The runtime gate remains form-only for `did`; this is the
agent discipline that makes later audit possible.

### Control surfaces (shipped)

- **Chat (human free-pass)** — the hook parses a line-anchored `orchestrate <verb>`
  and drives the FSM (`transition` + ledger). Forward edges advance without `--attest`
  because the human asserts the phase is done; illegal adjacency is still refused.
- **Terminal (agent-gated)** — `cxc orchestrate <verb> [--attest <json>] [--session <id>]
  [--cwd <path>] [--json]` drives the SAME `.codexclaw/sessions/<id>.json` state through
  the un-weakened gated `transition()`. An agent MUST supply real `--attest` evidence to
  advance; `A>B` additionally needs `auditOutput` (reviewer verdict tail) + `auditVerdict`
  (`pass|near-pass|fail`; `near-pass` also needs `auditResidual`) and `C>D`
  additionally needs `checkOutput` + a passing `exitCode`. Mutating verbs
  (I/P/A/B/C/D/reset) REQUIRE the explicit `--session <id>` (your own session id from
  the SessionStart context line, or the terminal key `cli`) — the implicit
  latest-session fallback is write-disabled, closing the ACCIDENTAL cross-session
  collision path (G3, `devlog/_fin/260707_fork_fsm_bug/`; explicit replay of a
  foreign id remains possible and is governed by the rule below). `status`
  keeps the fallback. **SESSION-IDENTITY-01 (STRICT):** the id from YOUR OWN
  SessionStart binding line — the MOST RECENT binding line in your current context —
  is the only id you may pass to a mutating verb. A forked
  session's transcript contains the PARENT's id and orchestrate commands — replaying
  that id mutates the parent's FSM. If the id you are about to pass came from
  transcript history rather than your most recent SessionStart line, stop and use
  your own. This also covers `cxc loop init --session` and `cxc goalplan` — binding a
  goalplan slug into a foreign session corrupts that session's Stop enrichment and
  D-close goalplan cursor.
- **Phase footer** — every injected directive ends with `IPABCD: <phase> (<LABEL>)` so
  the current phase is visible (codex has no status UI). After `D` closes, the resting
  state shown is `IDLE`.
- The invocation source is the discriminator (codexclaw has no boss token): chat =
  human free-pass, CLI/tool = agent-gated.

### Loop / goal activation handoff

`cxc-loop` depends on this skill; it does not replace it. A loop request first activates
PABCD, then chooses HITL or HOTL:

- **HITL PABCD:** enter I or P explicitly (`cxc orchestrate I|P --session <id>` or the chat
  free-pass surface). No active goal is required, and P/A/B pause for the human.
- **HOTL goal PABCD:** the main session must create or reuse an ACTIVE host goal
  (`create_goal` / `get_goal`) and start a PABCD cycle (`cxc orchestrate P --session <id>`). The
  Stop-continuation hook arms only when both are true: active host goal AND
  non-IDLE PABCD cycle. Do not call this mode active if one half is missing.
- Subagents may inspect or verify the plan, but the main session owns host-goal
  lifecycle (`create_goal`/`update_goal`) and PABCD transitions.

## Phases

These align with the directives the `pabcd-state` hook injects per phase:

0. **I — Interview**: HITL-only requirements discovery; canonical rules live in `cxc-interview`. PABCD owns I->P and return-to-Interview phase edges.
1. **P — Plan**: Explore first (read real code, configs, docs). **Slice and order phases by dependency/architecture structure (STRICT, PHASE-SPLIT-01)** — the orthodox unlimited-time build order: foundations (schema, contracts, core data flow) → core capabilities → integration → hardening/polish — so each phase consumes the verified output of the previous one. Effort-based bucketing is FORBIDDEN: never split or order phases by estimated effort or payoff speed — no "quick win vs heavy" buckets, no impact/effort matrices, no time-boxed slices. Phase boundaries encode the system's build order, not the schedule. DB/API/UI/test work inside a phase are subtasks, not top-level phases by default, and every phase must still close with something independently verifiable (build, tests, or a demonstrable surface). Write a diff-level plan: file change map, scope boundary (IN/OUT), and testable accept criteria. For every planned conditional path (error handler, fallback, guard, gated branch, threshold behavior), the accept criteria name its **activation scenario** — how C will trigger it and what observable effect proves it ran (C-ACTIVATION-GROUNDING-01). For C2+ plans, begin with a loop-spec header: Loop archetype; Trigger; Goal (user-visible outcome); Non-goals; Verifier (command/gate and what it measures); Stop condition; Memory artifact; Expected terminal outcomes; Escalation condition. HOTL goal plans also state the `cxc-loop` HOTL resource bounds. For open-ended optimization, include the divergence plan, deterministic selection rule, and telemetry schema; if the verifier only reports scalar outcome, instrumentation is B's first work item before candidates. Ground every decision in code you have read. No implementation yet. For broad or unfamiliar repos, include a compact tree, detected conventions, which existing logs/docs you will reuse, and the SoT sync target (SOT-SYNC-01): which general source-of-truth doc (architecture/INDEX docs, or equivalent) this unit will patch in C — or, if the repo has none, the plan recommends creating one (dev-scaffolding §2.1).
2. **A — Audit**: Adversarial, read-only review of the plan against the real codebase. Dispatch an independent reviewer (`spawn_agent`) — even a small/mini-model one — to challenge assumptions, find blockers (rollback gaps, missing callers, phantom constants), and verify references. For each conditional path the plan adds, the reviewer also asks: is the trigger reachable at all from states the system actually visits (callers exist, preconditions can co-occur, upstream code does not consume the trigger first), and does the plan name its activation scenario (C-ACTIVATION-GROUNDING-01)? An unreachable-by-construction branch is a plan blocker, not a C-phase discovery. The reviewer also checks: new devlog phase documents use the numbered lexicographic filename convention; bare-named or research/implementation-mixed docs are a FAIL (LEXICO-SPLIT-01). Multi-phase units satisfy DIFFLEVEL-ROADMAP-01: every roadmap phase has a diff-level decade doc (no outline-only or missing phases), and the phase map is dependency-ordered, not effort-bucketed (PHASE-SPLIT-01). **Audit loop (STRICT, AUDIT-LOOP-01):** A is a loop — audit -> synthesize -> amend plan -> re-audit — not a single round. Exit A>B only when the MAIN agent judges the round **pass** (reviewer approved) or **near-pass**: every High/Critical blocker was folded into the plan as a concrete amendment or explicitly rebutted with recorded rationale, and only non-blocking residuals remain (`GO-WITH-FIXES; 2 blockers folded back` qualifies — the main agent is the judge, not a string parser). A FAIL round never exits: apply REVIEW-SYNTHESIS-01 (§11.3), amend the plan, and re-audit with the SAME reviewer (V2 `followup_task` to its task_name or V1 `send_input` to its agent_id; DISPATCH-ACTOR-01); LOOP-REPAIR-01 bounds the loop — after 3 failed rounds return to P with a changed plan (HITL may return to Interview). The dispatch packet explicitly names `$codexclaw:cxc-dev-code-reviewer` AND `$codexclaw:cxc-search` (reference/version/external-claim verification rides the search ladder) and instructs the reviewer to end with a normalized final line `VERDICT: PASS | GO-WITH-FIXES (blockers=N) | FAIL` plus numbered blockers. No code changes. The `A>B` attest structurally requires `auditOutput` (the pasted tail of the reviewer's verdict) plus `auditVerdict` (`pass|near-pass|fail` — the MAIN agent's own judgment of the round); `near-pass` additionally requires `auditResidual` naming each residual blocker and its disposition (folded/rebutted). A declared `fail` never advances, and a pasted tail whose final verdict line says FAIL is rejected regardless of the claimed judgment. Still a form-only bar: the gate cannot verify the paste's provenance, so faithful execution (really dispatching the reviewer, really looping) remains the agent's obligation.
   When the verdict is FAIL, fold-back follows REVIEW-SYNTHESIS-01 (§11.3): synthesize root causes and accept/rebut decisions before re-planning or re-dispatching the reviewer.
3. **B — Build**: Implement the audited plan in small atomic commits. Verify as you go. Stay inside the plan's scope boundary; surface deviations instead of silently expanding scope.
4. **C — Check**: Run the real verification — build, typecheck, and targeted tests, plus adversarial review. Capture fresh command output as evidence. Do not claim pass without artifact-level proof. When the unit changed a user-facing surface (web/TUI/CLI/API), C also closes with a `cxc-qa` evidence matrix — real invocations, adversarial classes, teardown receipts (E7 discipline; see `skills/qa/SKILL.md`).

   **SoT sync (DEFAULT, SOT-SYNC-01):** locate the repo's general source-of-truth
   docs (architecture/INDEX docs, or equivalent) — found in P, patched HERE so SoT
   and code never diverge silently; if the repo has none, recommend creating one
   (dev-scaffolding §2.1) in the D summary.

   **DEFAULT (C-RENDER-GROUNDING-01):** When the work-phase produces a render artifact
   (HTML, SVG, layout-defining CSS, canvas/animation/chart JS, .jsx/.tsx layout
   components) whose correctness only shows when run or rendered, C MUST include a
   render-grounding loop before C->D: (1) **RUN** it in its natural execution
   environment -- headless-browser screenshot for web, SVG->PNG render, execute scripts,
   drive stateful artifacts until the first interactive state change; (2) **OBSERVE** the
   output -- actually read the screenshot/console back; a produced-but-unread screenshot
   is not observation; (3) **FIX** what the observation reveals, then re-run and
   re-observe. Trigger on artifact type + change ("could this look or behave wrong in a
   way that only shows when it runs?"), never on task depth alone. Stop after ONE clean
   observation; re-render only after a change. Well-formed (tsc/lint/parse passing) is
   not correct -- static gates do not satisfy this rule. Defaults (HEURISTIC -- deviate
   with a stated reason): 1280x720 viewport; stateful artifacts driven until the first
   interactive state change. Evidence scales with class: C2-C3 record the observation in
   the attestation narrative; C4 (STRICT) additionally persists the screenshot to the
   devlog. The render observation is valid `checkOutput` evidence for C->D and the `did`
   must reference it. Excluded: pure logic/config/prose covered by its own test suite.
   (Adopted 2026-07-05 from fablize verification-grounding; devlog
   `260705_pabcd_render_grounding`.)

   **DEFAULT (C-ACTIVATION-GROUNDING-01):** The conditional-path sibling of render
   grounding. When the work-phase adds or changes a code path that only runs under a
   trigger condition absent from the default/happy path — error handlers, fallbacks,
   retries, caches, guards, feature-gated branches, mode switches, migration/upgrade
   handlers, "from turn/size/load X" behaviors — C MUST include activation evidence
   before C->D: (1) **TRIGGER** the condition for real (a test or scenario that drives
   it, a fixture that crosses the threshold, a fault injection); (2) **OBSERVE** the
   new path execute with its intended effect (a hit test assertion, log/debug line,
   counter, or trace — read back, not just produced); (3) **FIX** and re-trigger if the
   observation contradicts intent. "All tests green" does not satisfy this rule when no
   test drives the trigger; a branch nobody can show firing is unverified regardless of
   suite status. Two loud signals that mandate this check retroactively: a change whose
   observable output is byte-identical to the baseline everywhere (presume the path is
   dead, instrument before concluding "no effect"), and a D-summary claim of
   "handled/defended/falls back" with no fired-path artifact behind it. The activation
   observation is valid `checkOutput` evidence for C->D and the `did` must reference
   it. Excluded: unconditional straight-line changes fully exercised by existing
   coverage. P names the activation scenario for each such path when planning it, and
   the A reviewer checks that every planned conditional path has one (see phase P/A).
   For score-optimization loops the specialized forms LOOP-MECHANISM-PROOF-01 /
   LOOP-RESIDUAL-TRACE-01 apply on top. (Grounded 2026-07-06: a contest bot's endgame
   branch shipped inside a passing combo while structurally unreachable — its solo
   ablation was baseline-exact and no gate asked "did it fire?"; devlog
   `260706_loop_mechanism_research`.)
5. **D — Done**: Summarize what was checked with evidence, update STATUS/devlog, commit, and confirm no pending work remains for this work-phase before returning to idle. For loop/multi-pass work, **LOOP-PESSIMIST-01 (DEFAULT)** also records what did not improve, which hypothesis died, and what evidence would show the current direction is wrong; D -> IDLE -> P is a context/bias-flush boundary, so the next cycle resumes from disk artifacts rather than transcript momentum.

## Work-Phase Loop (multi-pass tasks)

**Terminology**: a *work-phase* is one outcome slice of the goal (e.g. "Phase 3: Management API"); a *PABCD-phase* is one letter P/A/B/C/D of a single cycle. They are not the same. Work-phases need not be slices of one feature: successive cycles in the SAME session may target completely different features or plans under the same goal (LOOP-UNIT-CHAIN-01, `cxc-loop`).

**Invariant — one work-phase = one full PABCD cycle.** Run P→A→B→C→D for a work-phase, close D (state → IDLE), then start the next work-phase at P. Do NOT run B for several work-phases back-to-back, and do NOT commit a work-phase straight out of B without passing C and D.

### Implementation-Unit Documents

Full documentation routine (P concretizes the docs, A audits them as a hard gate, D
archives to `_fin/`, plus the mainstream design-doc/RFC translation table):
`dev-scaffolding/references/implementation-log.md`.

**Difflevel roadmap plan (STRICT, DIFFLEVEL-ROADMAP-01):** for any multi-phase unit
(2+ work-phases), the FIRST P — or the dedicated design-only Phase-0 pass — must
deliver the entire roadmap concretized: `000_plan.md` (objective, constraints,
dependency-ordered work-phase map) PLUS every phase's decade doc written to full
diff-level precision (exact paths, NEW/MODIFY/DELETE, before/after diffs) — each one
a copy-paste-executable PRD, not an outline. Scaffolding empty decade files to "fill
per cycle" does NOT satisfy this rule. Each later cycle's P starts from its
pre-written doc: re-verify it against the current codebase (stale check — earlier
phases may have moved lines, signatures, or files), amend the doc, then execute.
LOOP-CONTINUITY-01 applies on top.

**Lexicographic separation (STRICT, LEXICO-SPLIT-01):** every document in a unit
carries a numeric lexicographic prefix — bare semantic filenames (`PLAN.md`,
`DIFF_PLAN.md`, `PHASES.md`, `RCA.md`, an unnumbered `mvpplan/`-style folder) are an
A-phase FAIL, not a style nit. Research/spec material (000-range) and implementation
phase designs (decade ranges) are SEPARATE documents: no diffs inside a research
doc, no survey prose padding a phase doc — a document that mixes both fails the
audit.

**Unit residence (STRICT, UNIT-RESIDENCE-01):** every piece of development work
belongs to an implementation unit (`devlog/_plan/YYMMDD_slug/`). Ceremony scales
with class (PABCD Depth by Work Class below); residence does not. C0-C1 fast-path
work skips the PABCD ceremony but MUST leave a numbered record doc in its owning
unit — next free index in the matching decade, e.g. `040_hotfix_dropdown_crash.md`
— stating what changed, why the fast path applied (class call), and the
verification evidence. No owning unit → create a minimal unit folder holding only
that record. Interview settles residence before P (Interview Trigger above).

Devlog plan artifacts use decade-range numbering to separate concerns:

| Range | Purpose | Examples |
|-------|---------|----------|
| 000-009 | Research, specs, MOC | `000_plan.md`, `001_api_survey.md`, `002_competitor_analysis.md` |
| 010-019 | Phase 1 | `010_phase1_auth_module.md`, `011_phase1_db_schema.md` |
| 020-029 | Phase 2 | `020_phase2_frontend.md` |
| 030-039 | Phase 3 | ... |

Rules:
- 000-range durable research is **mandatory for C4**, and for C3 only when state must persist
  across turns/agents, public contract or architecture decisions need durable audit, or the
  repo already uses devlog planning for that task; optional for C0-C2 and
  low-persistence C3 (a response-level plan is enough — but the work still leaves its
  numbered record in a unit, UNIT-RESIDENCE-01).
- Default: sequential within decade (`000`, `001`, `002`...).
- Overflow (>10 docs in a range): use sub-index (`000_0_name.md`, `000_1_name.md`).
- NEVER use bare filenames like `PLAN.md`, `DIFF_PLAN.md`, `PHASES.md`, `RCA.md`.
- This repo uses 3-digit prefixes (`000_`, `010_`, `020_`). Do not mix with 2-digit.

**Loop / multi-pass tasks**: a "loop"/"루프" request (or work too large for one cycle) runs
as MULTIPLE PABCD passes — one per work-phase. Pre-plan the full slice map and WRITE
all per-phase decade docs (010_phase1, 020_phase2, ...) to diff-level up front
(DIFFLEVEL-ROADMAP-01) — scaffolding empty files is not pre-planning. Each
later cycle's P re-verifies its pre-written doc against the current codebase and
amends it before building. The first pass MAY be a design-only PABCD pass (Phase 0):
a code-free whole-system design/documentation cycle that produces exactly this
difflevel roadmap before the first implementation work-phase.
The slice map is APPEND-friendly (LOOP-UNIT-CHAIN-01): an independent unit discovered
mid-loop — including a feature unrelated to the current slice — becomes a NEW
work-phase appended to the map/goalplan via a P-phase amendment, then runs as the next
cycle in the same session. "This needs its own PABCD" is a plan statement, never a
reason to close the goal or wait for a new session.

HITL and goal PABCD may both use `cxc-loop` divergence/collapse. In HITL, the agent
may choose divergence deliberately during I/P when intent is open, algorithmic direction
is uncertain, the objective is maximize/deceptive, or the user asks for alternatives.
In goal mode, the shipped automatic entry is the plateau Stop directive after recorded
non-improving metrics. Either way, record N>=2 grounded candidates, choose early
collapse at P for satisfy-spec work or late collapse at D for deceptive metrics, and
keep all candidate provenance in `.codexclaw/divergence/`. The agent still owns every
phase transition; no hook builds or races candidates automatically, and HITL P/A/B
pauses remain real confirmation points.

**Faithful execution (anti-skip)**: do the real work of each PABCD-phase — P writes the real diff-level plan, A really dispatches the audit, B really implements AND verifies, C really runs tsc/tests/scrutiny, D really summarizes with evidence. Advancing the state is NOT the same as doing the phase; never rubber-stamp a phase to move on.

**Native plan tracker (PLAN-TRACK-01)**: mirror the plan's work items into the native
`update_plan` tool at P and keep statuses current through B — the harness renders it as
live progress. `update_plan` is the visibility surface, not the plan itself; the
diff-level plan document remains the SSOT, and updating the tracker never substitutes
for a phase's real work.

### Optimization-Loop Meta-Rules (plateau discipline)

These rules apply when PABCD is used for score/objective-maximization, repeated
candidate search, or any loop where D discards variants based on evidence. They are
grounded in a real 14-discard plateau where a prefix-only replay gate and hard
draw-protection invariant locked a 3.5/8 score. Single-incident induction — treat the
constants as starting values and revise when a second domain's evidence contradicts them.

- **LOOP-PHASE-DEATH-01 (DEFAULT):** Track each discarded candidate by the P/A/B/C/D
  phase that killed it and by change class: `parameter-tweak`, `branch-toggle`,
  `state-space redesign`, or `evaluator change`. After three consecutive deaths with
  the same killing phase and same class (starting value N=3 — HEURISTIC, tune per domain), the next work-phase targets the killing
  mechanism itself, usually the evaluation gate, instead of another candidate in that
  class. Consecutive D-evidence collapses mean the gate may be the bottleneck.
- **LOOP-CONTINUITY-01 (STRICT):** P begins by quoting the previous cycle's D
  conclusions and next-direction. A new candidate that contradicts that recorded
  direction needs an explicit reason, so the loop does not re-run rejected candidate
  classes from amnesia.
- **LOOP-CANDIDATE-ANCHOR-01 (DEFAULT):** For score/objective-maximization work,
  source divergence candidates from domain-state evidence: logs, trajectories,
  opponent/instance analysis, and failure states. If every candidate is a threshold,
  guard, or suppression tweak on existing code levers, that is parameter-space
  anchoring; regenerate candidates from the state space.
- **LOOP-INSTANCE-CHECK-01 (HEURISTIC):** Check whether evaluation instances are fixed
  and enumerable: fixed opponents, fixed test maps, fixed graders. If yes,
  per-instance specialization, such as fingerprint plus playbook, is a legitimate
  evaluable widening move and should be considered before generic-strategy tweaks.
- **LOOP-MECHANISM-PROOF-01 (DEFAULT):** A candidate whose value is a new
  branch/mechanism must carry activation evidence from the instances it targets — a
  counter, debug line, or trace showing the branch actually FIRED — before adoption.
  Aggregate score movement is not activation proof: in a multi-feature combo, a dead
  mechanism hides behind the other features' gains. The loud special case is a
  zero-delta ablation: if the single-feature candidate scores exactly baseline on the
  instances it was built to flip, presume the mechanism never ran and instrument
  before combining or discarding. (Grounded: an endgame HP-race branch shipped inside
  a 7.5-scoring combo while its bank leaked to 0 every turn; the solo ablation had
  shown baseline-exact 1.5 and was not investigated until an external bot won the
  same battle by hand.)
- **LOOP-RESIDUAL-TRACE-01 (DEFAULT):** A residual failure carried through D needs a
  mechanism-level explanation (which branches fired, which did not, and why the
  outcome followed) or the explicit label `unexplained`. A plausible story about the
  opponent/environment ("the enemy also stalls, so it stays a draw") is not an
  explanation unless the trace confirms our own relevant mechanism armed and acted.
  LOOP-PESSIMIST-01's D record quotes this trace, not the story.
- **LOOP-PEER-CONTRAST-01 (HEURISTIC):** When an external artifact — a peer's bot, a
  reference solution, a competitor run — achieves the objective on the same fixed
  instance we fail, the next generation's first analysis deliverable is a behavioral
  diff of the two traces (what they did that we did not), before any new candidate.
  This is the cheapest capability-gap detector available and outranks another round
  of parameter candidates (LOOP-CANDIDATE-ANCHOR-01).
- **LOOP-FANOUT-TIMING-01 (HEURISTIC):** Spend parallel fan-out late, not early.
  While coarse levers still move the metric, stay single-track (N=1); once coarse
  levers stabilize or plateau and the search shifts to fine-grained candidates,
  parallel candidate lanes and specialist re-derivation start paying for their
  cost. Fan-out also buys outcome consistency (cross-run variance reduction), not
  only peak score. (Adopted 2026-07-07 from Sakana Fugu, arXiv:2606.21228:
  orchestration gains on a 123-experiment autonomous training loop concentrated
  after mid-run, once coarse configuration search gave way to fine
  optimizer/schedule tuning.)
- **COLLAPSE-AGGREGATOR-01 (DEFAULT):** collapse and synthesis ownership follows
  the disputed crux. When parallel candidates disagree, the synthesis verdict comes
  from whoever is strongest on the domain of the disagreement — dispatch a
  crux-matched aggregator when the collapse owner is not (the aggregator returns a
  verdict; the main session still owns the collapse decision). A fixed aggregator
  caps the exercise at that aggregator's own ceiling for the domain. The collapse
  record names each candidate's partial correctness, each candidate's failure
  mode, and why the winner's evidence resolves the crux.

Evaluation gates for these loops are owned by `cxc-dev-testing` §Limited-Oracle /
Score-Objective Evaluation; apply both sections together.

## PABCD Depth by Work Class

| Class | Plan (P) | Audit (A) | Build (B) | Check (C) | Record (D) |
|-------|----------|-----------|-----------|-----------|------------|
| C0-C1 | None/inline | Optional | Direct fix | Smallest proof | One-line summary as a numbered record doc in the owning unit (UNIT-RESIDENCE-01) |
| C2 | Compact plan | Micro-audit | Implement + focused tests | Targeted gate | Summary |
| C3 | Compact or full plan depending on persistence/risk | Required when public contract, architecture, persistence, or cross-session risk exists; otherwise focused audit | Implement; use a reviewer subagent when useful | Affected suite + docs consistency when contracts changed | Summary + evidence; durable record only when state must persist |
| C4 | Full PABCD plan (mandatory) | Required, independent reviewer | Implement; independent verification | Full relevant gates | Durable risk/approval/evidence record |
| C5 | Interview/research first | — | — | — | Reclassify, then follow the new class |

See `dev` §0.0 for the full class definitions and tie-break rules.

## Delegation Model (subagents)

## Loop Engineering (§11)

Full rules live in `references/loop-engineering.md`. Key rules:

- **§11.1 Loop values:** feedback must change the next action (otherwise it is a retry);
  the verifier outranks the prompt; memory lives on disk; budget exhaustion != done;
  context pressure != budget exhaustion (compaction is survivable by design — checkpoint
  durable state and continue; "context is getting large" never justifies closing a goal).
- **§11.2 Terminal-state vocabulary:** D reports one of DONE / NOOP / BLOCKED / UNSAFE /
  NEEDS_HUMAN / BUDGET_EXHAUSTED. These are report states, not FSM states.
- **§11.3 Repair-loop discipline (LOOP-REPAIR-01):** 2 consecutive same-failure repairs ->
  root-cause mode; 3 -> replan or Interview return. (LOOP-DOOM-01: 3 attestation failures
  in the same phase -> force Interview return.)
  (REVIEW-SYNTHESIS-01: after a reviewer FAIL, record a synthesis — per-blocker RCA,
  cross-blocker conflicts, accept/rebut decisions — before re-patching or re-dispatching;
  synthesis-free re-dispatch counts as a failed repair. E7 guidance.)
- **§11.4 Loop archetype (LOOP-ARCHETYPE-01):** classify as spec-satisfaction (repair loop
  converges) vs open-ended optimization (explore-and-select loop — repair loops plateau).
  A repair loop on an optimization problem is a category error.
- **§11.4a Analysis-before-regeneration (LOOP-REANALYZE-01):** every generation in an
  explore-and-select loop MUST begin with an analysis deliverable, not a patch.
- **§11.5 Unattended-loop resource policy:** goal-mode loops must state tool/credential
  scope, token/cost budget, and wall-clock bound. C4 + unstated scope = ESCALATE.
- **§11.6 Continuation doctrine (LOOP-CONTINUE-01):** do not redefine the objective
  downward; audit completion against repo state, not memory; read durable state first;
  IDLE is not the end while work remains — start the next work-phase at P. Work-phases
  chain HETEROGENEOUS units in one session (LOOP-UNIT-CHAIN-01): an independent feature
  discovered mid-loop is appended to the plan and started at P, not deferred to a new
  session or used to justify closing the goal.
- **§11.7 Divergence/collapse:** convergence-first default. Mode for optimization
  archetype only. Enter deliberately (HITL I/P) or on plateau (HOTL). Collapse early
  for spec work, late for metric work. Turn off after resolution. Full rules in
  `cxc-loop` skill.

## Catalog Discovery routing

Interview sub-modes and Catalog Discovery rules live in `$cxc-interview`
(INTERVIEW-CATALOG-01, CATALOG-DESIGN-FIRST-01). The option ontology YAML lives at
`references/catalog-discovery.yaml` in this skill directory.

- **Tool-surface discovery (DISPATCH-DISCOVER-01):** V1 is codexclaw's default surface, but the model catalog pins sol/terra to V2 and luna to V1; `features.multi_agent_v2` selects V2 only for fallback models. The surface pins on the session's first turn. V1 uses the deferred `multi_agent_v1.*` namespace behind `tool_search`; V2 exposes `spawn_agent` (task_name + message required, `fork_turns:"none"` for role dispatches) / `send_message` / `followup_task` / `wait_agent` / `interrupt_agent` / `list_agents` directly. If `spawn_agent` is not visible, run `tool_search` for "spawn agent" FIRST; do not conclude dispatch is impossible (`structure/60_native_capabilities.md` §1).
- The main agent owns the plan and the build by default. Subagents (`spawn_agent`) are scoped helpers.
- **Lifecycle patterns (both surfaces):** fan out before waiting. V2 `wait_agent` is a no-content mailbox; reuse with `followup_task(task_name)`, deliver context-only with `send_message`, and stop a runaway turn with `interrupt_agent`. V1 `wait_agent` returns final status plus content; reuse with `send_input(agent_id)`, and use `close_agent`/`resume_agent` for retirement/restoration. Concurrency is V1 `agents.max_threads` (default 6) versus V2 `max_concurrent_threads_per_session` (default 4, root included). Independent tool calls batch through `multi_tool_use.parallel`.
- **Leaf topology (LEAF-TOPOLOGY-01, 260709):** subagents are star-topology LEAVES. The spawn hook applies D1 denial and the `[CXC-LEAF-GUARD]` block on both surfaces; grant recursion ONLY deliberately, per dispatch, with `CXC-SUBSPAWN-ALLOWED`. When the caller omits model or `reasoning_effort` on a non-full-history fork, the hook independently injects the configured role values from `.codexclaw/subagents.json`; otherwise each omitted field inherits from the parent. Full-history forks are V1 `fork_context:true` and V2 omitted/`"all"` `fork_turns`.
- CSV batch fan-out (`spawn_agents_on_csv` + `report_agent_job_result`, one worker per row) exists in codex-rs but is flag-gated (`enable_fanout`, not live) — do NOT instruct it until the flag ships; check `structure/60_native_capabilities.md` §4.
- Use a reviewer subagent at the A gate (and the C gate for C3/C4) to challenge the plan/implementation independently — receive the verdict, act on it, continue. Subagents are verifiers and scoped workers, not approval gates.
- When delegating writes, give each subagent a disjoint write scope (own files/dirs) so parallel work never collides; tell it the other agents exist and not to revert their edits.
- **DISPATCH-ISOLATION-01 (DEFAULT):** parallel subagents in the same work-phase are
  context-isolated on the read side too: the TASK packet's `SCOPE` names an explicit
  access list — which prior outputs (paths or pasted excerpts) this agent may read —
  and nothing else from peer lanes is shared. Never paste one lane's in-progress
  output into another outside the access list; the first finished trajectory
  otherwise steers later lanes into redundant agreement (orchestration collapse) and
  the parallelism buys nothing. Durable cross-cycle artifacts (devlog, D summaries,
  `.codexclaw/divergence/`) stay shared; widening an access list is a stated
  decision in the packet. (Adopted 2026-07-07 from the Sakana Fugu
  learned-orchestrator report, arXiv:2606.21228, together with SPECIALIST-CRUX-01,
  REVIEW-DECORRELATE-01, COLLAPSE-AGGREGATOR-01, and LOOP-FANOUT-TIMING-01; devlog
  `260707_fugu_orchestration_adoption`.)
- **SPECIALIST-CRUX-01 (HEURISTIC):** when P or A identifies a narrow crux outside
  the builder's domain — a derivation, a protocol subtlety, a domain constant, a
  security property — dispatch a specialist to re-derive that crux from first
  principles before merging the work that depends on it. The specialist's return
  names its assumptions, the derivation or trace, and the exact decision its
  verdict changes.
- **REVIEW-DECORRELATE-01 (HEURISTIC):** `spawn_agent` accepts a model override —
  run the A-gate reviewer (and any §11.3 clean-slate re-examination after repeated
  failed repairs) on a different model family than the one that produced the plan
  or build. Same-family reviewers share blind spots; decorrelating the reviewer is
  the cheapest independence upgrade available.
- Never let a subagent reconstruct the plan from a short task description — pass the concrete plan and scope explicitly.
- For long-running external verification (CI, deploy, remote build), spawn a background subagent and poll with short `wait_agent` cycles. Local builds/tests that finish in minutes stay blocking.

**Subagent TASK packet (DISPATCH-TASK-01).** Every dispatch carries a structured task, not a
one-liner: `TASK` (the concrete outcome), `SCOPE` (the disjoint write set / read bounds),
`MUST DO`, `MUST NOT` (e.g. do not revert peers, do not widen scope), `PROOF` (the evidence to
return — `path:line` + command output), and `RETURN FORMAT`. Put the packet in the spawn
message always. Skill attachment travels as resolvable mentions in the message: prefer
link-form `[$cxc-<skill>](skill://<abs SKILL.md path>)`, or use plugin-native
`$codexclaw:cxc-<skill>` when a link is unsafe. V1 parses either form on the child's first
turn. Upstream V2 does not parse inter-agent skill mentions, so the spawn hook inlines
the full bodies for recognized cxc mentions on V2-shaped spawns. The hook also normalizes
known broken/bare mentions on both surfaces, but does not add role baselines or infer
missing surfaces. Manually supplied structured V1 `items` remain the strongest form where
available; `resolveSpawnPayloadWithSkills` emits message mentions, not `items`. Do not delegate
host-goal changes to subagents; the main session owns `create_goal`/`update_goal`.

## State

- `.codexclaw/sessions/<sessionId>.json` — current phase (IDLE/I/P/A/B/C/D), derived flags, injection dedupe, and bounded interview tracker.
- `.codexclaw/ledger.jsonl` — append-only audit trail of transitions.
- `.codexclaw/interviews/<sessionId>.jsonl` — shipped append-only Interview Q/A capture (and scan-evidence) ledger, written by the PostToolUse `request_user_input` hook.

## Repository Root

Determine the actual working repository root before planning (resolve via `pwd -P` from the target repo, or the project root the harness injects). Resolve all relative paths (`src/...`, `tests/...`) against it. If the root is ambiguous, ask before proceeding.

## Notes

- This skill is the human-readable guide; the `pabcd-state` hook handles trigger detection, directive injection, and continuation.
- Control surfaces are merged above in "Phase Control / Orchestrate"; the Stop hook runs the bounded continuation loop under an active goal (see `cxc-loop`).
- Provenance: the L4 phase shipped the `dev`/`dev-*` and `pabcd` skill directories as activation shells only — frontmatter plus router stubs that proved the Codex loader shape. The real discipline content (this PABCD guide and the universal `dev` hub) was supplied later by the L12 real-content port; treat any remaining stub-era phrasing as superseded by the current body.
