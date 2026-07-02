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
  (or running `cxc orchestrate I`). The breadth lives in agent judgment, not in a regex.

Either way, once in Interview cover the four dimensions (Goal, Constraint, Success
criteria, Ontology), research the repo before asking, and confirm requirements before
Plan. **INTERVIEW-CLASSIFY-01 (DEFAULT):** before P, settle both the work class
(`dev` §0.0) and the loop archetype (`cxc-loop` LOOP-ARCHETYPE-01) by asking whether
the verifier defines done or only better; discovering the archetype mid-loop is an
Interview miss, not a Build problem.

The discoverable `cxc-interview` skill is the explicit I-phase entry surface. In
continuous Interview mode, the main session owns user questions and records; subagents
only return contradiction or question candidates.

Do NOT:
- Ask scattered clarifying questions while pretending to already be planning.
- Skip Interview and jump to Plan for genuinely unclear requests.
- Start implementing during Interview.

## How It Works

PABCD is a forward progression with Interview return.

```
IDLE ──→ P ──→ A ──→ B ──→ C ──→ D ──→ IDLE
         │      │      │
        gate   gate   gate
         └──────┴──────┴────→ I (Interview, context preserved)
```

You can return to Interview (I) from any phase to clarify requirements; the plan and audit context are preserved. Phases P, A, B pause for confirmation in interactive use; C and D proceed once their work is genuinely done. In goal mode the loop self-advances (see `goal`/`create_goal`), but the P→D sequence is never skipped. Goal mode is PABCD-only: while a goal is active the Interview NEVER fires — entry is suppressed and `request_user_input` is hard-denied, so the Interview is HITL-only and runs only with no active goal.

### Loop / goal activation handoff

`cxc-loop` depends on this skill; it does not replace it. A loop request first activates
PABCD, then chooses HITL or HOTL:

- **HITL PABCD:** enter I or P explicitly (`cxc orchestrate I|P` or the chat
  free-pass surface). No active goal is required, and P/A/B pause for the human.
- **HOTL goal PABCD:** the main session must create or reuse an ACTIVE host goal
  (`create_goal` / `get_goal`) and start a PABCD cycle (`cxc orchestrate P`). The
  Stop-continuation hook arms only when both are true: active host goal AND
  non-IDLE PABCD cycle. Do not call this mode active if one half is missing.
- Subagents may inspect or verify the plan, but the main session owns host-goal
  lifecycle (`create_goal`/`update_goal`) and PABCD transitions.

## Phases

These align with the directives the `pabcd-state` hook injects per phase:

