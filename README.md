# codexclaw

cli-jaw-style development discipline and multi-model subagents for the **OpenAI Codex runtime**, packaged as a single Codex plugin.

codexclaw does **not** ship its own agent harness. It reuses the `codex` runtime and layers on top:

- **dev skills** — the cli-jaw `dev-*` family normalized to Codex `SKILL.md` convention (project-agnostic discipline: architecture, debugging, testing, review, security, ...).
- **PABCD workflow** — Plan / Audit / Build / Check / Done, reimplemented as Codex-native skills + hooks + file state (no external orchestrator server).
- **multi-model subagents** — role-based subagents (explorer / reviewer / executor) that can run on the default model or different models.
- **optional opencodex (ocx) provider bridge** — when `ocx` is installed, codexclaw detects its read-only status for catalog/link-bar context. It never runs `ocx ensure`/`sync` or mutates Codex provider config; when `ocx` is absent, codexclaw stays on the native Codex path.

## Layout

```
codexclaw/
├── .agents/plugins/marketplace.json     # marketplace registration
├── plugins/codexclaw/
│   ├── .codex-plugin/plugin.json         # plugin manifest
│   ├── skills/                           # dev-* + pabcd skills
│   ├── hooks/                            # session-start / prompt / stop hooks
│   ├── agents/                           # subagent role .toml definitions
│   ├── components/                       # isolated feature sources (src + dist)
│   │   ├── provider-bridge/              # ocx detect-only / graceful native path
│   │   ├── pabcd-state/                  # PABCD FSM + state file
│   │   └── subagent-config/              # subagent model/prompt config store + MCP
│   └── gui/                              # local web dashboard (Vite + React)
├── cli/                                  # codexclaw CLI commands
└── devlog/                               # _plan (MVP plans) + _fin (done) + .lazycodex (reference)
```

## Install (target flow)

```bash
codex plugin marketplace add https://github.com/lidge-jun/codexclaw
codex plugin add codexclaw@personal
```

## GUI

The codexclaw GUI handles subagent configuration (default model vs multi-model), prompt tuning, and — when `ocx` is detected — a link bar to the opencodex dashboard at `localhost:10100`.

## Status

MVP core is implemented and the `mvp_hard` L2-L11 parity hardening track is active:
`cxc orchestrate` is live, chat-side phase control writes the same `.codexclaw/` state,
the IPABCD footer/status affordance is wired, and the Stop-continuation loop runs under
an active Codex goal with a bounded stagnation guard. See `devlog/_plan/` for the shipped
ledger and remaining hardening slices.
