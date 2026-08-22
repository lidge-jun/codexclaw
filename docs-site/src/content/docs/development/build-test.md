---
title: Build & Test
description: The codexclaw build and test harness — reproducible, idempotent, zero external toolchain.
---

codexclaw builds and tests with the Node.js built-in toolchain only. There is no bundler, no
`tsc`, and no network step, so the build is reproducible and idempotent.

## Build

```bash
npm run build
```

This compiles each component's `src/*.ts` to `dist/*.js` using Node's built-in type stripping and
a small resolver fix so bare specifiers resolve at the shipped `dist` path. Re-running produces
the same output (idempotent).

## Test

```bash
npm test
```

The root test script runs `node --test` across every component's test directory plus the GUI and
plugin integration tests:

- `pabcd-state`
- `config-guard`
- `cxc-ops`
- `recall`
- `provider-bridge`
- `subagent-config`
- `messenger-bridge`
- `skill-search`
- `gui`
- plugin integration (`plugins/codexclaw/test/*.test.mjs`)

## CI expectations

A change is not complete until `npm run build` and `npm test` both pass. The `C → D` PABCD
transition records the test tail and a zero exit code as evidence — see the
[PABCD Workflow](/codexclaw/guides/pabcd/).

## Node version

Use Node.js 24, which is what the CI matrix pins. The build and the suite rely on built-in
TypeScript type stripping, and the hooks and CLI run under `node` directly.

Node 22 does not strip types without an explicit flag, so running `npm test` under it fails on
every file at once:

```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"
```

That is a version mismatch, not a broken tree. Check `node --version` before investigating a
suite that appears to have failed everywhere, including inside WSL, where the distro's `node`
is often older than the one on the Windows side.

## Verifying on Windows and WSL

Cross-platform behavior is covered by two workflows, and both matter:

- `ci.yml` runs ubuntu-latest, macos-latest, and windows-latest twice - once with
  `core.autocrlf=false` and once with `true`, because a default Windows git install sets
  `true` and that is the configuration that turns CRLF-safe-today readers into broken ones.
- `wsl.yml` runs a real WSL2 distro twice: once on the `/mnt/c` drvfs checkout and once on
  native ext4. Those are different filesystems with different locking and permission behavior,
  so a green run on one says nothing about the other.

Some defects only appear on a real installation. `~/.codexclaw` (the global recall index and
skill cache) exists on a developer machine and not on a runner, symlink creation needs elevation
on Windows while junctions do not, and the Store-packaged `codex` alias only exists where the
Codex desktop app is installed. If you are chasing a Windows report, reproduce it on a Windows
host rather than trusting a green matrix.
