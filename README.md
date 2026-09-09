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
  <img src="https://img.shields.io/badge/tests-2%2C794_passing-brightgreen" alt="2,794 tests passing">
  <img src="https://img.shields.io/badge/skills-29-blue" alt="29 skills">
  <img src="https://img.shields.io/badge/hooks-24-blue" alt="24 hooks">
  <a href="https://lidge-jun.github.io/codexclaw/"><img src="https://img.shields.io/badge/docs-codexclaw-black" alt="Documentation"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT"></a>
</p>

Workflow inspiration: [OMO / oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent). Some components are adapted from historical MIT-licensed LazyCodex/OMO; [credits, pinned sources and modifications](NOTICE.md). CodexClaw is a separate, unofficial project.

---

codexclaw turns the Codex runtime into a disciplined development environment. It does not ship its own agent harness — it layers skills, hooks, and components directly on `codex`, adding structured workflows, coding discipline, and multi-model orchestration that the base runtime doesn't provide.

## Features

**Dev Skill Family** — 12 surface-specific routers (`dev-architecture`, `dev-backend`, `dev-frontend`, `dev-testing`, `dev-security`, `dev-debugging`, `dev-data`, `dev-devops`, `dev-code-reviewer`, `dev-scaffolding`, `dev-visualizer`, `dev-uiux-design`) governed by a canonical parent (`dev`). Every router inherits the parent's rule classes, verification gate, and safety rules. 155 unique rule IDs across the family.

**PABCD Workflow** — Plan / Audit / Build / Check / Done, implemented as a file-backed FSM with attestation-gated transitions. Phases advance through `cxc orchestrate` commands; each transition carries structured evidence. A durable goalplan ledger tracks work phases, success criteria, and captured proof across multiple cycles.

```
IDLE ── P ── A ── B ── C ── D ── IDLE
       │    │    │
      gate  gate gate
       └────┴────┴──── I (Interview, context preserved)
```

**Multi-Model Subagents** — role-based dispatch (explorer / reviewer / executor) with per-role model and prompt overrides. Configuration persists across sessions and applies automatically through the spawn-wrapper hook. A local GUI (Vite + React) provides visual config and, when opencodex is detected, a provider link bar. (Dashboard: build from a repo checkout for now; bundled in a follow-up release.)

Subagent settings resolve **per role: project → global → original session**. Open **Global Settings** to edit user defaults in `$CODEXCLAW_HOME/subagents.json` (default `~/.codexclaw/subagents.json`). The existing **Subagents** page edits `<project>/.codexclaw/subagents.json`: each model dropdown offers **Main model**, **Global settings**, and individual models. Global settings follows the entire role's defaults, including effort and prompt; choose a main/direct model to customize that project role. Existing explicit project entries and `effort: null` retain their meaning. Main model changes only the model source; session effort separately inherits the original session's effort.

The shared catalog reads OCX's enabled models with the non-mutating `ocx models live --json`, refreshes after a short cache lifetime, and supports **Refresh models**. Disabled or pending models are excluded. If OCX is absent it reads the configured Codex catalog (`model_catalog_json`, with `CODEX_MODELS_CACHE_PATH` override). An unavailable source yields an explicit error or labeled last-known list, never a fabricated four-model roster. The dashboard restricts effort choices to the model's advertised supported values; CLI/MCP validation still validates wire values only, not model-specific compatibility.

CLI list/get/set/reset accept trailing `--global`. MCP `subagents_get`/`subagents_set` and GET `/api/subagents?scope=global` / POST `scope: "global"` share the same store. `inherit: true` removes the selected scope's entire role override; `effort: null` only clears effort. The former unpublished `$CODEX_HOME/codexclaw/subagents.json` path is read only if the canonical file is absent and `CODEXCLAW_HOME` is not explicitly set. The first explicit global edit/reset preserves its other roles in the canonical file and leaves the old file untouched.



**Recall** — searches past Codex conversations and the memory store from disk artifacts before asking the user, so context survives session boundaries and compaction.

