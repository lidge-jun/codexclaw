# Skill Catalog

Central registry of codexclaw skills. `implicit` is the
`allow_implicit_invocation` flag in each skill's `agents/openai.yaml`. The
implicit set is {dev, search, interview, pabcd, recall, skill-hub, loop}; every
other skill is on-demand (implicit-off, grep-discoverable, never disabled).
Load an on-demand skill explicitly by `$name` or SKILL.md path.

| Skill | Path | Category | load_when | implicit | codex-native gap |
|-------|------|----------|-----------|----------|------------------|
| dev | `skills/dev/SKILL.md` | discipline | every coding task (always on) | true | none |
| pabcd | `skills/pabcd/SKILL.md` | workflow | non-trivial multi-step build needing plan/audit/verify | true | none |
| interview | `skills/interview/SKILL.md` | workflow | persistent I-phase clarification, contradiction scan, Q/A evidence | true | runtime ledger + PostToolUse capture planned |
| orchestrate | `skills/orchestrate/SKILL.md` | workflow | explicit IPABCD phase control, status, reset, D close semantics | false | none (chat free-pass + `cxc orchestrate` CLI live, L3/L4) |
| loop | `skills/loop/SKILL.md` | workflow | HOTL repeated work-phase continuation and Stop guard policy | true | none (Stop-continuation loop + stagnation guard live, L6) |
| goalplan | `skills/goalplan/SKILL.md` | workflow | durable goals, criteria, checkpoints, steering, quality gates | false | reuses host `goals_1.sqlite` (read-only) to arm the loop; no codexclaw-owned goal store |
| dev-architecture | `skills/dev-architecture/SKILL.md` | surface | module boundaries, circular deps, coupling, barrels | false | none |
| dev-debugging | `skills/dev-debugging/SKILL.md` | surface | runtime bugs, crashes, flaky tests, root-cause analysis | false | none |
| dev-backend | `skills/dev-backend/SKILL.md` | surface | API/server/database/queue/observability work | false | none |
| dev-data | `skills/dev-data/SKILL.md` | surface | data pipelines, ETL, migrations, query/analysis | false | none |
| dev-frontend | `skills/dev-frontend/SKILL.md` | surface | UI components, CSS, client frameworks, viewport/a11y | false | none |
| dev-uiux-design | `skills/dev-uiux-design/SKILL.md` | surface | design judgment, UX states, layout/typography/logos | false | none |
| dev-testing | `skills/dev-testing/SKILL.md` | surface | test strategy, coverage, E2E, CI, TDD | false | none |
| qa | `skills/qa/SKILL.md` | capability | manual surface-driving QA after building/changing a user-facing surface (web/TUI/CLI/API): evidence matrix, adversarial classes, teardown receipts | false | none (rides native browser/CU tools + `.codexclaw/evidence/`) |
| dev-code-reviewer | `skills/dev-code-reviewer/SKILL.md` | surface | code review, antipatterns, pre-merge verdicts | false | none |
| dev-security | `skills/dev-security/SKILL.md` | surface | auth, secrets, validation, OWASP, supply chain | false | none |
| dev-devops | `skills/dev-devops/SKILL.md` | surface | containers, deploy pipelines, k8s, IaC, SRE | false | none |
| dev-scaffolding | `skills/dev-scaffolding/SKILL.md` | surface | new project/module scaffold, structure audits | false | none |
| search | `skills/search/SKILL.md` | capability | external/current/web lookups, deep research | true | none |
| ultraresearch | `skills/ultraresearch/SKILL.md` | capability | deep multi-source research (EXPAND/wave/journal/claim-ledger), Tier-3 explorer swarm | false | none (protocol rides base explorer; agbrowse HTTP proof is opt-in) |
| lunasearch | `skills/lunasearch/SKILL.md` | capability | cheap parallel public-web discovery via Luna explorer subagents; depends on cxc-search for proof | false | none |
| recall | `skills/recall/SKILL.md` | capability | past-session recall: search prior Codex chats (`cxc chat search`) + memory store (`cxc memory search`) before asking the user | true | none (reads Codex-native `~/.codex` artifacts read-only) |
| ast-grep | `skills/ast-grep/SKILL.md` | capability | AST-shape search / deterministic codemods (rg-first for byte search) | false | needs `sg` binary (lazy-provisioned) |
| repo-map | `skills/repo-map/SKILL.md` | capability | ranked whole-repo structure map (tree-sitter tags + PageRank) for C2+ exploration bootstrap | false | needs Python deps (one-time pip install; degrades to install hint) |
| skill-hub | `skills/skill-hub/SKILL.md` | router | "which skill?", capability beyond dev | true | none |

## Loading rule

On-demand skills do not appear in the auto-rendered `<skills_instructions>`
list. To use one, mention it explicitly (`$cxc-dev-testing`) or open its SKILL.md
path. The `dev` hub also routes to the right surface skill by change-surface.

## Host-provided (not codexclaw skills)

- `pdf` — provided by Codex itself; not part of the codexclaw implicit set and
  not catalogued as a codexclaw skill.
