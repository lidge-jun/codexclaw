---
title: GUI Dashboard
description: The codexclaw local dashboard for subagent model selection and prompt tuning.
---

codexclaw ships a small local dashboard for configuring subagents without hand-editing JSON.

## Launch

```bash
cxc gui
```

`gui` starts the Vite dev server (it prints the local URL). If dependencies are not installed,
run `npm install` in `plugins/codexclaw/gui` first.

:::caution[Local-only, unauthenticated]
The GUI is a local development dashboard with no authentication. It is meant for `localhost`
use on your own machine. Do not expose it on a shared network or bind it to a public interface.
:::

## Tabs

- **Subagents** — pick a mode (default model vs a specific model) and model per role, and edit
  per-role prompt overrides inline. Writes through the
  [subagent MCP tools](/codexclaw/guides/subagents/).
- **Prompts** — per-role prompt overrides are edited inline on the Subagents tab; defaults
  inherit the role skill prompt.

## OpenCodex link bar

The dashboard shows a provider link bar reflecting [bridge](/codexclaw/guides/opencodex-bridge/)
state: `native` when `ocx` is absent, or the detected provider/port when `ocx` is active. The bar
reflects detection only — it does not start or configure a provider.
