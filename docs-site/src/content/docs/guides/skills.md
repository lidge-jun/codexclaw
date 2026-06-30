---
title: Skills
description: How codexclaw skills load — implicit vs on-demand, the four naming forms, and the dev-* routing table.
---

codexclaw ships its discipline as skills. One is always on; the rest load on demand.

## Implicit vs on-demand

- **`cxc-dev` is implicit.** It engages on every coding task and classifies the work
  ([C0-C5](/codexclaw/concepts/work-classes/)).
- **Everything else is on-demand.** `dev-frontend`, `dev-backend`, `dev-testing`, `pabcd`,
  `loop`, `interview`, `search`, `ast-grep`, and the rest load when the task or you call them.

The skill hub is a **catalog**, not a runtime loader. It lists what exists; it does not
auto-load skills behind your back.

## Four names for one skill

Codex exposes the same skill under several forms. Docs and prompts may use any of them:

| Form | Example |
|---|---|
| Directory shorthand | `dev-testing`, `search`, `ast-grep` |
| Skill name | `$cxc-dev-testing`, `$cxc-search`, `$cxc-ast-grep` |
| Plugin-native mention | `$codexclaw:cxc-dev-testing` |
| Source-path fallback | `plugins/codexclaw/skills/dev-testing/SKILL.md` |

## dev-* routing

After classifying a task, `cxc-dev` routes to surface-specific skills. A sample of the routing
overlays:

| Trigger | Loads | When |
|---|---|---|
| `tdd` / `testing` | `dev-testing` | TDD enforced or regression risk |
| `ddd` / `clean_arch` / `architecture` | `dev-architecture`, `dev-backend` | Boundary pressure at C3/C4 |
| `review` / `code_review` | `dev-code-reviewer` | Review requested or C3/C4 |
| `threat_model` / `security` | `dev-security` | C4 security/data/tooling risk |
| `debugging` / `debugging_rca` | `dev-debugging` | Repeated failure needs root cause |
| `devops` / `infra` / `deploy` | `dev-devops` | Container/K8s/IaC/deploy/SRE |
| `frontend_ui` | `dev-frontend`, `dev-uiux-design` | UI/design intent or prototype work |
| `crud_fullstack` | `dev-backend`, `dev-frontend`, `dev-testing` | Full-stack slice with coupled UI + API |

## Search skills

- **`cxc-search`** is for external / current / public web information. Use it when the answer
  would change with recent events, versions, or prices.
- **`cxc-ast-grep`** is a structural code-search helper. Reach for plain `rg` first for ordinary
  text search, and `ast-grep` when you need syntax-aware matching or rewrites.

:::note[chat-search retired]
An earlier `chat-search` CLI wrapper was retired (L13). Codex thread search is a native runtime
concern; codexclaw does not reimplement it or grep the filesystem to fake it.
:::
