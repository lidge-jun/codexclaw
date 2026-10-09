## 1. Structural Standard

Apply this pattern for new projects or when a repo has no clear structural convention of its own;
defer to an existing mature convention when one is present (§2). Three pillars:

1. **Screaming Architecture** — folder names reveal what the app does (`stock-price/`, `auth/`, `report/`)
2. **Colocation** — related files live together (logic + test + schema in the same folder)
3. **Public Boundary Export** — each feature/package exposes a single public entry point (`index.ts`, `index.js`, `__init__.py`, or Go package) at its boundary; internal convenience barrels are banned (owned by `dev-architecture` §5)

## 2.2 Project Skeleton

For a new project, propose the source-of-truth structure in the plan.
If the user explicitly asks for a full standard layout, create it.
Otherwise ask once before adding new project-level docs or plan folders.

When creating an approved new project skeleton, include the source-of-truth and feature-based essentials:
`AGENTS.md` + `README.md` (context/overview when requested or already used by the repo),
`.env.example` + `.gitignore`, `src/` with a `shared/` for truly shared code,
`config/`, `docs/`, and `tests/e2e/` when they fit the stack. Then add the
language-appropriate package manifest, entry point, language config, and per-feature
public boundary exports (per `dev-architecture` §5; file names from language detection, §3).
Defer exact layout to the framework's own generator when one exists.

## 3. Language Detection

Detect project type from existing files. Priority order:

| File Found                             | Project Type                  |
| -------------------------------------- | ----------------------------- |
| `tsconfig.json`                        | TypeScript (Node)             |
| `package.json` (no tsconfig)           | JavaScript (Node)             |
| `pyproject.toml` or `requirements.txt` | Python                        |
| `go.mod`                               | Go                            |
| `Cargo.toml`                           | Rust                          |
| None of the above                      | → Tech Stack Decision (below) |

For greenfield projects, use the Tech Stack Decision process (§3.1) instead of asking “What language?”

## 3.1 Tech Stack Decision (New Projects)

When creating a new project with no existing framework, guide the user through plain-language choices:

1. **Type**: What are they building? (static site, interactive app, full-stack service, CLI tool, data pipeline)
2. **Scale**: How big? (1-3 pages, multi-page, ongoing content, large app)
3. **Features**: Login needed? Data storage? Real-time?

Present options as `<Framework> — <what it gives you>`, recommend one with reasoning, let the user pick.

Match tool complexity to task complexity. Escalate tooling only when justified by user requirements (SEO, CMS, scaling).
If the task is ambiguous or cross-cutting, route through the `pabcd` skill flow before scaffolding.

## 4. Fullstack Split Rule

Decide project layout based on runtime:

| Scenario           | Layout                   | Example                                  |
| ------------------ | ------------------------ | ---------------------------------------- |
| Single runtime     | `src/` modular           | Next.js, Node CLI + API, Python monolith |
| Multiple runtimes  | `frontend/` + `backend/` | React + FastAPI, Vue + Go API            |
| Monorepo (3+ apps) | `packages/` or `apps/`   | Turborepo, Nx                            |

Each side gets its own package manifest and entry point. Shared types go in root `shared/` or `packages/shared/`.

## 5. Feature Module Rules

When adding a new feature, create a folder under `src/` with these files:

| Language   | Folder        | Main File      | Test File      | Public boundary export |
| ---------- | ------------- | -------------- | -------------- | ---------------------- |
| JavaScript | `kebab-case/` | `name.tool.js` | `name.test.js` | `index.js`             |
| TypeScript | `kebab-case/` | `name.tool.ts` | `name.test.ts` | `index.ts`             |
| Python     | `package_name/` | `name_tool.py` | `test_name.py` | `__init__.py`          |
| Go         | `kebab-case/` | `name.go`      | `name_test.go` | *(package = boundary)* |
| Rust       | `kebab-case/` | `name.rs`      | inline `#[cfg(test)]` or `tests/` | `lib.rs`/parent `mod name;` |

The `index.*` file is the feature's **public boundary export**. Barrel discipline is owned
by `dev-architecture` §5: external consumers import this boundary, internal code imports
sources directly, and convenience-only internal barrels are banned.

Principle: “flat until you can't” — start flat, add a sub-folder only when a folder becomes hard to scan.

## 6. Naming Conventions

| Item                | Rule                  | Example                      |
| ------------------- | --------------------- | ---------------------------- |
| Repository folders | Follow existing convention; kebab-case is a JS/TS sample | `stock-price/` |
| Importable packages | Follow language identifiers; no hyphens in normal Python imports | `stockprice/`, `stock_price/` |
| JS/TS files         | kebab-case + suffix   | `stock-price.tool.ts`        |
| Python files        | snake_case + suffix   | `stock_price_tool.py`        |
| Go files            | snake_case            | `stock_price.go`             |
| Rust files          | snake_case            | `stock_price.rs`             |
| Plan folders        | `YYMMDD_slug/`        | `260510_feature_bootstrap/`  |
| Phase docs          | decade-prefixed `NNN_slug.md`, `000_*` is the index (LEXICO-SPLIT-01) | `000_plan.md`, `010_phase1_build.md` |
| Functions (JS/TS)   | camelCase             | `getStockPrice()`            |
| Functions (Python)  | snake_case            | `get_stock_price()`          |
| Functions (Go)      | PascalCase (exported) | `GetStockPrice()`            |
| Functions (Rust)    | snake_case            | `get_stock_price()`          |

## 7. File Suffixes

| Suffix                                             | Role                    | Languages    |
| -------------------------------------------------- | ----------------------- | ------------ |
| `.tool.ts` / `.tool.js` / `_tool.py`               | Core business logic     | JS/TS/Python |
| `.test.ts` / `.test.js` / `test_*.py` / `_test.go` | Tests                   | All          |
| `.schema.ts` / `.schema.js`                        | Type/schema definitions | JS/TS        |
| `.route.ts` / `.route.js`                          | API routes              | JS/TS        |
| `.template.md`                                     | Templates               | All          |

## 9. Split Rules

Split smells (heuristics, not hard gates):

| Condition                       | Action                                        |
| ------------------------------- | --------------------------------------------- |
| File grows past >400 lines      | Split into focused modules within same folder |
| Folder becomes hard to scan     | Create sub-folders by responsibility          |
| Different runtime needed        | Split into `frontend/` + `backend/`           |
| 3+ apps share code              | Extract to `shared/` or monorepo `packages/`  |

## 10. Cross-Cutting Scaffolding

This section owns scaffold file placement only. Behavior, policy, and verification come from the owning surface skill (`dev-backend`, `dev-frontend`, `dev-devops`, `dev-security`).

### Health Endpoints
Backend scaffolds should propose health routes (skip if the mature repo already handles health checks per §2):
- `src/routes/health.ts` (or equivalent) — `/health` (liveness) and `/ready` (readiness)
- See `../../dev-backend/references/core/health-checks.md` for response format

### SEO Boilerplate (Web Projects)
Web project templates should include:
- `public/robots.txt` with AI crawler allowlist
- Meta tag component with OG defaults
- JSON-LD helper utility
- Sitemap generation (static or dynamic)

### CI Template
Generate CI config scaffold:
```
lint → typecheck → test (unit) → test (integration) → build → deploy (staging)
```

### Security Boilerplate
Generate security scaffolding: CSP headers, CORS config, rate limiting middleware, `.env.example` with placeholder secrets. See `../../dev-security/SKILL.md` for full patterns.
