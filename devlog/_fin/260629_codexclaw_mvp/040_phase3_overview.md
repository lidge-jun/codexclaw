# 040 — Phase 3 Overview: Periodic / Scheduled Work

Status: PLANNING  ·  Phase 3 of 3 (3rd MVP — INCREMENTALLY shippable on the Phase-1 base, decision 015)

## Question being answered
Can codexclaw do cli-jaw-style recurring/heartbeat work using codex's own facilities?

## Feasibility verdict (research, 2026-06-29)
**Yes, via `codex exec` + an OS scheduler.**
- codex has no built-in cron/heartbeat, BUT `codex exec` (alias `e`) runs codex non-interactively.
- So `launchd` (macOS) / `cron` / `systemd timer` (Linux) invoking `codex exec "<prompt>"` on a
  schedule is functionally equivalent to cli-jaw's heartbeat jobs.
- Plugin hooks (SessionStart etc.) fire per session, not on a timer — so the timer must come from
  the OS, with each tick launching a codex session that loads codexclaw.

## Approach (to design)
- A codexclaw CLI command to register/list/remove scheduled jobs:
  `codexclaw schedule add --every 15m --prompt "..."` → writes a launchd plist / cron entry that
  runs `codex exec` with the codexclaw plugin active.
- Job definitions stored in `.codexclaw/schedule.json` (mirrors cli-jaw heartbeat.json shape).
- Results delivery (channel/file) — phase 3 design decision.

## Open decisions (ask jun)
- Q-P3-1: Is OS-scheduler-backed `codex exec` acceptable, or do you want an always-on daemon
  (codex `app-server` / `exec-server` are EXPERIMENTAL alternatives)?
- Q-P3-2: Where do scheduled-job results go (stdout log, file, messaging channel)?
- Q-P3-3: RESOLVED — phase 3 is a real shippable MVP unit, not post-MVP (decision 015).

## Step map (041–)
- 041 scheduler mechanism decision (launchd/cron vs experimental daemon)
- 042 `codexclaw schedule` CLI + job store
- 043 result delivery
- 044 phase 3 verification
