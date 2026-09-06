---
name: cxc-pabcd
description: "Use for class-scaled Plan-Audit-Build-Check-Done work. Explicit explanation, interview, plan-only, and read-only limits win; loading the skill does not activate a loop. Triggers: PABCD, plan this, 기획, 단계별로, 요구사항 정리."
metadata:
  last-verified: "2026-07-02"
  short-description: "Codex-native PABCD loop (Interview/Plan/Audit/Build/Check/Done) with class-scaled depth."
---

# PABCD Workflow

A Codex-native reimplementation of the IPABCD development loop (Interview + Plan / Audit / Build / Check / Done). There is no external orchestrator server. State lives in `.codexclaw/sessions/<sessionId>.json` plus `.codexclaw/ledger.jsonl`; transitions are driven by the `pabcd-state` hook component, the chat-side `cxc-orchestrate` surface (human free-pass), and the live `cxc orchestrate` terminal CLI (agent-gated).

> **C0/C1 work (small in-place patches):** See `dev` §0.0 Work Classifier and §0.1 Patch Fast-Path first — full PABCD is mandatory for C4 and conditional for C3, never the baseline for every task.

## Intent boundary

Loading this skill is not authority to execute phases. Explanation, review,
interview-only, plan-only, read-only, no-goal, no-FSM, and no-delegation limits win.
Use the requested method only within that scope. An operative bare cxc-loop
request selects scoped HOTL through cxc-loop; ordinary PABCD use does not.
cxc-dev is canonical for work class, C0/C1 fast-path, proof, and safety.

## Interview Trigger

Two distinct things, do not conflate them:

- **Hook hint (narrow):** `UserPromptSubmit` detects `interview` / `인터뷰`
  and other existing lexical phase hints and injects scoped advice only. Natural
  hints never enter or advance a phase. A line-anchored `orchestrate i` command
  instead takes the existing explicit-command parser path.
- **Agent judgment (broad):** for unclear requirements phrased otherwise, select
  `cxc-interview` and its applicable references. Loading a skill is not a state
  transition. When phase entry is authorized, use `cxc orchestrate I --session <id>`
  with the current SessionStart binding; explicit user commands are also supported.

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

Before an authorized state-control action read
[Phase control](references/phase-control.md). It owns the chat/CLI distinction,
SESSION-IDENTITY-01, ORCH-ARTIFACT-01, ATTEST-SHAPE-01, Windows attest-file usage,
and every edge's required keys. Entry edges are not the four gated work edges.
Do not claim a phase from narration; do its work and record the real transition.
Goal activation and scoped continuation are owned by [cxc-loop](../loop/SKILL.md).

## Phases

For tool composition, response projection, or in-context JS computation during
phase work, use [native execution](../dev/references/native-execution.md).
This selects an available execution path, never a phase or new authority.

Read only the current phase's detailed owner before doing its work. A reference
link is a conditional routing edge, not a command to preload the entire graph.

| Phase / trigger | Mandatory owner before work |
|---|---|
| I | cxc-interview; no active host goal |
| P, including plan-only | [Plan phase](references/phase-plan.md); C2+ plans also read [Plan output](references/plan-output.md) |
| A, if authorized | [Audit phase](references/phase-audit.md) |
| C | [Check phase](references/phase-check.md) |
| P/A specifying render or conditional-path verification | [Check phase](references/phase-check.md), to define reachable activation and observable evidence |

P explores and plans without implementing; PHASE-SPLIT-01 and the diff-level
contract apply. A actually audits, folds/rebuts blockers, and re-audits; only pass
or justified near-pass exits. C requires fresh relevant proof and SoT sync;
passing unrelated checks is not evidence. Explicit execution restrictions are not
overridden by a reference asking to run a verifier or dispatch a reviewer.

3. **B — Build**: Implement the audited plan in small atomic commits (DEV-GIT-COMMIT-01). Verify as you go. Stay inside the plan's scope boundary; surface deviations instead of silently expanding scope. Never push to a remote without explicit user approval (DEV-GIT-PUSH-01, ESCALATE). When P declared a stack, follow `DEV-STACK-02` in `cxc-dev` `references/stacked-prs.md`.
5. **D — Done**: Summarize what was checked with evidence, update STATUS/devlog, commit (local only — pushing remains gated by DEV-GIT-PUSH-01), and confirm no pending work remains for this work-phase before returning to idle. For loop/multi-pass work, **LOOP-PESSIMIST-01 (DEFAULT)** also records what did not improve, which hypothesis died, and what evidence would show the current direction is wrong; D -> IDLE -> P is a context/bias-flush boundary, so the next cycle resumes from disk artifacts rather than transcript momentum.

## Work-Phase Loop (multi-pass tasks)

