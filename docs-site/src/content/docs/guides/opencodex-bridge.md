---
title: OpenCodex Bridge
description: How codexclaw detects opencodex (ocx) — detect-only, with native fallback always valid.
---

codexclaw can detect [opencodex](https://github.com/lidge-jun/opencodex) (`ocx`) when it is
present. The bridge is **detect-only**: codexclaw reads provider status and never mutates it.

## What the bridge does

- On `SessionStart`, the provider-bridge hook checks whether `ocx` is present and reports its
  status.
- When `ocx` is active, `catalog_list` can surface `ocx`-backed models alongside Codex-native
  ones for [subagent](/codexclaw/guides/subagents/) selection.
- The native Codex model path always stays valid. If `ocx` is absent, nothing degrades.

## What the bridge does not do

- It does not run `ocx ensure`, `ocx init`, `ocx start`, or any unannounced provider mutation.
- It does not manage providers, auth, account pools, or sidecars.
- It does not proxy `/v1/responses` traffic.

:::tip[Provider setup lives in opencodex docs]
Provider configuration, OAuth, the API-key catalog, account pools, sidecars, and proxy behavior
all belong to [opencodex's own documentation](https://github.com/lidge-jun/opencodex). codexclaw
intentionally does not copy or reimplement them.
:::

## Why detect-only

Keeping the bridge read-only preserves the [plugin boundary](/codexclaw/concepts/plugin-boundary/):
codexclaw stays a Codex plugin layer instead of becoming a provider proxy, and an `ocx` upgrade
can never be triggered as a surprise side effect of a codexclaw session.
