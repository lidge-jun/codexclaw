# 003 — Stop Continuation Depth

Gap class: HARNESS (shallow continuation) · evidence: explorer Darwin

> codexclaw's `handleStop` arms on coarse FSM signals only. omo's continuation reads the
> actual remaining work and injects the next concrete work-item. This is why the current
> loop "continues" without knowing what is left to do.

## Parity table

| omo 실측 | codexclaw 실측 | 격차 | jaw식 보강 |
| --- | --- | --- | --- |
| `start-work-continuation/src/codex-hook.ts:10` + `boulder-reader.ts:43` (continuation from plan path, ledger path, remaining checkbox count) | `pabcd-state/src/hook.ts:407` (`phase`/`orchestrationActive`/`goal-active`/`stopBlockCount` only) | omo decides from remaining work; codexclaw from coarse flags | `Stop` reads `.codexclaw/goalplan.json` remaining work-phases (from `001`) |
| `start-work-continuation/directive.md:18` (Stop reason injects "read plan+ledger, pick first unchecked top-level item") | `loop/SKILL.md:24` (prose) + phase-only hook reason | omo's reason names the next work item; codexclaw's names only the phase command | enrich `Stop` block reason: next work item + ledger path + required evidence |
| `directive.md:22` (continuation orders parallel dispatch, distrust worker done-claims, independent verify, cleanup receipt) | `hook.ts:389` (next `cxc orchestrate <phase>` only) | omo's continuation carries a dispatch policy | split duties: Stop = next task, SubagentStop = proof receipt (`002`), PostToolUse = evidence append |
| `start-work-continuation/hooks/hooks.json:15` (continuation also on `SubagentStop`) | Stop-only | omo resumes after a child finishes; codexclaw does not | also wire continuation on `SubagentStop` (the `002` hook) |
| `directive.md:47` (a checkbox flips to done only after a 5-phase QA gate; next Stop re-continues) | `hook.ts:423` (stagnation cap only; no work-unit completion concept) | omo has a work-unit completion definition; codexclaw has only a cap | goalplan `workPhase.tasks[]`; `Stop` keeps blocking until the current task's receipt exists |

## Reinforcement shape (no-server)

`handleStop` evolves from "phase-aware" to "work-aware":

- Read goalplan remaining tasks/criteria (from `001`).
- If unfinished work + active goal + in-flight cycle -> block with a reason that names
  the next task, its ledger path, and the evidence it must produce.
- Keep the stagnation cap + context-pressure bail so it still can never trap.

## Honesty fix coupled here

`loop/SKILL.md` currently claims the Stop hook re-enters `P` and auto-advances `I->P`.
The hook does neither (it blocks/releases, never transitions). Until the above lands,
the prose must be downgraded (this is contradiction-register A1/A2; see
`structure/30_contradiction_register.md`).

## Enforcement tier

E2 (Stop block) — strengthened by `001` state and `002` receipts.
