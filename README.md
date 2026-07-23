**English** | [한국어](README.ko.md) | [中文](README.zh.md)

<p align="center">
  <img src="docs-site/public/logo.png" alt="codexclaw" width="140" />
</p>

<h1 align="center">codexclaw</h1>

<p align="center">
  Development discipline and multi-model subagents for <strong>OpenAI Codex</strong>,<br>
  packaged as a single plugin.
</p>

<p align="center">
  <a href="https://github.com/lidge-jun/codexclaw/actions/workflows/ci.yml"><img src="https://github.com/lidge-jun/codexclaw/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/tests-1%2C201_passing-brightgreen" alt="1,201 tests passing">
  <img src="https://img.shields.io/badge/skills-27-blue" alt="27 skills">
  <img src="https://img.shields.io/badge/hooks-18-blue" alt="18 hooks">
  <a href="https://lidge-jun.github.io/codexclaw/"><img src="https://img.shields.io/badge/docs-codexclaw-black" alt="Documentation"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT"></a>
</p>

---

codexclaw turns the Codex runtime into a disciplined development environment. It does not ship its own agent harness — it layers skills, hooks, and components directly on `codex`, adding structured workflows, coding discipline, and multi-model orchestration that the base runtime doesn't provide.

## Features

**Dev Skill Family** — 12 surface-specific routers (`dev-architecture`, `dev-backend`, `dev-frontend`, `dev-testing`, `dev-security`, `dev-debugging`, `dev-data`, `dev-devops`, `dev-code-reviewer`, `dev-scaffolding`, `dev-diagram-viewer`, `dev-uiux-design`) governed by a canonical parent (`dev`). Every router inherits the parent's rule classes, verification gate, and safety rules. 155 unique rule IDs across the family.

**PABCD Workflow** — Plan / Audit / Build / Check / Done, implemented as a file-backed FSM with attestation-gated transitions. Phases advance through `cxc orchestrate` commands; each transition carries structured evidence. A durable goalplan ledger tracks work phases, success criteria, and captured proof across multiple cycles.

```
IDLE ── P ── A ── B ── C ── D ── IDLE
       │    │    │
      gate  gate gate
       └────┴────┴──── I (Interview, context preserved)
```

**Multi-Model Subagents** — role-based dispatch (explorer / reviewer / executor) with per-role model and prompt overrides. Configuration persists across sessions and applies automatically through the spawn-wrapper hook. A local GUI (Vite + React) provides visual config and, when opencodex is detected, a provider link bar. (Dashboard: build from a repo checkout for now; bundled in a follow-up release.)

**Recall** — searches past Codex conversations and the memory store from disk artifacts before asking the user, so context survives session boundaries and compaction.

**Repo Map** — `cxc map <dir>` runs tree-sitter parsing + PageRank ranking to produce a structure overview of unfamiliar code, letting the agent orient before deep `rg` dives.

**Skill Search** — `cxc skill search <query>` discovers dormant skills across cli-jaw-skills (primary), ClawHub, and Hermes catalogs. `cxc skill show <id>` loads them on demand.

## Install

2 lines to install. No build step, no npm install, no config edits.

```bash
codex plugin marketplace add https://github.com/lidge-jun/codexclaw
codex plugin add codexclaw@codexclaw
```

Then restart Codex and approve the 18 hooks when prompted (upgrades ask again — content-hash trust). Everything runs from chat, no CLI needed:

- `orchestrate status` — check the PABCD state machine
- "Interview me first, then draft a diff-level plan."
- "Plan this with codexclaw PABCD and use multi-model subagents."

<details>
<summary><b>Update / uninstall / optional CLI</b></summary>

```bash
codex plugin marketplace upgrade codexclaw   # update
codex plugin remove codexclaw@codexclaw      # uninstall
```

After an upgrade Codex marks the hooks **Modified** — re-approve them to reactivate.

The `cxc` CLI ships with a repository checkout (the marketplace install activates skills, hooks, and MCP without it):

```bash
git clone https://github.com/lidge-jun/codexclaw
alias cxc='node /path/to/codexclaw/bin/codexclaw.mjs'   # or: npm link
```

</details>

## Architecture

