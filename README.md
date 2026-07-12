# codexclaw

<p align="center">
  <img src="docs-site/public/logo.png" alt="codexclaw" width="160" />
</p>

<p align="center">
  <a href="https://github.com/lidge-jun/codexclaw/actions/workflows/ci.yml"><img src="https://github.com/lidge-jun/codexclaw/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://lidge-jun.github.io/pabcd_initiative/"><img src="https://img.shields.io/badge/docs-pabcd.io-blue" alt="Docs" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
</p>

Development discipline and multi-model subagents for the **OpenAI Codex** runtime, packaged as a single Codex plugin. No external harness — codexclaw layers directly on the `codex` runtime.

## What it does

- **13 dev skills** — project-agnostic coding discipline covering architecture, backend, frontend, testing, security, debugging, data, DevOps, code review, scaffolding, diagrams, and UI/UX design. Every skill inherits from a canonical `dev` parent and carries bidirectional cross-references to its siblings.
- **PABCD workflow** — Plan / Audit / Build / Check / Done, implemented as Codex-native skills + hooks + file state. The FSM runs in `.codexclaw/sessions/`, with attestation-gated phase transitions and a durable goalplan ledger.
- **Multi-model subagents** — role-based dispatch (explorer / reviewer / executor) with per-role model and prompt configuration, persisted and applied through the spawn-wrapper hook.
- **Recall** — disk-artifact search across past Codex sessions and the memory store.
- **Repo map** — tree-sitter + PageRank structure map (`cxc map`) for codebase orientation before deep dives.
- **Skill search** — remote dormant-skill discovery over cli-jaw-skills, ClawHub, and Hermes catalogs.
- **Optional ocx bridge** — read-only detection of opencodex for catalog and link-bar context; never mutates provider config.

## Install

```bash
codex plugin marketplace add https://github.com/lidge-jun/codexclaw
codex plugin add codexclaw@codexclaw
```

## Layout

```
plugins/codexclaw/
├── skills/          13 dev-* skills + pabcd + search + interview + recall + loop
├── hooks/           12 hooks: session, prompt, stop, pre/post-tool, evidence, compaction
├── components/      pabcd-state, recall, subagent-config, provider-bridge, messenger-bridge, ...
├── gui/             local dashboard (Vite + React) for subagent config + ocx link bar
└── cli/             cxc orchestrate, cxc map, cxc loop, cxc skill search/show
```

## Status

Production-ready. 1,110 tests, CI green across codexclaw and three downstream repos ([pabcd_initiative](https://github.com/lidge-jun/pabcd_initiative), [cli-jaw](https://github.com/lidge-jun/cli-jaw), [ima2-gen](https://github.com/lidge-jun/ima2-gen)). The dev skill family carries 146 unique rule IDs across 13 routers with zero contradictions, zero asymmetric cross-references, and full canonical inheritance from the parent `dev` skill.

Documentation: **[pabcd_initiative docs-site](https://lidge-jun.github.io/pabcd_initiative/)**

## License

MIT — see [LICENSE](LICENSE). Third-party notices: [`plugins/codexclaw/skills/repo-map/scripts/NOTICE.md`](plugins/codexclaw/skills/repo-map/scripts/NOTICE.md).
