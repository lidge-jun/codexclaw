# Skill Ownership Map

Each rule area has exactly one canonical owner. Other skills may contain stubs but MUST NOT duplicate canonical content.

| Rule Area | Canonical Owner | Stub Locations |
|-----------|----------------|----------------|
| Circular dependencies | `dev-architecture` | `dev`, `dev-code-reviewer` |
| Module boundaries / layers | `dev-architecture` | `dev-backend`, `dev-frontend` |
| Coupling taxonomy | `dev-architecture` | `dev-code-reviewer` |
| Barrel / re-export | `dev-architecture` | `dev-scaffolding` |
| Pre-write search | dev references/development-practice.md (§1.5) | `dev-code-reviewer` |
| Stacked pull requests (`DEV-STACK-*`) | `dev` `references/stacked-prs.md` | `pabcd`, `loop`, `dev-code-reviewer`, `dev-devops` |
| Edge-first testing | `dev-testing` §6 | — |
| Flaky tests / CI re-run (`TEST-FLAKE-*`) | `dev-testing` `references/ci-pipeline.md` §5 | `dev-testing` §5.4, `dev-debugging` Scenario D, `dev-devops` `references/ci-cd-deploy.md` §6.2/§6.5 |
| Manual surface QA / evidence matrix | `cxc-qa` | `dev-testing` §4.6 (tool routing stays there) |
| Test-induced defense | `dev-testing` §6.7 | `dev-code-reviewer` |
| Boundary-only defense | `dev-architecture` §4 | `dev-backend`, `dev-security` |
| Process isolation | `dev-backend` references/ | `dev-code-reviewer`, `dev-devops` |
| Long-lived connections | `dev-backend` §1 app hooks | `dev-frontend`, `dev-devops` operational gates |
| Async task queue | `dev-backend` §2 app hooks | `dev-devops` operational gates |
| Debugging methodology | `dev-debugging` | `dev-code-reviewer` |
| Browse / QA tool routing | `dev-testing` §4.6 (QA ladder), `cxc-search` (search ladder) | `dev` (routing summary) |
| Data pipeline patterns | `dev-data` | `dev-backend` |
| Frontend implementation | `dev-frontend` | `dev-uiux-design` |
| Design intent discovery | `dev-uiux-design` | `dev-frontend` |
| Design judgment | `dev-uiux-design` | `dev-frontend` |
| Operational gates | `dev-devops` | `dev-backend`, `dev-scaffolding` |
| Project scaffolding / docs | `dev-scaffolding` | `pabcd` |
| C0/C1 classification and record exemption | dev §0.0/§0.1 | pabcd, dev-scaffolding |
| Unit residence and numbered roadmap contents | pabcd references/implementation-units.md, subject to dev §0.1 | loop, dev-scaffolding |
| Loop intent, docs-first activation, scoped continuation | loop SKILL.md | pabcd, goalplan |
| Goalplan schema and runtime lifecycle | loop references/durable-goalplan.md and references/runtime-lifecycle.md respectively | pabcd, goalplan |
| Phase control and phase work | pabcd references/phase-control.md and phase-plan/audit/check.md respectively | loop, orchestrate |
| C2+ P-phase loop-spec output fields | pabcd references/plan-output.md | pabcd P router, phase-plan |
| Repair and optimization method | pabcd references/loop-engineering.md and optimization.md respectively | loop |
| PABCD workflow | `pabcd` | — |
| Anti-slop output | `dev` §Family Invariants | all `dev-*` |
| file:line evidence | `dev` §Family Invariants | all `dev-*` |
| Completion proof | `dev` §Family Invariants | `pabcd`, all `dev-*` |

When updating a rule, update the canonical owner first, then verify stubs still point correctly.
