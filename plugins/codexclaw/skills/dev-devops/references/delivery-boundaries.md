## §6 Cross-References

| Topic | Canonical Owner | What dev-devops defers |
|-------|----------------|----------------------|
| Test strategy & CI test stages | [dev-testing CI stages](../../dev-testing/references/ci-integration.md) | Test pyramid, coverage gates |
| Backend observability code patterns | `dev-backend` `observability.md` | OTel SDK setup, structured logging |
| Security hardening (app-layer) | `dev-security` | OWASP, auth, input validation |
| SBOM/signing depth | [dev-security SBOM](../../dev-security/references/supply-chain-sbom.md) | Supply-chain evidence policy beyond image scan gates |
| Architecture module boundaries | `dev-architecture` | Coupling taxonomy, barrel discipline |
| Scaffolding conventions | `dev-scaffolding` | File naming, project structure |
| Frontend build/bundle | `dev-frontend` | Vite/webpack config, SSR |

**dev-devops owns**: container builds, deploy pipelines, K8s manifests, IaC modules, SRE/incident response, edge infra, ML infra. DevOps owns operational scan execution and release gates; `dev-security` owns security policy, severity thresholds, and required evidence.
**dev-backend owns**: application-layer observability code, API design, health check implementation.
Overlap: observability alerting rules (dev-devops §5) ↔ observability code instrumentation (dev-backend `observability.md`). Cross-ref both.

## Reference Reading Order

Read `package-release.md` for package publishing, registry auth, npm/PyPI
trusted publishing, Bun-to-npm release decisions, and downstream package
channels. Read `cross-platform-release.md` when a release claim depends on
OS-local behavior that CI may not prove. Read `homebrew.md` for Formula/Cask
distribution work. Read `platform-engineering.md` for broader DevOps capability
refresh, DORA, provider routing, and platform guardrails. Read `docker.md` + `ci-cd-deploy.md` first for containerized deploy workflows.
For K8s-specific work, add `kubernetes.md`. For SRE/on-call, add `sre-foundations.md`.

## Routing Role

Build reliable, secure, and automated infrastructure and delivery pipelines.
This skill is a routing role that activates by **change-surface**: whenever the work primarily touches containers, CI/CD, deployment, cloud/runtime infrastructure, Kubernetes, IaC, release engineering, or SRE operations, use this skill and then load the relevant references.
