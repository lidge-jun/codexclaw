---
title: Installation
description: Install codexclaw as a Codex plugin — marketplace, local dogfood symlink, and activation, plus hook-trust caveats.
---

codexclaw installs through standard Codex plugin surfaces. There are three install tracks; pick
the one that matches how you obtained the plugin.

## Prerequisites

- OpenAI Codex (CLI, TUI, or App) with plugin support.
- Node.js 22+ (the components and hooks run under `node`).
- Optional: [opencodex](https://github.com/lidge-jun/opencodex) (`ocx`) if you want the
  provider bridge to detect routed models.

## Track 1 — Marketplace / personal plugin install

Install codexclaw as a personal Codex plugin through your plugin marketplace entry, then enable
it from a source checkout or symlinked cache:

```bash
cxc enable
```

`enable` delegates to the config-guard component, which registers the plugin's skills, hooks, and
MCP server with Codex.

## Track 2 — Local dogfood with a dev symlink

For active development, symlink the working checkout into the Codex plugin cache so approved hooks
execute your local files:

```bash
scripts/dev-symlink.sh
```

This links the plugin-cache children to your checkout. Edits to skills, hooks, and component
`dist/` take effect without reinstalling.

## Track 3 — Activation from a source checkout

If you cloned the repo directly and have not linked a global `cxc`, activate through the bundled
entry point:

```bash
node bin/codexclaw.mjs enable
```

Once a global `cxc` / `codexclaw` bin is on your `PATH` (npm link or marketplace install), use
`cxc enable` instead.

:::caution[npm / npx distribution is planned, not shipped]
The root package is currently private and `dist/` is not published, so `npx codexclaw` is not yet
a supported install path. Use a source checkout or the dev symlink until packaging lands
(tracked as L20 on the [parity roadmap](/codexclaw/development/parity-roadmap/)).
:::

## Hook trust

codexclaw ships seventeen hooks. Codex requires you to review and trust hooks before they run:

- The first start after install or upgrade prompts a Codex hook review.
- Under the symlink dogfood track, approved hooks execute mutable local checkout files, so review
  what you trust.
- codexclaw must not forge hook trust or hand-edit Codex trust state. If a hook does not run,
  re-check trust in Codex rather than editing trust files.

## Verify

```bash
cxc doctor
```

`doctor` reports component health and, when present, opencodex (`ocx`) detection status. See
[First Run](/codexclaw/getting-started/first-run/) for what to expect on the first session.
