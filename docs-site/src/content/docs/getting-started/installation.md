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

## Track 1 — Marketplace / codexclaw plugin install

Add the codexclaw marketplace, then install the plugin from that marketplace:

```bash
codex plugin marketplace add https://github.com/lidge-jun/codexclaw
codex plugin add codexclaw@codexclaw
```

The marketplace install registers the plugin manifest with Codex, including its skills, hooks,
and MCP server.

It also ships the CLI: the payload includes a dispatcher at `bin/cxc.mjs`, so every install has
a working terminal surface without any extra step:

```bash
node "<pluginRoot>/bin/cxc.mjs" doctor
```

The SessionStart banner prints the exact resolved invocation for your machine when `cxc` is not
on `PATH`, and injected directives use it. (`gui` and `map` stay repo-checkout-only; the
dispatcher prints a pointer for those.)

Update and uninstall use the same marketplace surface:

```bash
codex plugin marketplace upgrade codexclaw   # update
codex plugin remove codexclaw@codexclaw      # uninstall
```

After an upgrade Codex marks the hooks **Modified** — re-approve them to reactivate
(content-hash trust model).

**What works immediately:** restart Codex, approve the hooks, and drive everything from
chat — try `orchestrate status`, or "Interview me first, then draft a diff-level plan."
A PATH-level `cxc` binary (Track 3) is a convenience, not a prerequisite.

## Track 2 — Local dogfood with a dev symlink

For active development, symlink the working checkout into the Codex plugin cache so approved hooks
execute your local files:

```bash
scripts/dev-symlink.sh
```

This links the plugin-cache children to your checkout. Edits to skills, hooks, and component
`dist/` take effect without reinstalling.

## Track 3 — PATH-level `cxc` from a source checkout

This track is a convenience: it puts a literal `cxc` command on your `PATH` and unlocks the two
repo-checkout-only verbs (`gui` and `map`). If you cloned the repo directly and have not linked
a global `cxc`, activate through the bundled entry point:

```bash
node bin/codexclaw.mjs enable
```

Once a global `cxc` / `codexclaw` bin is on your `PATH` (npm link or a shell alias to
`bin/codexclaw.mjs`), use `cxc enable` instead.

:::caution[npm / npx distribution is planned, not shipped]
The root package is currently private and `dist/` is not published, so `npx codexclaw` is not yet
a supported install path. Use a source checkout or the dev symlink until packaging lands
(tracked as L20 on the [parity roadmap](/codexclaw/development/parity-roadmap/)).
:::

## Hook trust

codexclaw ships 18 active hooks. Codex requires you to review and trust hooks before they run:

- The first start after install or upgrade prompts a Codex hook review.
- Under the symlink dogfood track, approved hooks execute mutable local checkout files, so review
  what you trust.
- codexclaw must not forge hook trust or hand-edit Codex trust state. If a hook does not run,
  re-check trust in Codex rather than editing trust files.

## Verify

Marketplace install: the plugin shows up in `codex plugin list`. From a source checkout with
the CLI activated:

```bash
cxc doctor
```

`doctor` reports component health and, when present, opencodex (`ocx`) detection status. See
[First Run](/codexclaw/getting-started/first-run/) for what to expect on the first session.
