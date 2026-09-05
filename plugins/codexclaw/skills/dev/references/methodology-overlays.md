## §0.3 Methodology Overlays

Methodologies are **conditional overlays, never universal**. They activate when the routing
skill's description matches the work surface, when the user explicitly asks for the method,
when repo convention requires it, or when a strict trigger applies — required evidence
applies only when the strict trigger applies (low-risk/local work uses the smallest
proof that validates the claim, with the reduced scope stated).

| Overlay | Loads | Strict trigger |
|---------|-------|----------------|
| `tdd` / `testing` | `dev-testing` | User/repo enforces TDD, or regression risk |
| `bdd_acceptance` | `dev-testing`, `dev` | Ambiguous acceptance behavior |
| `ddd` / `clean_arch` / `hexagonal` / `architecture` | `dev-architecture`, `dev-backend` | Real boundary pressure at C3/C4 |
| `vertical_slice` | `dev-architecture`, `dev-backend`, `dev-frontend`, `dev-testing` | Thin end-to-end slice (C2) |
| `adr_rfc` | `dev-architecture`, `dev-scaffolding` | Significant decision, domain vocabulary, or ADR source-of-truth work |
| `review` / `code_review` | `dev-code-reviewer` | Review requested or C3/C4 |
| `threat_model` / `security` | `dev-security` | C4 security/data/tooling risk |
| `observability` / `observability_pipeline` | `dev-backend` (+`dev-data`, `dev-devops` for operational gates) | App instrumentation, production/runtime hooks, incident/release gates |
| `logging` (CLI / scripts / libraries) | `dev` `logging.md` | What to emit and where; service instrumentation stays with `dev-backend` |
| stacked pull requests (`DEV-STACK-*`) | `dev` `stacked-prs.md` | Global PR/dependency preflight, native membership, CI diagnosis, cascading, layer review and merge safety |
| `debugging` / `debugging_rca` | `dev-debugging` | Repeated failure needs root cause |
| `migration_backfill` | `dev-data`, `dev-backend`, `dev-testing` | Production or non-trivial data |
| `product_discovery` (+`_ui`) | `dev` (+`dev-uiux-design`) | Ambiguous behavior/user value/metric/prototype intent |
| `release_cd` | `dev-testing`, `dev-scaffolding`, `dev-devops` (+`dev-backend` for app hooks) | Release/CI/CD surface, rollback/smoke gates, app readiness hooks |
| `devops` / `infra` / `deploy` | `dev-devops` | Container/K8s/IaC/deploy pipeline/SRE |
| `mobile_native` | `dev-frontend` + `dev-uiux-design` + `dev-backend` (refs) | RN/Flutter/Swift/Kotlin native app |
| `ml` / `ai` / `llm` / `rag` | `dev-backend` + `dev-data` + `dev-testing` (+`dev-devops`) | ML serving, RAG, pipeline, evaluation |
| `frontend_ui` | `dev-frontend` + `dev-uiux-design` | UI/design intent or runnable prototype variant work |
| `crud_fullstack` | `dev-backend`, `dev-frontend`, `dev-testing` | Full-stack slice with coupled UI + API verification |

For C2 ordinary product slices, read `product/crud-product-development.md`
only when building a conventional feature slice.
