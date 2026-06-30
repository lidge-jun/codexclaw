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
- `provider-bridge`
- `subagent-config`
- `gui`
- plugin integration (`plugins/codexclaw/test/*.test.mjs`)

## CI expectations

A change is not complete until `npm run build` and `npm test` both pass. The `C → D` PABCD
transition records the test tail and a zero exit code as evidence — see the
[PABCD Workflow](/codexclaw/guides/pabcd/).

## Node version

Use Node.js 22+. The build relies on built-in TypeScript type stripping, and the hooks and CLI
run under `node` directly.
