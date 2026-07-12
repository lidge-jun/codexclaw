# Cross-Platform Compatibility — Research

**Date**: 2026-07-12
**Method**: 3 parallel sol explorers — opencodex reference patterns (Socrates), codexclaw code audit (Nash), codexclaw skills audit (Confucius)
**Scope**: Research only — no code changes this cycle

## 1. opencodex Reference Patterns

opencodex (PR #100, #102 and 8 core files) already solves the same cross-platform problems codexclaw will face. Key patterns to adopt:

| Pattern | opencodex file | What it does |
|---------|---------------|--------------|
| NTFS ACL enforcement | `windows-secret-acl.ts` | `icacls.exe` with `shell: false` replaces `chmod` on Windows |
| Process termination | `process-control.ts` | `taskkill /PID /T /F` on Windows, `SIGTERM`→`SIGKILL` on Unix |
| URL launcher | `open-url.ts` | Three-way: `open` (macOS) / `rundll32.exe url.dll` (Windows) / `xdg-open` (Linux) |
| Home directory + WSL | `home.ts` | WSL detection via env vars + `/proc/version`, `wsl.conf` automount parsing |
| Shim generation | `shim.ts` | Separate POSIX/CMD/PowerShell/Git Bash shims, CRLF for batch, BOM for PS 5.1 |
| Atomic rename retry | `config.ts` | Windows-only retry for `EBUSY`/`EPERM`/`EACCES` (25ms + 50ms, 3 attempts) |
| Service dispatch | `service.ts` | launchd / Task Scheduler / systemd, case-folded Windows path comparison |
| No-op gates | `system-env.ts` | macOS-only features return immediately on other platforms |

**12 general principles** (from Socrates report):
- `path.join`/`resolve`/`delimiter` for host paths; `path.posix` only for explicit POSIX namespaces
- WSL is an interop environment, not just Linux
- Dispatch to native service mechanisms per platform
- `shell: false` + argument arrays for Windows system utilities
- `chmod` does not isolate Windows secrets — NTFS ACLs required
- Atomic rename needs bounded retry on Windows (AV/lock contention)
- Case-insensitive path comparison on Windows
- `PATHEXT` for Windows executable discovery
- Shell-specific encodings (CRLF batch, UTF-8 BOM for PS 5.1)
- No-op gates for platform-only features
- Fixtures near dependencies, not in system temp (Windows CI)
- Never shim across the WSL/Windows boundary

## 2. codexclaw Code Issues

### P0 — Windows blockers (5)

| # | File:Line | Issue | Impact | Fix approach (from opencodex) |
|---|-----------|-------|--------|-------------------------------|
| 1 | `cxc-ops/src/hook-trust.ts:89` | `assertSupportedPlatform()` throws on `win32` | Hook trust entirely unavailable on Windows | Remove platform gate; implement Windows-compatible hash (no symlink dependency) |
| 2 | `pabcd-state/src/subagent-evidence.ts:143` | Unix-only `grep -qF` | Evidence exemption fails silently (fail-open) — workers incorrectly gated | Replace with Node `fs.readFileSync` + `includes()` |
| 3 | `messenger-bridge/src/runner.ts:207` | `SIGTERM`→`SIGKILL` escalation | `SIGKILL` throws on Windows, crashes bridge | Adopt opencodex `process-control.ts` pattern: `taskkill` on Windows |
| 4 | `messenger-bridge/src/server.ts:188` + `gateway-commands.ts:408` | Tilde expansion only handles `~/` | `~\project` fails on Windows | Accept both `~/` and `~\`, per opencodex `config.ts` |
| 5 | `subagent-config/src/spawn-attach-hook.ts:147` | Skill link detection hardcodes `/SKILL.md` | Windows `\SKILL.md` paths not recognized | Use `path.basename` or `endsWith` with both separators |

### P1 — Linux blockers (1)

| # | File:Line | Issue | Fix approach |
|---|-----------|-------|--------------|
| 1 | `messenger-bridge/src/service.ts:23,95,120` | Service management is launchd-only | Add systemd unit generation per opencodex `service.ts` |

### P2 — Minor (4)

| # | File:Line | Issue |
|---|-----------|-------|
| 1 | `pabcd-state/src/friction.ts:43` | POSIX-only path normalization in error signatures |
| 2 | `config-guard/src/activate.ts:62` | TOML parsing assumes LF; CRLF causes formatting churn |
| 3 | `cxc-ops/test/hook-trust.test.ts:385` | Test PATH uses `:` not `path.delimiter` |
| 4 | `messenger-bridge/test/*.test.ts` | Test fixtures use `chmodSync 0o755` |

## 3. codexclaw Skill Issues

### HARD — fails on Windows (10)

| Skill | File:Line | Issue |
|-------|-----------|-------|
| dev-diagram-viewer | `SKILL.md:98,133-145` | macOS `open` / Linux `xdg-open` — no Windows `start` |
| dev-diagram-viewer | `SKILL.md:114-121,139,155,171,263` | Hardcoded `/tmp/codex-diagrams` + `mkdir -p` |
| remote | `SKILL.md:29-31` | Daemon workflow launchd-only + brace expansion |
| remote | `references/telegram.md:24-35`, `discord.md:21-30` | `cxc service install` documented as launchd-only |
| remote | `references/troubleshooting.md:43-60` | POSIX env vars, `tail`, shell escaping |
| qa | `references/cli-tui-qa.md:20-55` | `/dev/null`, Unix signals, `tmux`, `awk` |
| dev-architecture | `SKILL.md:311,317` | `find -exec`, `wc`, `awk` |
| dev-scaffolding | `references/api-docs.md:74-83` | `/tmp/fresh-spec.yaml`, shell continuations |
| ast-grep | `references/install.md:12,29` | `/opt/homebrew`, `brew install` |
| remote | `references/telegram.md:143-147` | POSIX command substitution, single-quotes |

### SOFT — suboptimal on Windows (10)

Skills that use `$CODEX_HOME`, `~/`, `grep`/`sort`/`uniq`, `./concepts/`, `cd && ...`, or Ubuntu+macOS-only CI matrix. Functional but require agent adaptation on Windows.

### NEUTRAL

`agbrowse`, `rg`, source paths, import specifiers, URLs, Markdown links, Homebrew reference docs (domain-scoped), and design references are all cross-platform or intentionally scoped.

## 4. Prioritized Action Plan

### Phase 1 — Code P0 fixes (5 items, estimated C2)
Remove the `win32` throw in hook-trust, replace `grep -qF` with Node API, adopt opencodex process-control pattern for signal handling, fix tilde expansion to accept both slashes, fix skill-link detection with `path.sep`.

### Phase 2 — Service dispatch (1 item, estimated C3)
Port opencodex's three-way service dispatch pattern (launchd/Task Scheduler/systemd) to messenger-bridge service.ts. This is the largest single change.

### Phase 3 — Skill text updates (10 HARD items, estimated C1 each)
Add Windows equivalents where skills prescribe macOS/Linux commands. Most are 1-2 line additions ("On Windows: `start "" <file>`", "Use `os.tmpdir()` instead of `/tmp/`"). The remote skill's launchd documentation needs a "Windows: Task Scheduler" and "Linux: systemd" companion section.

### Phase 4 — P2 cleanup (4 items, estimated C0-C1 each)
Path delimiter in tests, CRLF tolerance in TOML parsing, friction path normalization, test fixture portability.

### Deferred
- WSL interop (opencodex's home.ts/shim.ts patterns) — only needed if codexclaw ships a standalone CLI installer
- Windows CI matrix — requires a Windows runner in GitHub Actions

## 5. opencodex Principles Checklist (for future patches)

When implementing the phases above, each patch should be checked against:
- [ ] Uses `path.join`/`resolve` instead of string concatenation with `/`
- [ ] Uses `os.tmpdir()` instead of hardcoded `/tmp/`
- [ ] Uses `os.homedir()` instead of `$HOME`
- [ ] Process termination dispatches by `process.platform`
- [ ] File permissions use NTFS ACL on Windows (or skip gracefully)
- [ ] Atomic file writes retry on Windows `EBUSY`/`EPERM`/`EACCES`
- [ ] Shell commands use argument arrays with `shell: false`
- [ ] Skill text offers Windows/Linux alternatives for macOS-only commands
- [ ] Tests use `path.delimiter` not hardcoded `:`
- [ ] Platform-only features have no-op gates on unsupported platforms
