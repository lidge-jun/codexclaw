# codexclaw

<p align="center">
  <img src="docs-site/public/logo.png" alt="codexclaw split Codex blossom and OpenClaw claw logo" width="180" />
</p>

cli-jaw-style development discipline and multi-model subagents for the **OpenAI Codex runtime**, packaged as a single Codex plugin.

codexclaw does **not** ship its own agent harness. It reuses the `codex` runtime and layers on top:

- **dev skills**: the cli-jaw `dev-*` family normalized to Codex `SKILL.md` convention (project-agnostic discipline: architecture, debugging, testing, review, security, ...).
- **PABCD workflow**: Plan / Audit / Build / Check / Done, reimplemented as Codex-native skills + hooks + file state (no external orchestrator server).
- **multi-model subagents**: role-based subagents (explorer / reviewer / executor). Per-role model/prompt config is persisted, resolved, and applied to live `spawn_agent` calls through the spawn-wrapper hook (shipped L9).
- **optional opencodex (ocx) provider bridge**: when `ocx` is installed, codexclaw detects its read-only status for catalog/link-bar context. It never runs `ocx ensure`/`sync` or mutates Codex provider config; when `ocx` is absent, codexclaw stays on the native Codex path.

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
│   │   ├── config-guard/                 # plugin enable/disable/status
│   │   ├── cxc-ops/                      # doctor + reset
│   │   ├── provider-bridge/              # ocx detect-only / graceful native path
│   │   ├── pabcd-state/                  # PABCD FSM + state file + orchestrate CLI
│   │   ├── recall/                       # Codex-native session/memory disk-artifact recall
│   │   ├── messenger-bridge/             # messenger integration bridge (cxc serve + adapters)
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

The codexclaw GUI handles subagent configuration (default model vs multi-model), prompt tuning, and, when `ocx` is detected, a link bar to the opencodex dashboard at `localhost:10100`.

## Status

MVP core is implemented and the `mvp_hard` parity hardening track is complete through L20:
L2-L9 and L11-L20 are shipped+tested (L11 docs-site shipped 2026-07-05); L10 is
decision-closed (most is host-native). `cxc orchestrate`
is live, chat-side phase control writes the same `.codexclaw/` state, the IPABCD
footer/status affordance is wired, and the Stop-continuation loop runs under an active Codex
goal with a bounded stagnation guard. Seventeen hooks cover session lifecycle, orchestration,
pre/post-tool guards, subagent evidence, and compaction recovery. See `devlog/_plan/` for
the shipped ledger and remaining hardening slices.
