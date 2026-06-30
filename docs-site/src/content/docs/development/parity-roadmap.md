---
title: Parity Roadmap
description: What is shipped, planned, and deferred in codexclaw, against cli-jaw / opencodex parity.
---

codexclaw labels every capability honestly. A <span class="cxc-badge cxc-badge--current">current</span>
feature is shipped and tested; <span class="cxc-badge cxc-badge--planned">planned</span> means the
design is decided but the runtime is not built; <span class="cxc-badge cxc-badge--deferred">deferred</span>
means intentionally postponed. The docs never describe a planned feature as if it shipped.

## Shipped (current)

| Area | Status |
|---|---|
| FSM legal-transition table + attest gate | <span class="cxc-badge cxc-badge--current">current</span> |
| `$cxc-orchestrate` chat grammar + hook wiring | <span class="cxc-badge cxc-badge--current">current</span> |
| `cxc orchestrate` CLI over the same file state | <span class="cxc-badge cxc-badge--current">current</span> |
| `status` / `reset` / `D` affordances + phase footer | <span class="cxc-badge cxc-badge--current">current</span> |
| Stop-continuation loop with termination guards | <span class="cxc-badge cxc-badge--current">current</span> |
| `$cxc-goalplan` / `$cxc-loop` skill contracts | <span class="cxc-badge cxc-badge--current">current</span> |
| Interview scan-evidence ledger + `I → P` soft-gate | <span class="cxc-badge cxc-badge--current">current</span> |
| Subagent role config + MCP tools | <span class="cxc-badge cxc-badge--current">current</span> |
| opencodex detect-only bridge | <span class="cxc-badge cxc-badge--current">current</span> |

## Planned

| Area | Status | Notes |
|---|---|---|
| Live spawn-wrapper consuming the role resolver | <span class="cxc-badge cxc-badge--planned">planned</span> | Config + resolver exist; no live `spawn_agent` caller yet (L9). |
| Developer docs site build/publish | <span class="cxc-badge cxc-badge--planned">planned</span> | This site is the first scaffold pass (L11). |
| Interview PostToolUse answer capture + narrow Stop guard | <span class="cxc-badge cxc-badge--planned">planned</span> | No PostToolUse hook yet (L12). |
| `cxc subagents` / `cxc provider` CLI | <span class="cxc-badge cxc-badge--planned">planned</span> | Placeholder commands today. |
| npm / npx packaging | <span class="cxc-badge cxc-badge--planned">planned</span> | Package is private; `dist/` unpublished (L20). |

## Deferred / non-goals

| Area | Status | Reason |
|---|---|---|
| codex-rs slash-command fork | <span class="cxc-badge cxc-badge--deferred">deferred</span> | Stay inside the plugin boundary. |
| cli-jaw server / employee model | <span class="cxc-badge cxc-badge--deferred">deferred</span> | codexclaw is a plugin, not a daemon. |
| jawcode runtime harness clone | <span class="cxc-badge cxc-badge--deferred">deferred</span> | Use Codex-native hooks and file state. |
| opencodex provider proxy / `ocx ensure` | <span class="cxc-badge cxc-badge--deferred">deferred</span> | Detect-only; provider work belongs to opencodex. |
| Filesystem-grep chat search | <span class="cxc-badge cxc-badge--deferred">deferred</span> | Native thread search is a runtime concern (chat-search retired). |

:::note[Source of truth]
This roadmap mirrors the maintainer ledgers under `devlog/_plan/mvp_hard/`. When a planned item
ships and is tested, both the ledger and this page move it to current together.
:::
