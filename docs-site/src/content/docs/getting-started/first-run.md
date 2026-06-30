---
title: First Run
description: What happens on the first codexclaw session — hook trust, provider detection, and the IPABCD footer.
---

The first session after enabling codexclaw establishes trust and surfaces the plugin's state
affordances. Here is what to expect, in order.

## 1. Hook review

Codex prompts you to review codexclaw's hooks before they run. Approve them to let the plugin
inject context, guard goals, track PABCD state, and detect the provider bridge. Until you trust
the hooks, codexclaw behaves like a plain skill bundle.

## 2. Session start — provider detection

On `SessionStart`, codexclaw runs the provider-bridge hook. It detects whether `ocx`
(opencodex) is present and reports status only. It never starts, configures, or mutates a
provider. If `ocx` is absent, the native Codex model path stays valid.

## 3. The IPABCD footer

codexclaw tracks a per-session workflow phase. A status affordance shows the current phase:

```
IPABCD: IDLE
```

`IDLE` is the resting state. When you start a work-phase, the phase advances through
`I → P → A → B → C → D` and then closes back to `IDLE`. `D` is a closing action, not a badge that
lingers.

## 4. Your first prompt

Just describe a coding task. `cxc-dev` is implicit, so it engages automatically: it classifies the
work (C0-C5), reminds you to search before writing, and holds completion until verification runs.

To drive the PABCD loop explicitly, use the orchestrate grammar in chat or the `cxc orchestrate`
CLI — both write the same `.codexclaw` file state. See the
[PABCD Workflow](/codexclaw/guides/pabcd/) guide.

## Where state lives

codexclaw writes session-scoped state under the project's `.codexclaw/` directory:

| Path | Purpose |
|---|---|
| `.codexclaw/sessions/<sessionId>.json` | Per-session phase, flags, and orchestration state. |
| `.codexclaw/ledger.jsonl` | Append-only transition ledger. |
| `.codexclaw/interviews/<id>.jsonl` | Interview scan-evidence ledger. |
| `.codexclaw/subagents.json` | Subagent role → model/prompt config. |

See the [State Model](/codexclaw/concepts/state-model/) for the full schema.
