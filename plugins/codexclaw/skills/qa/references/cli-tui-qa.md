# CLI / TUI QA — session driving + capture mechanics (QA-CLI-01)

How to DRIVE terminal surfaces and capture honest evidence. E7 discipline.
Role split: this file owns session/capture MECHANICS; the visual artifact
rubric and harness options (VHS/teatest, width gates as visual findings) stay
in `references/visual-qa.md`.

> These examples use POSIX conventions. On Windows: use `NUL` instead of
> `/dev/null`, `taskkill` instead of `kill`, and PowerShell equivalents for
> `awk`/`tmux` workflows.

## CLI capture discipline

- Capture stdout and stderr SEPARATELY when the claim distinguishes them
  (`cmd >out.txt 2>err.txt`); `2>&1` merges and destroys that evidence. Also
  capture the merged stream when ordering matters. ALWAYS record the exit
  code (`echo "exit=$?"`) in the same artifact.
- **Smoke floor** — `--help` and `--version` exit 0 and print to stdout (help
  requested is not an error); an UNKNOWN flag exits nonzero and names the
  flag on stderr.
- **TTY vs pipe** — run the claim's mode for real: `cmd | cat` forces
  non-TTY; interactive/TTY behavior runs inside tmux (below). Color/spinner
  output that corrupts piped consumption is a finding.
- **Env/locale matrix** (when behavior claims depend on it) — `NO_COLOR=1`,
  `TERM=dumb`, and a non-default `LANG`/`LC_ALL`; capture each run
  separately.
- **Config precedence** — when the tool reads flags + env + config file,
  drive one conflicting combination and capture which source won; silent
  mystery-precedence is a finding.
- **stdin behavior** — empty stdin (`</dev/null`) must not hang; piped input
  path captured when the tool claims it.
- **Signal/cleanup** — for long-running commands, SIGINT mid-run, then
  capture the cleanup receipt (no orphan processes via `ps`, no stale
  lockfiles/temp dirs). Pair with SKILL.md §6 teardown.

## TUI session mechanics (tmux)

Deterministic lifecycle — never drive a TUI in your own terminal:

1. `tmux new-session -d -s qa-<id> -x <cols> -y <rows>` — FIXED dims, stated
   in the matrix (defaults: 80x24 + one narrow run, e.g. 40 cols, as the §4
   narrow class).
2. `tmux send-keys -t qa-<id> '<cmd>' Enter` — one action per send.
3. **Wait for a marker, never sleep-and-hope**: poll
   `tmux capture-pane -pt qa-<id>` until an expected string appears (bounded
   retries, then FAIL with the last capture as the blocker artifact).
4. Capture evidence: `capture-pane -p` (plain) and `-e` (ANSI) copies, taken
   at each asserted state, numbered per step.
5. `tmux kill-session -t qa-<id>` + `tmux ls` clean output = the teardown
   receipt (SKILL.md §6).

Interaction claims (keystrokes, resize) re-inspect after every action —
inspect -> act -> re-inspect, same protocol as browser QA. Resize behavior:
`tmux resize-window -t qa-<id> -x <n>` then re-capture; a redraw that leaves
stale fragments is a finding.

Width/overflow and wide-char (CJK) column checks run on the plain captures
(`awk 'length > COLS'` minimum gate); their RUBRIC and harness escalation
(VHS/teatest) live in `references/visual-qa.md` §TUI.

## Artifacts

Per SKILL.md §3: `invocation.txt` carries the full tmux/shell command
sequence (copy-pasteable); captures are numbered per step; `verdict.json`
per scenario. Env-matrix runs are separate scenarios, not overwrites.
