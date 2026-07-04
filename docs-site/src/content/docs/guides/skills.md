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

## Subagent attachment ($cxc mentions in the spawn message)

Skills attach to subagents through the spawn **message**: a plain `$cxc-<skill>` or
link-form `[$cxc-<skill>](skill://<abs SKILL.md path>)` mention in the message is parsed
by the child's first turn and injected as the full SKILL.md body. This works on both
spawn surfaces — `message` is a shared field, unlike the v1-only `items` channel.

Two layers keep this deterministic:

- **Name skills explicitly** when dispatching: put the matching `$cxc-dev-*` (and
  `$cxc-search` for research lanes) mentions in the spawn message yourself.
- **The spawn-attach hook backstops you.** An always-on `^spawn_agent$` PreToolUse hook
  prepends link-form mentions for the role baseline (`cxc-dev`, plus `cxc-dev-code-reviewer`
  for reviewers) and any surfaces it can infer from the message. It never double-attaches:
  it no-ops when structured `items` are present or the skills are already mentioned.

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
- **`cxc-recall`** is for past-session context. Use it before asking the user to repeat earlier
  work.
- **`cxc-sparksearch`** is a cheap parallel discovery lane that hands candidates back to
  `cxc-search` for proof.
- **`cxc-ultraresearch`** is the deeper multi-wave research protocol for broad investigations.
- **`cxc-ast-grep`** is a structural code-search helper. Reach for plain `rg` first for ordinary
  text search, and `ast-grep` when you need syntax-aware matching or rewrites.

## Shipped skill inventory

codexclaw currently ships 23 skill directories:

| Skill | Folder | Role |
|---|---|---|
| `cxc-dev` | `dev` | Always-on development classifier, modularity, verification, and safety. |
| `cxc-pabcd` | `pabcd` | IPABCD / PABCD workflow discipline. |
| `cxc-interview` | `interview` | Persistent I-phase requirements discovery and contradiction tracking. |
| `cxc-orchestrate` | `orchestrate` | Explicit phase-control surface for chat and CLI. |
| `cxc-loop` | `loop` | Repeated PABCD work-phase continuation policy. |
| `cxc-goalplan` | `goalplan` | Durable goalplan, checkpoints, and quality gates. |
| `cxc-dev-architecture` | `dev-architecture` | Module boundaries, circular deps, coupling, validation placement. |
| `cxc-dev-backend` | `dev-backend` | API, server, database, queues, and backend operations. |
| `cxc-dev-data` | `dev-data` | Pipelines, ETL/ELT, SQL, schema, backfills, and reports. |
| `cxc-dev-debugging` | `dev-debugging` | Runtime root-cause debugging method. |
| `cxc-dev-frontend` | `dev-frontend` | Frontend/UI implementation and responsive layout. |
| `cxc-dev-uiux-design` | `dev-uiux-design` | UX direction, states, visual judgment, logos, and typography. |
| `cxc-dev-testing` | `dev-testing` | Test strategy, QA, Playwright, contracts, CI, and coverage. |
| `cxc-dev-code-reviewer` | `dev-code-reviewer` | Review verdicts, findings, and risk assessment. |
| `cxc-dev-security` | `dev-security` | Auth, secrets, validation, supply chain, and threat-model work. |
| `cxc-dev-devops` | `dev-devops` | Containers, deploy pipelines, IaC, SRE, and release surfaces. |
| `cxc-dev-scaffolding` | `dev-scaffolding` | Project/module scaffolding and source-of-truth docs. |
| `cxc-search` | `search` | Current/public lookup ladder and source-proof discipline. |
| `cxc-recall` | `recall` | Read-only past chat and memory recall before asking the user. |
| `cxc-skill-hub` | `skill-hub` | On-demand catalog router for non-implicit capabilities. |
| `cxc-ast-grep` | `ast-grep` | AST-aware structural search and deterministic codemods. |
| `cxc-sparksearch` | `sparksearch` | Parallel public-web discovery lane that depends on `cxc-search`. |
| `cxc-ultraresearch` | `ultraresearch` | Deep multi-source research protocol with journal and claim ledger. |

:::note[chat-search retired]
An earlier `chat-search` CLI wrapper was retired (L13). Codex thread search is a native runtime
concern; codexclaw does not reimplement it or grep the filesystem to fake it.
:::
