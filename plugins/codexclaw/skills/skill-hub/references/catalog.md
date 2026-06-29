# Skill Catalog

Central registry of codexclaw skills. `implicit` is the
`allow_implicit_invocation` flag in each skill's `agents/openai.yaml`. Only `dev`
is implicit; every other skill is on-demand (implicit-off, grep-discoverable,
never disabled). Load an on-demand skill explicitly by `$name` or SKILL.md path.

| Skill | Path | Category | load_when | implicit | codex-native gap |
|-------|------|----------|-----------|----------|------------------|
| dev | `skills/dev/SKILL.md` | discipline | every coding task (always on) | true | none |
| pabcd | `skills/pabcd/SKILL.md` | workflow | non-trivial multi-step build needing plan/audit/verify | false | none |
| dev-architecture | `skills/dev-architecture/SKILL.md` | surface | module boundaries, circular deps, coupling, barrels | false | none |
| dev-debugging | `skills/dev-debugging/SKILL.md` | surface | runtime bugs, crashes, flaky tests, root-cause analysis | false | none |
| dev-backend | `skills/dev-backend/SKILL.md` | surface | API/server/database/queue/observability work | false | none |
| dev-data | `skills/dev-data/SKILL.md` | surface | data pipelines, ETL, migrations, query/analysis | false | none |
| dev-frontend | `skills/dev-frontend/SKILL.md` | surface | UI components, CSS, client frameworks, viewport/a11y | false | none |
| dev-uiux-design | `skills/dev-uiux-design/SKILL.md` | surface | design judgment, UX states, layout/typography/logos | false | none |
| dev-testing | `skills/dev-testing/SKILL.md` | surface | test strategy, coverage, E2E, CI, TDD | false | none |
| dev-code-reviewer | `skills/dev-code-reviewer/SKILL.md` | surface | code review, antipatterns, pre-merge verdicts | false | none |
| dev-security | `skills/dev-security/SKILL.md` | surface | auth, secrets, validation, OWASP, supply chain | false | none |
| dev-devops | `skills/dev-devops/SKILL.md` | surface | containers, deploy pipelines, k8s, IaC, SRE | false | none |
| dev-scaffolding | `skills/dev-scaffolding/SKILL.md` | surface | new project/module scaffold, structure audits | false | none |
| search | `skills/search/SKILL.md` | capability | external/current/web lookups, deep research | false | none |
| skill-hub | `skills/skill-hub/SKILL.md` | router | "which skill?", capability beyond dev | false | none |

## Loading rule

On-demand skills do not appear in the auto-rendered `<skills_instructions>`
list. To use one, mention it explicitly (`$dev-testing`) or open its SKILL.md
path. The `dev` hub also routes to the right surface skill by change-surface.

## Host-provided (not codexclaw skills)

- `pdf` — provided by Codex itself; not part of the codexclaw implicit set and
  not catalogued as a codexclaw skill.