**Repo Map** — `cxc map <dir>` runs tree-sitter parsing + PageRank ranking to produce a structure overview of unfamiliar code, letting the agent orient before deep `rg` dives. (Repo checkout only — requires the vendored Python toolchain.)

**Skill Search** — `cxc skill search <query>` discovers dormant skills across cli-jaw-skills (primary), ClawHub, and Hermes catalogs. `cxc skill show <id>` loads them on demand.

## Install

2 lines to install. No build step, no npm install, no config edits.

```bash
codex plugin marketplace add https://github.com/lidge-jun/codexclaw
codex plugin add codexclaw@codexclaw
```

Then restart Codex and approve the 24 hooks when prompted (upgrades ask again — content-hash trust). Everything runs from chat, and the terminal surface ships too — the payload includes its own `cxc` dispatcher, so agent-driven `cxc orchestrate` commands work on every install:

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
Upgrading to 0.1.1+ also delivers the payload CLI (`bin/cxc.mjs`); existing installs must upgrade (or re-add) to receive new top-level directories.

The CLI has two tiers. Every install ships the payload dispatcher — no PATH setup needed; when `cxc` isn't on PATH, the session-start banner prints this exact invocation:

```bash
node "<plugin-root>/bin/cxc.mjs" orchestrate status --session <id>
```

A PATH-level `cxc` is an optional convenience from a repository checkout (also unlocks `cxc map` and `cxc gui`):

```bash
git clone https://github.com/lidge-jun/codexclaw
alias cxc='node /path/to/codexclaw/bin/codexclaw.mjs'   # or: npm link
```

</details>

## Development install (dogfooding)

To change codexclaw while running it inside Codex, install your working checkout as a **real
plugin copy** from a local marketplace rooted at the repo:

```bash
scripts/dev-install.sh
```

That is the whole setup. The script points the `codexclaw` marketplace at your checkout itself,
including when a published git marketplace already holds that name — adding it by hand would fail
with `marketplace 'codexclaw' is already added from a different source`.

A git-source marketplace pins a commit, so a checkout under active development has to use the
local source — otherwise Codex keeps loading the pinned snapshot no matter what you edit.

### Why not symlinks

An earlier `scripts/dev-symlink.sh` replaced each child of the plugin cache version directory with a
symlink into the repo, so edits were live with no reinstall. Codex does not resolve those
symlinked entries reliably and the plugin can silently fail to load, so that track is retired.
When `dev-install.sh` finds any symlink left in the plugin cache it clears the whole cache
directory and reinstalls from scratch.

### What the install actually does

`codex plugin add codexclaw@codexclaw` copies the payload into
`~/.codex/plugins/cache/codexclaw/codexclaw/<version>/` and **prunes files that no longer exist in
the source**. A same-version reinstall is therefore a true resync rather than a no-op, which is why
re-running the script is the whole update loop and the manifest version never needs bumping.

| Command | Effect |
|---|---|
| `scripts/dev-install.sh` | build components, repoint the marketplace if it drifted, clear stale symlinks, reinstall, prune old version dirs, run doctor |
| `scripts/dev-install.sh --no-build` | the same without `npm run build`, for skill, hook or docs-only edits |
| `scripts/dev-install.sh --status` | report source, manifest version, marketplace root, cache roots and symlink count; change nothing |

### The update loop

Edit -> `scripts/dev-install.sh` -> **open a new Codex thread**. Skills, hooks and MCP tools are read
when a session starts, so the thread you are in does not pick up the change.

Hook trust is hashed over the hook **declaration** — the event, matcher, command, timeout, async
flag and status message — not over the files a hook runs. Editing a matcher or command in
`hooks/*.json` breaks trust and Codex marks that hook **Modified** until you re-approve it, while
rebuilding the component `dist/` a hook invokes changes many bytes and keeps its trust.
`cxc doctor`'s `hook-trust` line tells you which case you are in. codexclaw never writes trust
state itself.

### Verifying the install

