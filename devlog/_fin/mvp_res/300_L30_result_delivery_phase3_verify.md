# L30 (Decade 300) -- Result Delivery + Phase 3 Verification

Status: DEFERRED (Q-P3-2, Phase 3)
Cluster: 5 - Phase: 3 - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/040_phase3_overview.md, 043/044

## Goal (one slice)
Define where scheduled `codex exec` results go and prove the Phase 3 scheduler
works end to end. L30 consumes the L29 schedule mechanism and turns a recurring
job into inspectable output without adding channel delivery yet.

## Why now / dependencies
- Upstream: depends on L29 for `cxc schedule`, `.codexclaw/schedule.json`, and
  OS scheduler artifact generation.
- Downstream: provides the result contract that L31 channel delivery can later
  read or forward; also closes Phase 3 as a shippable MVP unit.

## Scope (decision-complete except Q-P3-2)
- Files to add/edit: result writer/reader under the scheduler CLI surface;
  project-local result paths under `.codexclaw/`; verification docs/tests for
  an end-to-end scheduled `codex exec` run.
- Exact behavior: each scheduled run captures the prompt, start/end timestamps,
  exit status, stdout/stderr summary, and result body according to the selected
  delivery fork.
- CLI surface: `cxc schedule runs [job-id]`, `cxc schedule show-run <run-id>`,
  and `cxc schedule verify --dry-run` for local evidence without waiting on a
  real timer.
- Must-NOT-Have: no telegram/discord integration; no server-owned bgtask model;
  no silent discard of stdout/stderr; no fabricated success when `codex exec`
  exits non-zero.

## IPABCD micro-cycle
- I: not interview-bearing; the result destination fork is in Blocked-on.
- P: add run-result schema and reader commands; wire generated scheduler command
  to capture `codex exec` output; define the Phase 3 verification transcript.
- A: audit angle = "can a user inspect a scheduled job failure after the fact?"
  reviewer checks non-zero exit handling, log retention, and no channel coupling.
- B: implement result capture, list/show commands, and dry-run verification that
  simulates the generated scheduler command path.
- C: run `cxc schedule verify --dry-run`; run a direct generated command once
  against a harmless prompt and inspect recorded output.
- D: done = Phase 3 has a reproducible scheduler-to-result evidence path and a
  clear result destination decision recorded.

## Acceptance (1-3 testable criteria)
1. A scheduled command can write a run record containing prompt metadata,
   timestamps, exit code, stdout/stderr summary, and result body/location.
2. `cxc schedule runs` and `cxc schedule show-run <run-id>` expose success and
   failure results without requiring a messaging channel.
3. Phase 3 verification includes one dry-run artifact plus one direct local
   `codex exec` capture path, both using codexclaw active.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test for run-result schema, retention rules, and failed-exit capture.
- CLI stdout for `cxc schedule verify --dry-run`, `runs`, and `show-run`.
- Data dump under `.codexclaw/` for a seeded run result fixture.

## Commit unit (one atomic conventional commit)
`feat(schedule): capture scheduled run results and verify phase 3`

## Blocked-on (jun decision id, if any)
BLOCKED(Q-P3-2): scheduled-result delivery destination.

Options:
- Option A - stdout/log only: generated scheduler command writes to OS log or
  configured stdout/stderr files. Impact: minimal implementation, but hard for
  users to inspect inside `cxc` and weak for failure triage.
- Option B - project-local file store (recommended): write run records under
  `.codexclaw/` and expose them through `cxc schedule runs/show-run`. Impact:
  good MVP observability, deterministic tests, and a clean bridge for L31.
- Option C - direct channel delivery: every scheduled result goes to telegram or
  discord immediately. Impact: useful for heartbeat notifications, but couples
  Phase 3 to lowest-priority channel credentials and delivery failures.

Recommendation: Option B. Keep result capture in project-local files first, with
stdout as an implementation detail and channel forwarding deferred to L31.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/040_phase3_overview.md (Q-P3-2 and 043/044 step map)
- 043 result delivery
- 044 phase 3 verification
- 290_L29_scheduler_mechanism_cli.md (scheduler input contract)
- 260629_codexclaw_mvp/090_expansion_moc.md J-2 (durable periodicity belongs to
  Phase 3 OS scheduler, not server-owned bgtask)
