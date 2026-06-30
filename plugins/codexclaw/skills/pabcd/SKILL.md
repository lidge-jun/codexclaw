---
name: cxc-pabcd
description: "MUST USE for any non-trivial multi-step development task that benefits from disciplined planning before execution — features, refactors, cross-module changes, or anything large enough to need explore-first planning, an audit gate, staged build, and verification before done. Scales depth by work class (C0-C5). Triggers: 'plan this', 'let's build X properly', 'interview me', 'be thorough', 'do it right', '제대로 만들자', '기획부터', '인터뷰하자', '요구사항 정리'."
metadata:
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
criteria, Ontology), research the repo before asking, and confirm requirements before Plan.

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

## Phases

These align with the directives the `pabcd-state` hook injects per phase:

0. **I — Interview**: Clarify requirements before planning across the four dimensions. Research the repo first, then ask focused questions. No implementation yet.
1. **P — Plan**: Explore first (read real code, configs, docs). Write a diff-level plan: file change map, scope boundary (IN/OUT), and testable accept criteria. Ground every decision in code you have read. No implementation yet. For broad or unfamiliar repos, include a compact tree, detected conventions, and which existing logs/docs you will reuse.
2. **A — Audit**: Adversarial, read-only review of the plan against the real codebase. Dispatch an independent reviewer (`spawn_agent`) to challenge assumptions, find blockers (rollback gaps, missing callers, phantom constants), and verify references. Fold fixes back into the plan and record the verdict. No code changes.
3. **B — Build**: Implement the audited plan in small atomic commits. Verify as you go. Stay inside the plan's scope boundary; surface deviations instead of silently expanding scope.
4. **C — Check**: Run the real verification — build, typecheck, and targeted tests, plus adversarial review. Capture fresh command output as evidence. Do not claim pass without artifact-level proof.
5. **D — Done**: Summarize what was checked with evidence, update STATUS/devlog, commit, and confirm no pending work remains for this work-phase before returning to idle.

## Work-Phase Loop (multi-pass tasks)

**Terminology**: a *work-phase* is one outcome slice of the goal (e.g. "Phase 3: Management API"); a *PABCD-phase* is one letter P/A/B/C/D of a single cycle. They are not the same.

**Invariant — one work-phase = one full PABCD cycle.** Run P→A→B→C→D for a work-phase, close D (state → IDLE), then start the next work-phase at P. Do NOT run B for several work-phases back-to-back, and do NOT commit a work-phase straight out of B without passing C and D.

**Loop / multi-pass tasks**: a "loop"/"루프" request (or work too large for one cycle) runs as multiple PABCD passes — one per work-phase. Pre-plan the full slice map and scaffold per-phase decade docs (10_phase1, 20_phase2, ...) up front. The first pass MAY be a design-only PABCD pass (Phase 0): a code-free whole-system design/documentation cycle before the first implementation work-phase.

For maximize-metric work, `cxc-loop` may enter divergence mode after a plateau: record
N>=2 grounded candidates, choose early collapse at P for satisfy-spec work or late
collapse at D for deceptive metrics, and keep all candidate provenance in
`.codexclaw/divergence/`. The agent still owns every phase transition; no hook builds
or races candidates automatically.

**Faithful execution (anti-skip)**: do the real work of each PABCD-phase — P writes the real diff-level plan, A really dispatches the audit, B really implements AND verifies, C really runs tsc/tests/scrutiny, D really summarizes with evidence. Advancing the state is NOT the same as doing the phase; never rubber-stamp a phase to move on.

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

- The main agent owns the plan and the build by default. Subagents (`spawn_agent`) are scoped helpers.
- Use a reviewer subagent at the A gate (and the C gate for C3/C4) to challenge the plan/implementation independently — receive the verdict, act on it, continue. Subagents are verifiers and scoped workers, not approval gates.
- When delegating writes, give each subagent a disjoint write scope (own files/dirs) so parallel work never collides; tell it the other agents exist and not to revert their edits.
- Never let a subagent reconstruct the plan from a short task description — pass the concrete plan and scope explicitly.
- For long-running external verification (CI, deploy, remote build), spawn a background subagent and poll with short `wait_agent` cycles. Local builds/tests that finish in minutes stay blocking.

**Subagent TASK packet (DISPATCH-TASK-01).** Every dispatch carries a structured task, not a
one-liner: `TASK` (the concrete outcome), `SCOPE` (the disjoint write set / read bounds),
`MUST DO`, `MUST NOT` (e.g. do not revert peers, do not widen scope), `PROOF` (the evidence to
return — `path:line` + command output), and `RETURN FORMAT`. Put the packet in the spawn
message always; structured skill attachment (a `cxc-*` ref in the spawn `items`) binds only on
the v1 spawn surface, whose args include an explicit `items` field, and only when the dispatch
routes through the spawn-wrapper builder (`resolveSpawnPayloadWithSkills`, L15) — the default
v2 spawn sets `deny_unknown_fields` with no `items`, so there the packet stays in message text
(`structure/10_subagent_skill_routing.md:91`). Do not delegate host-goal changes to subagents;
the main session owns `create_goal`/`update_goal`.

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
