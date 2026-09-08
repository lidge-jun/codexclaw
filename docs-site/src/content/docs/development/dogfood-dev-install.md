---
title: Dogfood & Dev Install
description: Develop codexclaw against a live Codex plugin cache using a real local install.
---

To work on codexclaw while running it inside Codex, install your working checkout as a real
plugin copy from a local marketplace rooted at the repo.

## The dev install

```bash
scripts/dev-install.sh
```

The script builds the components, makes sure the `codexclaw` marketplace points at your checkout,
then runs `codex plugin add codexclaw@codexclaw`. Codex copies the payload into the plugin cache and
prunes files that no longer exist in the source, so re-running the script is the whole update loop.

Check the current install state without changing anything:

```bash
scripts/dev-install.sh --status
```

Skip the build when only skills, hooks, or docs changed:

```bash
scripts/dev-install.sh --no-build
```

## Why not symlinks

An earlier `scripts/dev-symlink.sh` replaced each plugin-cache child with a symlink into the repo so
edits were live with no reinstall. Codex does not resolve those symlinked entries reliably, and the
plugin can silently fail to load. The dev install trades that liveness for a real copy: you reinstall
after each change, and what Codex loads is exactly what is on disk in the cache. `dev-install.sh`
deletes any leftover symlinks it finds in the cache before installing.

## Rebuild after editing components

Hooks and the CLI run from compiled `dist/`. The default `scripts/dev-install.sh` path runs
`npm run build` for you; run it directly when you want the build alone:

```bash
npm run build
```

See [Build & Test](/codexclaw/development/build-test/) for the build and test harness.

:::caution[Trust hashes the declaration, not the files]
The trust hash covers each hook's declaration — event, matcher, command, timeout, async flag and
status message — not the files the hook runs. Editing a matcher or command in `hooks/*.json` breaks
trust and Codex marks that hook **Modified** until you re-approve it; rebuilding the component
`dist/` a hook invokes changes many bytes and keeps its trust. codexclaw must not forge hook trust —
re-trust through Codex.
:::

:::note[New thread to pick up changes]
Skills, hooks, and MCP tools are read when a session starts. Open a new Codex thread after
reinstalling.
:::
