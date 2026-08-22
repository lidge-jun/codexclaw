# 030 - wp03: issue #33, Windows hook trust

Two independent defects were filed as one issue.

## Bug A - `cxc hooks retrust` dies before it can help

```
cxc-ops hooks retrust: codex features list verification failed: spawnSync codex EPERM
```

`verifyCodexConfig` (cxc-ops/src/hook-trust.ts) spawns a bare `codex` with no shell.
On this host the failure is TWO stacked problems, not one:

1. PATH offers `WindowsApps\...\codex.EXE` first. That file is readable and passes
   `X_OK`, and it is NOT a reparse point - yet `CreateProcess` still refuses it with
   `EPERM` ("Access is denied" from cmd.exe). So the obvious "skip unreadable reparse
   points" heuristic does not catch it. The only reliable discriminator is the
   `WindowsApps` path SEGMENT, matched whole so `MyWindowsAppsBackup` is not swept up.
2. The npm shim next to it is `codex.CMD`, which Node refuses to spawn shell-less
   after the CVE-2024-27980 hardening (`EINVAL`).

Because verification failed for reasons unrelated to the config, the rollback path
discarded a CORRECT write on every run.

Fix: a new `cxc-ops/src/codex-bin.ts` resolves the binary through a ladder -
`CODEX_BIN` override, then a PATH/PATHEXT walk that skips WindowsApps, then a
caret-escaped `cmd.exe` hop. The injected `runner` seam is untouched; `retrustHooks`
takes a trailing `platform` parameter so win32 behavior is testable from any OS.

It lives in a new module rather than in `win-exec.ts`, which is byte-identical across
three components under SHARED-HELPER-01 and must stay that way.

## Bug B - no [hooks.state.*] entries after a fresh install

Investigated and DISMISSED as a codexclaw defect: nothing in this repository writes
`[hooks.state.*]`. Only the host Codex binary does, on hook approval. Adding a silent
bootstrap would forge a trust decision the user never made, so it was not done.

What did change: `runHookTrustCheck` now distinguishes never-trusted
(`actual=null`) from drifted, and emits a repair line naming the owner of the write
plus the exact command. `--bootstrap-ok` is suggested only when no entry exists at all.

## Verification

`cxc doctor` on the live host: `[PASS] hook-trust: 22 hook hash(es) trusted`.
A real `cxc hooks retrust` run: `updated=22 appended=0` with a timestamped backup -
the exact command that previously died on EPERM.

## Note on the reporter's workaround

The issue's confirmed workaround (prepend the vendored binary dir to PATH) is now
unnecessary; the resolver finds that binary itself.

# 031 - a defect found while verifying, not filed

`resolveProjectRoot` in `gui/src/server/middleware.ts` treats any ancestor with a
`.codexclaw/` directory as the project root. `~/.codexclaw` is codexclaw's own GLOBAL
store (recall index, skill cache), so on any real installation a start dir outside a
repository walks up and resolves the user's ENTIRE HOME DIRECTORY as the project root.
The dashboard would then read and write `~/.codexclaw/subagents.json`.

The test "no marker anywhere -> falls back to the start dir" catches it, but only on a
machine that actually has `~/.codexclaw` - which CI runners do not. It was green in CI
and red locally.

Fix: exclude `homedir()` from the `.codexclaw` marker check, plus a regression test
that asserts the resolution is not the home directory.
