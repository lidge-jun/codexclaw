# codexclaw GUI

Local web dashboard (Vite + React, mirrors the opencodex GUI stack).

## Pages (MVP target)

- **Subagents** — configure each role (explorer/reviewer/executor): default model vs multi-model selection, and per-role prompt overrides. Backed by `.codexclaw/subagents.json` via the `subagent-config` component.
- **Prompts** — tune system/role prompts.
- **Provider link bar** — when `ocx` is detected, show a link to the opencodex dashboard at `http://localhost:10100`. Hidden when ocx is absent.

GUI scaffolding (package.json, vite config, React app) lands in MVP plan step 05.