```bash
VER=$(python3 -c "import json;print(json.load(open('plugins/codexclaw/.codex-plugin/plugin.json'))['version'])")
CACHE=~/.codex/plugins/cache/codexclaw/codexclaw

diff -rq plugins/codexclaw "$CACHE/$VER"   # installed payload matches the checkout
find "$CACHE" -type l | wc -l              # expect 0 — no symlinks survived
node "$CACHE/$VER/bin/cxc.mjs" doctor       # expect: overall: PASS
                                            # FAIL on hook-trust alone = hooks await re-approval
```

To go back to the published track, remove the local marketplace and re-add the git URL:

```bash
codex plugin remove codexclaw@codexclaw
codex plugin marketplace remove codexclaw
codex plugin marketplace add https://github.com/lidge-jun/codexclaw
```

## Architecture

```
plugins/codexclaw/
│
├── bin/cxc.mjs                  payload CLI dispatcher (ships with every install)
│
├── skills/                      28 skills
│   ├── dev/                     canonical parent — work classifier, routing, verification gate
│   ├── dev-*/                   12 surface routers (architecture → uiux-design)
│   ├── pabcd/                   PABCD workflow phases + attestation
│   ├── loop/                    durable goalplan + Stop-continuation contract
│   ├── interview/               IPABCD requirements discovery
│   ├── search/                  web search + evidence routing ladder
│   ├── recall/                  past-session + memory store search
│   └── repo-map/                tree-sitter + PageRank structure map
│
├── hooks/                       24 active hooks across the session lifecycle
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

_The PATH-level `cxc` entry (`bin/codexclaw.mjs` + `cli/` workspace) lives at the repository root; the payload's `bin/cxc.mjs` dispatcher covers the same verbs (minus `map`/`gui`) on marketplace installs._

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
| Diagrams, visual documents, HTML/SVG reports and PDF composition | `dev-visualizer` | Available document-format owner for export |

Each router carries its own modular references (loaded on demand, never preloaded) and inherits the parent's verification gate, rule classes, and safety rules.

## CLI

```bash
cxc orchestrate P|A|B|C|D|status|reset   # PABCD phase control
cxc loop init|show|validate               # durable goalplan management
cxc scan record --session <id>            # record an interview contradiction-scan round
cxc map <dir>                             # tree-sitter structure map (repo checkout only)
cxc skill search <query>                  # remote skill discovery
cxc skill show <id>                       # load a discovered skill
cxc help                                  # command reference
```

On marketplace installs without a PATH-level `cxc`, the same verbs run as `node "<plugin-root>/bin/cxc.mjs" <verb>` — the session-start banner prints the exact path.

## Ecosystem

codexclaw is the reference implementation. The methodology and skills are ported (agent-neutral, no plugin dependency) to:

| Repo | Role |
|------|------|
| [pabcd_initiative](https://github.com/lidge-jun/pabcd_initiative) | Methodology spec + docs-site + agent-neutral skill set |
| [cli-jaw](https://github.com/lidge-jun/cli-jaw) | Boss/employee agent harness with skills_ref submodule |
| [ima2-gen](https://github.com/lidge-jun/ima2-gen) | Image generation tool with ima2-front/ima2-uiux skills |

## Documentation

Plugin documentation: **[lidge-jun.github.io/codexclaw](https://lidge-jun.github.io/codexclaw/)**

Development install and the dogfood loop: **[Dogfood & Dev Install](https://lidge-jun.github.io/codexclaw/development/dogfood-dev-install/)**

Runtime trust boundaries and resource limits: **[docs/security-hardening.md](docs/security-hardening.md)**

Methodology and research provenance: **[lidge-jun.github.io/pabcd_initiative](https://lidge-jun.github.io/pabcd_initiative/)** — skill architecture, delegation economy, loop contracts, devlog records, and the arXiv-backed claim ledger.

## Contributing

Pull requests target the `dev` integration branch; `main` moves by maintainer promotion and carries releases.

## License

[MIT](LICENSE). Copyright, upstream provenance and third-party scope: [NOTICE.md](NOTICE.md).

Third-party: RepoMapper (MIT, Pete Davis) and Aider tree-sitter queries (Apache-2.0). See [`NOTICE.md`](plugins/codexclaw/skills/repo-map/scripts/NOTICE.md).
