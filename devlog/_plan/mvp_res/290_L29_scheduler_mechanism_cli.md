# L29 (Decade 290) -- Scheduler Mechanism + cxc schedule CLI

Status: BLOCKED(Q-P3-1)
Cluster: 5 - Phase: 3 - Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/040_phase3_overview.md, 041/042

## Goal (one slice)
Ship the Phase 3 scheduling base: `cxc schedule` records recurring jobs in
`.codexclaw/schedule.json` and installs an OS scheduler entry that runs
`codex exec` with codexclaw active. codexclaw does not add a built-in cron loop.

## Why now / dependencies
- Upstream: depends on L6 install/activation so the `cxc` binary and codexclaw
  activation path exist, and on L20 only for CLI command conventions.
- Downstream: unblocks L30 result delivery and Phase 3 verification; L31 channel
  delivery may later consume scheduled outputs but is not needed here.

## Scope (decision-complete except Q-P3-1)
- Files to add/edit: CLI schedule command under the existing `cxc` CLI surface;
  `.codexclaw/schedule.json` project job store; generated launchd plist on
  macOS or cron entry on Unix-like hosts.
- Exact behavior: `cxc schedule add --every 15m --prompt "..."` creates a job
  definition, writes scheduler metadata, and arranges a recurring invocation of
  `codex exec "<prompt>"` from the target project with codexclaw active.
- Job store mirrors cli-jaw `heartbeat.json` shape at a project-local level:
  stable job id, enabled flag, schedule object, prompt, command metadata, and
  timestamps. It is not a global daemon database.
- Include `cxc schedule list`, `cxc schedule remove <id>`, and a dry-run path
  that prints the generated scheduler command/plist without installing it.
- Must-NOT-Have: no codexclaw always-on scheduler process in the default MVP;
  no hidden background service; no reliance on codex hooks as timers; no channel
  delivery logic in this loop.

## IPABCD micro-cycle
- I: not interview-bearing; the fork is captured in Blocked-on.
- P: implement the job-store schema and `cxc schedule` add/list/remove/dry-run;
  define the generated `codex exec` command and OS scheduler writer boundary.
- A: audit angle = "does scheduling stay external to codex runtime and avoid an
  accidental always-on daemon?" reviewer checks generated commands and state.
- B: build schema validation, project-local store read/write, interval parsing,
  launchd/cron writer adapters, and remove/list behavior.
- C: CLI stdout from dry-run shows the exact `codex exec` command; node:test
  covers store roundtrip, interval parsing, and writer output without install.
- D: done = a project can register/list/remove a recurring `codex exec` job via
  `cxc schedule`, with installable scheduler artifacts once Q-P3-1 is decided.

## Acceptance (1-3 testable criteria)
1. `cxc schedule add --every 15m --prompt "..." --dry-run` prints the job id,
   store record preview, and OS scheduler artifact without touching the system.
2. `.codexclaw/schedule.json` roundtrips enabled jobs and rejects malformed
   intervals/prompts with clear CLI errors.
3. `cxc schedule remove <id>` removes the job record and prints the scheduler
   artifact/action that must be removed or was removed.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- node:test for schedule schema, interval parsing, and launchd/cron rendering.
- CLI stdout capture for `cxc schedule add --dry-run`, `list`, and `remove`.

## Commit unit (one atomic conventional commit)
`feat(schedule): add cxc schedule job store and os scheduler writers`

## Blocked-on (jun decision id, if any)
BLOCKED(Q-P3-1): OS scheduler vs always-on daemon.

Options:
- Option A - OS scheduler with `codex exec` (recommended): launchd on macOS and
  cron on Unix-like hosts invoke `codex exec` per tick. Impact: simplest MVP,
  no custom service lifecycle, aligns with 040 feasibility, but host scheduler
  UX and log paths differ by OS.
- Option B - always-on daemon using codex app-server/exec-server: codexclaw
  owns a resident process that wakes jobs itself. Impact: more uniform behavior,
  but adds service lifecycle, crash recovery, and experimental runtime surface.
- Option C - store-only planner: write `.codexclaw/schedule.json` but require
  users to install scheduler entries manually. Impact: safest implementation,
  but not a shippable heartbeat-style UX.

Recommendation: Option A. Phase 3 should use `codex exec` plus launchd/cron and
keep daemon work deferred until there is evidence that OS scheduler UX is not
enough.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/040_phase3_overview.md (Phase 3 feasibility and step map)
- 041 scheduler mechanism decision (launchd/cron vs experimental daemon)
- 042 `codexclaw schedule` CLI + job store
- cli-jaw heartbeat.json shape (mirrored concept only, not vendored)
