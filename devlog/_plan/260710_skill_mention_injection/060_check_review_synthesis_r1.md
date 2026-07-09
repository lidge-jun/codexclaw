# 060 — C-Gate Review Round 1 Synthesis (Kierkegaard, VERDICT: FAIL, 4 High)

## B1 (REBUT — pre-existing, out of unit scope)
"D1 no longer denies v1 recursive spawns" compares worktree vs HEAD. The
`v2Spawn &&` condition was ALREADY in the working tree before this unit began
(read at session start, pre-worker), with its own design comment: "V1 keeps
only model routing, so this guard is V2-only" (260709 multi_agent_v2 switch,
uncommitted user work). Not introduced by this unit; not reverted per
dirty-worktree policy. Flagged to the user as a residual observation instead.

## B2 (ACCEPT) — fence early-close
`indexOf` closing-fence scan can match a delimiter inside the fence body.
Fix: closing fence must be a LINE-anchored delimiter (line start, >= opening
backtick count, optionally longer), per CommonMark; unclosed fence protects to
end of message. Add inline-delimiter adversarial test.

## B3 (ACCEPT) — angle-bracket/title destinations
`[$cxc-dev](</existing/dev/SKILL.md>)` and `[...](path "title")` include
markdown syntax in targetPath -> existsSync fails -> valid caller link
destroyed. Fix: strip `<...>` wrapper and optional title before the broken-target
predicate; preserve when the unwrapped path exists and ends in /SKILL.md.
Add both regression tests.

## B4 (ACCEPT) — quadratic scan
`markdownLinkAt` rescans the tail at every `[`; 128KiB -> 15.9s > 10s hook
timeout. Fix: bound link scanning (no rescan-per-position; single forward scan
with resumable index, and/or a hard size guard that returns identity for
messages > 256KiB). Add a perf smoke test (>=128KiB adversarial `[` input must
complete < 1s).