```
plugins/codexclaw/
│
├── skills/                      27 skills
│   ├── dev/                     canonical parent — work classifier, routing, verification gate
│   ├── dev-*/                   12 surface routers (architecture → uiux-design)
│   ├── pabcd/                   PABCD workflow phases + attestation
│   ├── loop/                    durable goalplan + Stop-continuation contract
│   ├── interview/               IPABCD requirements discovery
│   ├── search/                  web search + evidence routing ladder
│   ├── recall/                  past-session + memory store search
│   └── repo-map/                tree-sitter + PageRank structure map
│
├── hooks/                       18 active hooks across the session lifecycle
│   ├── session-start-*          provider bridge, PABCD bootstrap, map affordance, recall context
│   ├── user-prompt-submit-*     PABCD trigger detection, recall intent
│   ├── pre-tool-use-*           skill attach, goal guards, patch lint, interview guard
│   ├── post-tool-use-*          interview capture, render observation
│   ├── stop-*                   PABCD continuation under active goals
│   ├── subagent-stop-*          evidence verification for worker dispatches
│   └── post-compact-*           cursor reinject, recall context, bg-terminal affordance
│
├── components/                  8 isolated feature modules (src + dist)
│   ├── pabcd-state/             FSM engine, session files, orchestrate CLI, attest gates
│   ├── subagent-config/         per-role model/prompt store + MCP surface
│   ├── recall/                  disk-artifact search across sessions + memory
│   ├── skill-search/            remote catalog query (jaw / clawhub / hermes)
│   ├── provider-bridge/         read-only opencodex detection
│   ├── messenger-bridge/        Telegram/Discord adapter (cxc serve)
│   ├── config-guard/            plugin enable/disable/status
│   └── cxc-ops/                 doctor + reset utilities
│
└── gui/                         local dashboard (Vite + React, build from source)
```

_The `cxc` CLI (`bin/codexclaw.mjs` + `cli/` workspace) lives at the repository root, outside the plugin payload._

## Dev Skill Family

Every coding task is classified (C0-C5) before process depth is chosen. The parent `dev` skill routes to surface-specific routers based on what's being changed:

| Surface | Router | Also loads |
|---------|--------|------------|
| Backend / API | `dev-backend` | `dev-security` for auth |
| Frontend / UI | `dev-frontend` | `dev-uiux-design` for direction |
| Database / data | `dev-data` | `dev-backend` for migrations |
| Tests / QA | `dev-testing` | `dev-frontend` for browser QA |
| Security | `dev-security` | surface-specific router |
| Architecture | `dev-architecture` | `dev-scaffolding` for structure |
| Debugging | `dev-debugging` | surface-specific router |
| DevOps / infra | `dev-devops` | `dev-security` for credentials |
| Scaffolding | `dev-scaffolding` | `dev-architecture` for boundaries |
| Code review | `dev-code-reviewer` | `dev-security` + `dev-testing` |
| Diagrams | `dev-diagram-viewer` | — |

Each router carries its own modular references (loaded on demand, never preloaded) and inherits the parent's verification gate, rule classes, and safety rules.

## CLI

```bash
cxc orchestrate P|A|B|C|D|status|reset   # PABCD phase control
cxc loop init|show|validate               # durable goalplan management
cxc map <dir>                             # tree-sitter structure map
cxc skill search <query>                  # remote skill discovery
cxc skill show <id>                       # load a discovered skill
cxc help                                  # command reference
```

## Ecosystem

codexclaw is the reference implementation. The methodology and skills are ported (agent-neutral, no plugin dependency) to:

| Repo | Role |
|------|------|
| [pabcd_initiative](https://github.com/lidge-jun/pabcd_initiative) | Methodology spec + docs-site + agent-neutral skill set |
| [cli-jaw](https://github.com/lidge-jun/cli-jaw) | Boss/employee agent harness with skills_ref submodule |
| [ima2-gen](https://github.com/lidge-jun/ima2-gen) | Image generation tool with ima2-front/ima2-uiux skills |

## Documentation

Plugin documentation: **[lidge-jun.github.io/codexclaw](https://lidge-jun.github.io/codexclaw/)**

Methodology and research provenance: **[lidge-jun.github.io/pabcd_initiative](https://lidge-jun.github.io/pabcd_initiative/)** — skill architecture, delegation economy, loop contracts, devlog records, and the arXiv-backed claim ledger.

## License

[MIT](LICENSE)

Third-party: RepoMapper (MIT, Pete Davis) and Aider tree-sitter queries (Apache-2.0). See [`NOTICE.md`](plugins/codexclaw/skills/repo-map/scripts/NOTICE.md).
