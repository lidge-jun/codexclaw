---
title: Subagents
description: Configure per-role subagent models and prompts through codexclaw's MCP tools.
---

codexclaw lets you assign a model and prompt override to each subagent role, persisted in
`.codexclaw/subagents.json` and exposed over MCP.

## Roles

Three roles cover the common subagent workflow:

- **explorer** — broad codebase investigation and research.
- **reviewer** — adversarial audit and review.
- **executor** — focused implementation.

## MCP tools

| Tool | Purpose |
|---|---|
| `subagents_get` | Read the per-role config: `mode`, `model`, `promptOverride`. |
| `subagents_set` | Update one role's config. |
| `catalog_list` | List selectable models — Codex-native first, then `ocx`-backed when active. |

### subagents_set

```jsonc
{
  "role": "reviewer",           // explorer | reviewer | executor
  "mode": "model",              // "default" (main model) or "model" (needs a model id)
  "model": "gpt-5.5",           // required when mode is "model"
  "promptOverride": "..."       // optional per-role prompt, or null
}
```

Only `role` is required. `mode: "default"` uses the main model; `mode: "model"` requires a
`model` id from `catalog_list`.

## Configuring from the GUI

The [GUI dashboard](/codexclaw/guides/gui/) wraps these tools with model pickers and prompt
editors so you can set roles without hand-editing JSON.

The `pre-tool-use-attaching-skills` hook wires into live `spawn_agent` calls on both
surfaces, but it does not choose skills. Dispatchers explicitly name each required
skill with preferred `[$cxc-<name>](skill://<abs SKILL.md>)` links or the plugin-native
`$codexclaw:cxc-<name>` fallback. When the spawn message is plaintext, the hook normalizes
known broken/bare mentions and inlines recognized SKILL.md bodies on V2-shaped spawns.
Native ChatGPT-backend V2 gives the hook ciphertext, so both operations are no-ops there;
when no body can be inlined, it appends a plaintext `[CXC-SKILL-AFFORDANCE]` block telling
the child to self-load any `$cxc-<folder>` / `$codexclaw:cxc-<folder>` mention from
`<skillsDir>/<folder>/SKILL.md`; fork inheritance remains a secondary channel. Its other
reliable native V2 channels are the leaf guard and omitted configured
`model`/`reasoning_effort` injection for non-full-history spawns. It never invents role
baselines or inferred surface skills. Role config, resolver, and spawn-wrapper are all
shipped (L9).

## First fallback

Each role can keep one optional fallback model with its own reasoning effort.
Select both models from the existing catalog: for example `xai/grok-4.6` followed
by `cursor/grok-4.6`. The IDs distinguish the provider routes. This is ordered
failover, not round robin: a healthy primary keeps receiving work.

Global and project settings use the same whole-role inheritance as primary
settings. Old configurations have no fallback. Removing a project override also
restores the global fallback. A null fallback effort inherits the original
session's effort, not the primary role's effort.

```sh
cxc subagents set executor --fallback-model cursor/grok-4.6 --fallback-effort high
cxc subagents set executor --clear-fallback
```

The same flags apply to explorer and reviewer. When both attempts fail, the main
agent takes over remaining work. An independent review requirement remains
outstanding; main-agent work does not satisfy it.

### Execution and evidence

CXC's managed dispatch protocol selects candidates and records attempts. The main
agent still calls native spawn/wait tools. SessionStart supplies the protocol when
fallbacks are configured; the delegation skill documents the sequence. Existing
direct native calls remain possible and are not automatically retried by a hook.
Settings alone do not establish that a native host delivered every failure code.

`cxc subagents dispatch` accepts one JSON object on stdin. Begin with
`{"action":"start","sessionId":"<native-session>","dispatchId":"<unique-task>","role":"executor"}`.
Claim the returned attempt with `action:claim` and `attemptId`. Only `action:spawn`
authorizes one call; include its marker at the start of the native task message.
Report creation/completion or failure, and inspect `action:status` after a lost
response. Records live under `.codexclaw/dispatches/<session>/<dispatch>.json`.

Quota/model availability failures can select the fallback. Policy, permission,
authentication and cancellation failures stop. Ambiguous creation or ongoing work
must be reconciled before replacement; stopped executors require a change review
and cleanup evidence. Unknown error prose does not trigger blind rotation.

OCX retains its own retries and global/per-model fallback. The two-attempt limit
applies to CXC-issued native attempts, not every downstream provider request.
Requested and observed models are recorded separately; an unobserved actual model
stays unknown. No quota balance, even split, or universal native-hook delivery is
implied by configuring a fallback.
