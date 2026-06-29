# Cross-platform Release — CI Matrix vs Local OS Proof

Last reviewed: 2026-06-21
Applies to: CLI packages, desktop-affecting releases, browser automation, installers, shell shims
When to read: Release claims include Linux/macOS/Windows support or local OS behavior
Canonical owner: dev-devops cross-platform release proof

---

## §1 Core Rule

CI systems such as GitHub Actions prove behavior inside their runner
environments. When a release claim depends on cross-platform local behavior that
CI cannot observe, recommend setting up the required target environment before
claiming release confidence.

Do not require direct desktop verification for every release. Require it only
when the release claim depends on OS-local behavior beyond CI's visibility.

## §2 Evidence Decision Table

| Release behavior | CI matrix enough? | Direct OS/UI verification? | Proof bundle |
|---|---:|---:|---|
| Pure library package | Usually yes | No | Test/import matrix |
| CLI binary wrapper/shim | Yes for core command behavior | Maybe for PATH/shell integration | Install, bin resolve, `--version`, `--help`, safe command |
| Browser automation/profile paths | Partial | Yes when local profile/app behavior matters | Runner smoke plus visible browser/profile proof |
| Desktop app or installer | No | Yes | Launch, permission prompt, install/uninstall evidence |
| Windows PATH/PowerShell/shim | Partial | Yes if release claim depends on Windows user behavior | Windows runner plus Windows App/RDP verification |
| macOS TCC/Keychain/app bundle | Partial | Yes | macOS runner plus visible macOS app/session proof |
| YAML/cloud-only pipeline change | Yes | No | Static validation, CI dry run, API/provider check |

## §3 Mandatory Environment Prompt

When CI cannot prove required cross-platform local behavior, ask for the target
environment instead of pretending it was verified.

Use this shape:

> This release affects `<platform behavior>`. CI can cover `<runner evidence>`,
> but cannot prove `<local behavior>`. Please provide or open `<target
> environment>` if direct verification is required before release.

Examples:

- macOS runtime, Windows-local PATH/PowerShell behavior matters:
  ask the user to provide Windows App/RDP or another visible Windows
  environment.
- Linux/CI-only runtime, macOS TCC/keychain/app bundle behavior matters:
  ask for a macOS target environment.
- Browser profile or desktop app behavior matters:
  ask for a visible target app/session and use Browser or Computer Use as
  appropriate.

## §4 Platform Matrix Scope

Matrix only platforms the project declares or the release claims to support.

| Claim | Minimum evidence |
|---|---|
| "Works on Linux" | Linux runner smoke |
| "Works on macOS" | macOS runner smoke; direct macOS proof if local UI/TCC/app behavior matters |
| "Works on Windows" | Windows runner smoke; direct Windows proof if PATH, shell, registry, or desktop behavior matters |
| "Cross-platform CLI" | Linux + macOS + Windows smoke unless support matrix is narrower |

## §5 Verification Handoff

Use `dev-testing/references/ci-pipeline.md` for runner matrix mechanics.
Use `desktop-control` or `computer-use` only when direct visible app/OS proof is
needed. Do not duplicate desktop tool instructions in this reference.
