---
name: cxc-loop
description: "Use for scoped PABCD completion loops. Bare cxc-loop means HOTL; explicit explanation, interview, plan-only, read-only, or HITL limits win. Triggers: cxc-loop, continue until done, HOTL, repeated PABCD, 루프 돌려, 끝까지 해줘, docs-first."
metadata:
  short-description: "Agent-led scoped completion with durable plans and evidence."
---

# cxc-loop — Scoped completion

## Intent before activation

Apply the current request's authority before choosing a mode:

- An explanation, review, or quoted mention of cxc-loop is not an execution request.
  Do not create a goal, mutate the FSM, or start implementation merely to explain it.
- Explicit interview-only, plan-only, read-only, no-writes, no-commits, no-goal,
  no-FSM, no-tests, and no-delegation limits take precedence when actually stated.
  Do only the authorized work. A plan-only
  request is not permission for A/B/C/D; an interview is not permission to leave I.
- An operative bare cxc-loop request means HOTL completion of all plans within the
  agreed objective. An explicit HITL request instead preserves human P/A/B pauses.
  Ordinary development requests do not become HOTL because this skill was loaded.
- HOTL changes persistence, not permissions. It does not authorize unrelated work,
  push, merge, release, deployment, installation, destructive actions, or new access.
  If missing intent or authority prevents progress, report it; do not silently
  enlarge the scope. Do not enter Interview while a host goal is active.

Only the main session owns host goals and PABCD transitions. A delegated task
follows its packet; loading loop never authorizes a leaf to start a goal or spawn.
Follow the live host tool contracts, including goal creation and blocked-status
conditions. A plugin hook accepting a call is not proof that the call is authorized.

An incoming peer question is not a new loop request or permission to resume an old
goal. Follow [peer collaboration](../dev/references/peer-collaboration.md) for
question-only wakes and independent task authority; apply this loop only to work
the user actually authorized.

## Select the smallest sufficient reading path

The agent selects owners from the task, work class, risk, and current phase.
Read each selected SKILL.md completely; then read only references whose conditions
apply. Resolve relative links from this skill's directory, not the working directory.
Batch known independent reads within both nested-tool and outer code-mode output
budgets. If output is truncated, recover the missing content before the governed
action; command exit0 is not a complete read. Reuse content still present in context; after context
loss reload the applicable owner, not the whole skill family.
If a selected file's output is truncated, re-read that file separately. Do not
guess missing ranges from an elision marker. If it cannot fit one result, use
numbered, contiguous, non-overlapping chunks through EOF and verify no gaps.
Keep both nested and outer output budgets large enough for each returned chunk.
Do not recursively load every linked file. A missing mandatory reference is a
preflight failure: resolve it or report the limitation before the governed action.

| Condition | Read before the governed action |
|---|---|
| Development or governed review | [cxc-dev](../dev/SKILL.md), then its matching surface routers |
| Real PABCD work or a PABCD plan | [cxc-pabcd](../pabcd/SKILL.md), then only the current phase references it selects |
| Start/resume HOTL or diagnose its continuation/completion | [Runtime lifecycle](references/runtime-lifecycle.md) |
| Create, register, amend, or inspect durable goalplan schema/CLI | [Durable goalplan](references/durable-goalplan.md) |
| Two or more work-phases, including scope discovered later | [Implementation units](../pabcd/references/implementation-units.md) |
| Repeated failure, reviewer FAIL, or unclear loop archetype | [Loop engineering](../pabcd/references/loop-engineering.md) |
| Score optimization, plateau, or mechanism comparison | [Optimization rules](../pabcd/references/optimization.md) and loop engineering |
| Deliberate divergence/candidate comparison | [Divergence tiers](references/divergence-tiers.md) |
| Dispatch is authorized and needed | [Delegation](../pabcd/references/delegation.md) |
| Waiting on dispatched work or long external processes, HITL or HOTL | [Waiting on work](references/waiting.md) |

The installed skill listing and owner routers are the discovery path. cxc skill
search searches external catalogs; it is not the native installed-skill loader.
Keep explicit-only skills and leaf-safe delivery restrictions intact.

## Execution invariants

- ORCH-MANDATE-01 (STRICT): a claimed active loop needs real persisted FSM evidence,
  not narrated phase names. Read actual session state before entry or re-entry.
  SESSION-IDENTITY-01 uses only your latest SessionStart binding, never a parent's
  or historical transcript's id. Phase-control details belong to cxc-pabcd.
- HOTL needs both an ACTIVE host goal and an in-flight PABCD cycle; HITL needs no
  host goal. If a required capability or binding is absent, report the preflight
  failure rather than claiming Stop-continuation is armed.
- One work-phase is one P→A→B→C→D cycle. Do the work and provide each edge's real
  artifact; state advancement is not proof of work. D closes that cycle to IDLE.
  Hooks may guard calls or termination; they neither choose nor advance phases.
- LOOP-CONTINUE-01: read the bound goalplan and ledger after D or context loss.
  Do not shrink criteria to exit. If in-scope work remains under the active goal,
  re-enter P. A genuinely new in-scope unit is a P-phase amendment to the same
  goal (LOOP-UNIT-CHAIN-01), not an excuse to stop or permission for unrelated work.
- LOOP-CONTINUITY-01: the next P quotes the previous D conclusion and direction;
  changing that direction requires a reason. Resume from durable evidence, not
  transcript momentum. Completion follows cxc-dev's fresh-proof gate.
- LOOP-GIT-01 points to cxc-dev §5: checkpoint authorized implementation locally;
  external writes still require explicit permission. For a declared PR stack,
  read cxc-dev references/stacked-prs.md. Planning-only work does not authorize
  implementation or publication; local documentation checkpoints follow cxc-dev
  scope and git rules.

## Docs-first multi-cycle entry

LOOP-DOCS-FIRST-01 is DEFAULT for multi-cycle loops and STRICT for HOTL.
Register the goalplan skeleton and make the first work-phase a docs-only roadmap
PABCD cycle. Its D locks the roadmap; implementation begins in the next cycle.
Each later work-phase consumes one pre-written decade doc and revalidates it at P.
If multi-cycle scope is discovered later, the next P first pays the roadmap debt.
No production patches, deploys, or implementation-complete claims in that cycle.
A genuine single-cycle task skips this extra cycle; cxc-dev's C0/C1 fast-path remains.

LOOP-READS-PABCD-01 (STRICT): before multi-cycle execution read the implementation
units reference. cxc-loop owns WHEN; cxc-pabcd owns DIFFLEVEL-ROADMAP-01,
PHASE-SPLIT-01, LEXICO-SPLIT-01, and UNIT-RESIDENCE-01. cxc-dev owns the C0/C1
fast-path exception. Neither a skeleton nor empty decade docs satisfy the roadmap.

## Completion and recovery

Report the real outcome: DONE, NOOP, BLOCKED, UNSAFE, NEEDS_HUMAN, or
BUDGET_EXHAUSTED. These are report outcomes, not new FSM phases or host goal
statuses. DONE requires fresh proof of all recorded criteria. Resource exhaustion
requires an actual stated bound; compaction, a wait timeout, or Stop releasing is
not success or budget exhaustion. Preserve evidence and continue when appropriate.
Do not weaken the goalplan to pass GOAL-COMPLETE-GATE-01. For rejection, stagnation,
or lost arming, read runtime lifecycle; for repeated failures read loop engineering.
