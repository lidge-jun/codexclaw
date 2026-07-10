---
title: Native Tools
description: How codexclaw skills route to Codex's native capabilities — browser use, computer use, deferred collab tools, imagegen, view_image, and update_plan.
---

codexclaw's discipline is only half the story — the Codex runtime already ships powerful
native surfaces, and the skills now route to them by exact tool id. The verified
inventory lives in `structure/60_native_capabilities.md` (re-verified per Codex release).

## The two collab surfaces

V1 is codexclaw's default, but the model catalog selects V2 for sol/terra and V1 for
luna; `features.multi_agent_v2` is the fallback selector for other models. The chosen
surface pins on the session's first turn. V1 collab tools
(`multi_agent_v1.spawn_agent` / `wait_agent` / `send_input` / `resume_agent` /
`close_agent`) are deferred behind `tool_search`; V2 tools are direct. If
`spawn_agent` is not visible, run `tool_search` for it first.

The spawn hook provides parity on both surfaces: it normalizes skill mentions, fills
omitted configured model/effort fields on non-full-history spawns, and applies the leaf
guard. V1 parses skill mentions natively; because upstream V2 does not, the hook inlines
recognized SKILL.md bodies into V2 spawn messages.

## Browse-use ladder (owned by `cxc-search`)

Proof-of-source escalates through named tools, stopping at the first rung that yields
primary evidence:

**agbrowse is the primary surface** while it resolves; the native tools are its
fallback tier:

1. `agbrowse fetch --json --browser never` — scripted HTTP proof; the mandatory first
   attempt (its JSON envelope is the evidence artifact)
2. agbrowse CDP — one-shot `fetch --browser auto` for JS/blocked pages, or an
   interactive session (`start --headed` → `navigate` → `snapshot --interactive` →
   `click eN` → `stop`) when steps must act on the page
3. Native fallback — `browser:control-in-app-browser` (JS/PDF/visual) and
   `chrome:control-chrome` (conversational real-profile CDP), used when agbrowse is
   unresolvable or cannot complete the flow (state why)
4. `computer-use:computer-use` — GUI-only last resort (per-app approval)

Every interactive rung follows the verification loop: inspect → act → re-inspect, with
screenshot + `view_image` fallback when DOM inspection fails.

## Computer-use QA (owned by `cxc-dev-testing` §4.6)

Playwright owns deterministic suites; the native tools own exploratory QA — "does this
change work in the real UI right now". Drive the flow, capture screenshots, read them
back with `view_image`, and attach them as PABCD C-phase evidence. Promote flows that
must stay guarded into Playwright.

## Other natives now wired into skills

| Tool | Where it's used |
|---|---|
| `update_plan` | `cxc-pabcd` PLAN-TRACK-01 — mirror plan items, keep statuses live through B |
| `imagegen` | `cxc-dev-frontend` / `cxc-dev-uiux-design` — real bitmap assets instead of placeholders |
| `view_image` | design reads, screenshot evidence, blocked-source captures |
| `multi_tool_use.parallel` | `cxc-sparksearch` / `cxc-ultraresearch` parallel lanes |
| `list_available_plugins_to_install` / `request_plugin_install` | `cxc-skill-hub` capability discovery |

CSV batch fan-out via `spawn_agents_on_csv` and `memories` remain flag-gated and are
documented as future surfaces. V2 is live through catalog selection or the fallback
feature flag; it is not part of this "not shipped" set.