**Terminology**: a *work-phase* is one outcome slice of the goal (e.g. "Phase 3: Management API"); a *PABCD-phase* is one letter P/A/B/C/D of a single cycle. They are not the same. Work-phases need not be slices of one feature: successive cycles in the SAME session may target completely different features or plans under the same goal (LOOP-UNIT-CHAIN-01, `cxc-loop`).

**Invariant — one work-phase = one full PABCD cycle.** Run P→A→B→C→D for a work-phase, close D (state → IDLE), then start the next work-phase at P. Do NOT run B for several work-phases back-to-back, and do NOT commit a work-phase straight out of B without passing C and D.

Faithful execution: perform each phase's actual work; the state transition is not
its artifact. C0/C1 keeps cxc-dev's fast-path; a real loop still cannot skip phases.
LOOP-CONTINUITY-01: P quotes the previous D conclusion/direction, with a reason
for changing it. PLAN-TRACK-01: when available, the native update_plan surface
mirrors progress; the durable plan remains the source of truth.

### Implementation-Unit Documents

Before C2+ unit planning or any multi-phase roadmap, read
[Implementation units](references/implementation-units.md).
It owns DIFFLEVEL-ROADMAP-01, PHASE-SPLIT-01 linkage, LEXICO-SPLIT-01,
UNIT-RESIDENCE-01, numbering, and docs-first document contents.
cxc-dev §0.1 owns C0/C1 record exemptions. cxc-loop owns when docs-first begins.

### Optimization-Loop Meta-Rules (plateau discipline)

For optimization, mechanism comparison, or plateau analysis, read
[Optimization rules](references/optimization.md) and
[Loop engineering](references/loop-engineering.md). Ordinary repair does not
preload optimization material.

## PABCD Depth by Work Class

| Class | Plan (P) | Audit (A) | Build (B) | Check (C) | Record (D) |
|-------|----------|-----------|-----------|-----------|------------|
| C0-C1 | None/inline | Optional | Direct fix | Smallest proof | cxc-dev §0.1: C0 exempt; C1 records only in an existing owning unit |
| C2 | Compact plan | Micro-audit | Implement + focused tests | Targeted gate | Summary |
| C3 | Compact or full plan depending on persistence/risk | Required when public contract, architecture, persistence, or cross-session risk exists; otherwise focused audit | Implement; use a reviewer subagent when useful | Affected suite + docs consistency when contracts changed | Summary + evidence; durable record only when state must persist |
| C4 | Full PABCD plan (mandatory) | Required, independent reviewer | Implement; independent verification | Full relevant gates | Durable risk/approval/evidence record |
| C5 | Interview/research first | — | — | — | Reclassify, then follow the new class |

See `dev` §0.0 for the full class definitions and tie-break rules.

## Delegation Model (subagents)

This section governs dispatched children, not independently user-owned peer tasks.
For necessary read-only context, follow
[peer collaboration](../dev/references/peer-collaboration.md). Outbound contact
requires an explicit user request or necessary coordination of a confirmed
blocking CI/merge collision, plus host permission and wake checks. Each peer retains
its own goal, plan and phase authority; a peer message never advances either FSM.

The main session owns the plan, host goal, and transitions. Before authorized
dispatch read [Delegation](references/delegation.md). Leaves do not spawn by
default; attachments name the needed owner skills explicitly.
No-delegation and scoped read/write restrictions take precedence.

## Loop Engineering (§11)

For repeated failure, reviewer FAIL, or loop-archetype selection, read
[Loop engineering](references/loop-engineering.md). LOOP-REPAIR-01: two repeated
failed repairs require root-cause work, three require replan. LOOP-DOOM-01:
three failed attestations are no-progress, never success. REVIEW-SYNTHESIS-01
requires accept/rebut synthesis before re-dispatch. HOTL never returns to I
while its goal is active.

## Catalog Discovery routing

Interview sub-modes and Catalog Discovery rules live in `$cxc-interview`
(INTERVIEW-CATALOG-01, CATALOG-DESIGN-FIRST-01). The option ontology YAML lives at
`references/catalog-discovery.yaml` in this skill directory.

## State

- `.codexclaw/sessions/<sessionId>.json` — current phase (IDLE/I/P/A/B/C/D), derived flags, injection dedupe, and bounded interview tracker.
- `.codexclaw/ledger.jsonl` — append-only audit trail of transitions.
- `.codexclaw/interviews/<sessionId>.jsonl` — shipped append-only Interview Q/A capture (and scan-evidence) ledger, written by the PostToolUse `request_user_input` hook.

## Repository Root

Determine the actual working repository root before planning (resolve via `pwd -P` from the target repo, or the project root the harness injects). Resolve all relative paths (`src/...`, `tests/...`) against it. If the root is ambiguous, ask before proceeding.
