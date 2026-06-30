---
title: Dogfood & Dev Symlink
description: Develop codexclaw against a live Codex plugin cache using the dev symlink.
---

To work on codexclaw while running it inside Codex, point the installed plugin cache at your
working checkout.

## The dev symlink

```bash
scripts/dev-symlink.sh
```

The script keeps the plugin version directory in the Codex cache but replaces each child entry
with a symlink back into the repo. Edits in the repo are then live on the next session — no
reinstall needed.

Check the current link state:

```bash
scripts/dev-symlink.sh --status
```

## What gets linked

Skills, hooks, and the components' compiled `dist/` are linked from the cache to your checkout.
Because the linked files are mutable, the hooks you trust in Codex execute your live code — keep
that in mind when reviewing hook trust.

## Rebuild after editing components

Hooks and the CLI run from compiled `dist/`. After editing component `src/`, rebuild:

```bash
npm run build
```

See [Build & Test](/codexclaw/development/build-test/) for the build and test harness.

:::caution[Trust runs local files]
Under the symlink track, approved hooks run your local checkout. codexclaw must not forge hook
trust or hand-edit Codex trust state — re-trust through Codex if a hook stops running.
:::