0. **I — Interview**: Clarify requirements before planning across the four dimensions. Research the repo first, then ask focused questions. No implementation yet.
1. **P — Plan**: Explore first (read real code, configs, docs). Write a diff-level plan: file change map, scope boundary (IN/OUT), and testable accept criteria. For C2+ plans, begin with a loop-spec header: Loop archetype; Trigger; Goal (user-visible outcome); Non-goals; Verifier (command/gate and what it measures); Stop condition; Memory artifact; Expected terminal outcomes; Escalation condition. HOTL goal plans also state the `cxc-loop` HOTL resource bounds. For open-ended optimization, include the divergence plan, deterministic selection rule, and telemetry schema; if the verifier only reports scalar outcome, instrumentation is B's first work item before candidates. Ground every decision in code you have read. No implementation yet. For broad or unfamiliar repos, include a compact tree, detected conventions, and which existing logs/docs you will reuse.
2. **A — Audit**: Adversarial, read-only review of the plan against the real codebase. Dispatch an independent reviewer (`spawn_agent`) — even a small/mini-model one — to challenge assumptions, find blockers (rollback gaps, missing callers, phantom constants), and verify references. Fold fixes back into the plan and record the verdict. No code changes. The `A>B` attest structurally requires `auditOutput` (the pasted tail of the reviewer's verdict) — a form-only bar: silently skipping the paste fails the gate, but the gate cannot verify the paste's provenance, so faithful execution (really dispatching the reviewer) remains the agent's obligation.
3. **B — Build**: Implement the audited plan in small atomic commits. Verify as you go. Stay inside the plan's scope boundary; surface deviations instead of silently expanding scope.
4. **C — Check**: Run the real verification — build, typecheck, and targeted tests, plus adversarial review. Capture fresh command output as evidence. Do not claim pass without artifact-level proof.
5. **D — Done**: Summarize what was checked with evidence, update STATUS/devlog, commit, and confirm no pending work remains for this work-phase before returning to idle. For loop/multi-pass work, **LOOP-PESSIMIST-01 (DEFAULT)** also records what did not improve, which hypothesis died, and what evidence would show the current direction is wrong; D -> IDLE -> P is a context/bias-flush boundary, so the next cycle resumes from disk artifacts rather than transcript momentum.

## Work-Phase Loop (multi-pass tasks)

**Terminology**: a *work-phase* is one outcome slice of the goal (e.g. "Phase 3: Management API"); a *PABCD-phase* is one letter P/A/B/C/D of a single cycle. They are not the same.

**Invariant — one work-phase = one full PABCD cycle.** Run P→A→B→C→D for a work-phase, close D (state → IDLE), then start the next work-phase at P. Do NOT run B for several work-phases back-to-back, and do NOT commit a work-phase straight out of B without passing C and D.

**Loop / multi-pass tasks**: a "loop"/"루프" request (or work too large for one cycle) runs as multiple PABCD passes — one per work-phase. Pre-plan the full slice map and scaffold per-phase decade docs (10_phase1, 20_phase2, ...) up front. The first pass MAY be a design-only PABCD pass (Phase 0): a code-free whole-system design/documentation cycle before the first implementation work-phase.

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

Evaluation gates for these loops are owned by `cxc-dev-testing` §Limited-Oracle /
Score-Objective Evaluation; apply both sections together.

## PABCD Depth by Work Class

| Class | Plan (P) | Audit (A) | Build (B) | Check (C) | Record (D) |
|-------|----------|-----------|-----------|-----------|------------|
| C0-C1 | None/inline | Optional | Direct fix | Smallest proof | One-line summary |
| C2 | Compact plan | Micro-audit | Implement + focused tests | Targeted gate | Summary |
| C3 | Compact or full plan depending on persistence/risk | Required when public contract, architecture, persistence, or cross-session risk exists; otherwise focused audit | Implement; use a reviewer subagent when useful | Affected suite + docs consistency when contracts changed | Summary + evidence; durable record only when state must persist |
| C4 | Full PABCD plan (mandatory) | Required, independent reviewer | Implement; independent verification | Full relevant gates | Durable risk/approval/evidence record |
| C5 | Interview/research first | — | — | — | Reclassify, then follow the new class |

See `dev` §0.0 for the full class definitions and tie-break rules.

## Delegation Model (subagents)

- **Deferred-tool trap (DISPATCH-DISCOVER-01):** the collab tools are `multi_agent_v1.spawn_agent` / `wait_agent` / `send_input` / `resume_agent` / `close_agent`, and on the live runtime they may NOT appear in your visible tool list — they are deferred behind `tool_search`. If `spawn_agent` is not visible, run `tool_search` for "spawn agent" FIRST; do not conclude dispatch is impossible (`structure/60_native_capabilities.md` §1).
- The main agent owns the plan and the build by default. Subagents (`spawn_agent`) are scoped helpers.
- **Lifecycle patterns:** fan out by spawning N agents then ONE `wait_agent` on all their ids (not N sequential waits); steer or interrupt a running agent with `send_input`; `resume_agent` reopens a closed agent with its context intact (cheaper than respawning for follow-ups); `close_agent` shuts down the agent AND its spawn subtree. Independent tool calls batch through `multi_tool_use.parallel`.
- CSV batch fan-out (`spawn_agents_on_csv` + `report_agent_job_result`, one worker per row) exists in codex-rs but is flag-gated (`enable_fanout`, not live) — do NOT instruct it until the flag ships; check `structure/60_native_capabilities.md` §4.
- Use a reviewer subagent at the A gate (and the C gate for C3/C4) to challenge the plan/implementation independently — receive the verdict, act on it, continue. Subagents are verifiers and scoped workers, not approval gates.
- When delegating writes, give each subagent a disjoint write scope (own files/dirs) so parallel work never collides; tell it the other agents exist and not to revert their edits.
- Never let a subagent reconstruct the plan from a short task description — pass the concrete plan and scope explicitly.
- For long-running external verification (CI, deploy, remote build), spawn a background subagent and poll with short `wait_agent` cycles. Local builds/tests that finish in minutes stay blocking.

**Subagent TASK packet (DISPATCH-TASK-01).** Every dispatch carries a structured task, not a
one-liner: `TASK` (the concrete outcome), `SCOPE` (the disjoint write set / read bounds),
`MUST DO`, `MUST NOT` (e.g. do not revert peers, do not widen scope), `PROOF` (the evidence to
return — `path:line` + command output), and `RETURN FORMAT`. Put the packet in the spawn
message always. Skill attachment travels as **$cxc mentions in the message** — plain
`$cxc-<skill>` or link-form `[$cxc-<skill>](skill://<abs SKILL.md path>)` — which the child's
first turn parses and injects as full SKILL.md bodies. This works on BOTH spawn surfaces
(`message` is a shared field; v2's `deny_unknown_fields` only blocks the extra `items` key),
and the always-on `^spawn_agent$` PreToolUse hook prepends link-form mentions for the role
baseline + inferred surfaces when the message lacks them. Structured v1 `items` (via
`resolveSpawnPayloadWithSkills`, L15) remains the strongest form where available; the hook
no-ops when `items` is present (`structure/10_subagent_skill_routing.md`). Do not delegate
host-goal changes to subagents; the main session owns `create_goal`/`update_goal`.

## State

- `.codexclaw/sessions/<sessionId>.json` — current phase (IDLE/I/P/A/B/C/D), derived flags, injection dedupe, and bounded interview tracker.
- `.codexclaw/ledger.jsonl` — append-only audit trail of transitions.
- `.codexclaw/interviews/<sessionId>.jsonl` — shipped append-only Interview Q/A capture (and scan-evidence) ledger, written by the PostToolUse `request_user_input` hook.

## Repository Root

Determine the actual working repository root before planning (resolve via `pwd -P` from the target repo, or the project root the harness injects). Resolve all relative paths (`src/...`, `tests/...`) against it. If the root is ambiguous, ask before proceeding.

## Notes

- This skill is the human-readable guide; the `pabcd-state` hook handles trigger detection, directive injection, and continuation.
- Control surfaces (all shipped): chat `orchestrate <phase|status|reset>` is the human free-pass path; the terminal `cxc orchestrate <phase> [--attest <json>]` CLI is the attest-gated agent path; every injected directive carries an `IPABCD: <phase>` footer; and the Stop hook runs the bounded continuation loop under an active goal (see `cxc-loop`/`cxc-goalplan`).
- Provenance: the L4 phase shipped the `dev`/`dev-*` and `pabcd` skill directories as activation shells only — frontmatter plus router stubs that proved the Codex loader shape. The real discipline content (this PABCD guide and the universal `dev` hub) was supplied later by the L12 real-content port; treat any remaining stub-era phrasing as superseded by the current body.
