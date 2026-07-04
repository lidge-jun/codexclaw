---
title: Plugin Boundary
description: What codexclaw is and is not — a Codex plugin layer with one opt-in loopback relay, not a harness or provider proxy.
---

codexclaw deliberately stays inside the Codex plugin boundary. Knowing what it is — and what it
is not — prevents confusing it with its sibling projects.

## What codexclaw is

A single Codex plugin that provides:

- **Skills** for development discipline and workflows.
- **Hooks** for context injection, goal guards, PABCD state, and provider detection.
- **MCP tools** for subagent model/prompt config.
- a small **`cxc` / `codexclaw` CLI**.
- **optional opencodex (`ocx`) detection only.**
- an opt-in **loopback messenger bridge** (`cxc serve`) for Telegram/Discord relay.

:::note[Scoped loopback exception]
`cxc serve` is the one server-shaped exception to the no-server rule: it binds to
`127.0.0.1`, serves the dashboard and JSON API on the same origin, and stores bridge state in
the project-local `.codexclaw/bridge.db`. It is optional; nothing else in codexclaw depends on it
running.
:::

## What codexclaw is not

- Not a [cli-jaw](https://github.com/lidge-jun) server. There is no employee/boss model and no
  required orchestration server. The messenger bridge is a loopback relay to stock `codex exec`,
  not a jaw-style control plane.
- Not a jawcode runtime harness. codexclaw uses Codex-native hooks, skills, and file state
  instead of slash commands, receipts, and a `.jwc/goal` runtime.
- Not an opencodex provider proxy. codexclaw detects `ocx`; it does not route requests, manage
  accounts, or run sidecars.
- Not a codex-rs fork. It adds no slash commands to the Codex binary.

## Why this matters

The boundary keeps codexclaw upgrade-safe and honest:

- It rides the Codex runtime instead of patching it, so Codex upgrades do not break it.
- It never claims a sibling project's capabilities. Provider setup, auth, account pools, and the
  `/v1/responses` proxy belong to [opencodex docs](https://github.com/lidge-jun/opencodex).
- Loopback relay docs are explicit about the exception: opt-in, local-only, allowlisted, and not an
  orchestrator.
- Planned features are labeled planned. See the
  [Parity Roadmap](/codexclaw/development/parity-roadmap/) for the shipped-vs-planned split.
