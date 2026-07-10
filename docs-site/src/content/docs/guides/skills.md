---
title: Skills
description: How codexclaw skills load — the implicit set, on-demand skills, the four naming forms, and the dev-* routing table.
---

codexclaw ships its discipline as skills. Eight are implicit-visible; the rest load on demand.

## Implicit vs on-demand

- **Eight skills are implicit.** The shipped implicit set is `dev`, `search`, `interview`,
  `pabcd`, `recall`, `loop`, `dev-frontend`, and `dev-uiux-design`. `cxc-dev` remains the coding work classifier
  ([C0-C5](/codexclaw/concepts/work-classes/)); the others expose current lookup,
  interview, workflow, recall, work-loop, and design/anti-slop affordances when their triggers match.
- **Everything else is on-demand.** `dev-backend`, `dev-testing`, `qa`,
  `repo-map`, `ast-grep`, and the rest load when the task or you call them.

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

## Subagent attachment (resolvable mentions in the spawn message)

Skill attachment intent travels through the spawn **message**. Prefer link-form
`[$cxc-<skill>](skill://<abs SKILL.md path>)`; when the path is not link-safe, use the
plugin-native `$codexclaw:cxc-<skill>` fallback. V1 parses either form on the child's
first turn and injects the full SKILL.md body. On plaintext V2 provider/proxy paths, the
codexclaw spawn hook normalizes mentions and inlines recognized skill bodies. Native
ChatGPT-backend V2 gives the hook ciphertext, so both operations are no-ops there; skill
delivery relies on fork inheritance. Child sessions are proven to fire SessionStart
hooks, but using them for delivery is future work.
Manual V1 callers may use the stronger structured `items` channel.

Two layers keep this deterministic:

- **Name skills explicitly** when dispatching: put the matching
  `$codexclaw:cxc-dev-*` (and `$codexclaw:cxc-search` for research lanes) in the spawn
  message yourself, or use their preferred link forms.
- **The spawn-attach hook repairs plaintext mentions.** The always-on spawn PreToolUse
  hook normalizes known broken/bare cxc mentions and performs V2 body inlining only when
  the message reaches it as plaintext. It does not add role baselines or infer missing
  surface skills; the dispatcher still names those.

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

codexclaw currently ships 25 skill directories:

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
| `cxc-qa` | `qa` | Manual surface-driving QA evidence for web, TUI, CLI, and API surfaces. |
| `cxc-dev-code-reviewer` | `dev-code-reviewer` | Review verdicts, findings, and risk assessment. |
| `cxc-dev-security` | `dev-security` | Auth, secrets, validation, supply chain, and threat-model work. |
| `cxc-dev-devops` | `dev-devops` | Containers, deploy pipelines, IaC, SRE, and release surfaces. |
| `cxc-dev-scaffolding` | `dev-scaffolding` | Project/module scaffolding and source-of-truth docs. |
| `cxc-search` | `search` | Current/public lookup ladder and source-proof discipline. |
| `cxc-recall` | `recall` | Read-only past chat and memory recall before asking the user. |
| `cxc-skill-hub` | `skill-hub` | On-demand catalog router for non-implicit capabilities. |
| `cxc-repo-map` | `repo-map` | Tree-sitter/PageRank repository overview for unfamiliar codebase exploration. |
| `cxc-ast-grep` | `ast-grep` | AST-aware structural search and deterministic codemods. |
| `cxc-sparksearch` | `sparksearch` | Parallel public-web discovery lane that depends on `cxc-search`. |
| `cxc-ultraresearch` | `ultraresearch` | Deep multi-source research protocol with journal and claim ledger. |

:::note[chat-search retired]
An earlier `chat-search` CLI wrapper was retired (L13). Codex thread search is a native runtime
concern; codexclaw does not reimplement it or grep the filesystem to fake it.
:::
