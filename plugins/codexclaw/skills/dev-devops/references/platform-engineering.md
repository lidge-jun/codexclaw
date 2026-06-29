# Platform Engineering — DevOps Capability Routing

Last reviewed: 2026-06-21
Applies to: DevOps capability refresh, platform guardrails, DORA metrics, provider routing, agent automation
When to read: Broad DevOps refresh, platform engineering decisions, provider-spanning CI/CD/IaC/SRE work
Canonical owner: dev-devops platform and capability routing

---

## §1 Purpose

Use this reference to route broad DevOps work by capability instead of dumping
vendor snippets into `dev-devops/SKILL.md`. Keep the main skill lightweight and
load detailed references only when the task needs them.

## §2 Capability Map

| Capability | Read first | Evidence to collect |
|---|---|---|
| Continuous integration | `dev-testing/references/ci-pipeline.md` | lint/type/test/contract/e2e order, artifacts, matrix reasoning |
| Continuous delivery/deployment | `ci-cd-deploy.md` | environments, approvals, rollback, smoke, progressive strategy |
| Package release | `package-release.md` | auth model, provenance, install smoke, token fallback reason |
| Cross-platform release | `cross-platform-release.md` | CI matrix proof and target OS/local proof gaps |
| Infrastructure as Code | `iac.md` | state boundary, module ownership, plan/apply gate, drift detection |
| Containers | `docker.md` | base pinning, scan, SBOM, signing, private install secret handling |
| Kubernetes | `kubernetes.md` | Gateway API, rollout, HPA/VPA/PDB, GitOps boundary |
| SRE/operations | `sre-foundations.md` | SLO, burn-rate alert, incident role, recovery evidence |
| Supply chain / SLSA | `dev-security/references/supply-chain-sbom.md` | SBOM, signing, provenance, dependency audit, verification policy |

## §3 DORA Metrics Use

DORA metrics are diagnostic signals, not universal targets.

| Metric | Use as | Avoid |
|---|---|---|
| Change lead time | Bottleneck detector from commit to production | Forcing every repo to the same target |
| Deployment frequency | Release-flow health signal | Treating more deployments as always better |
| Failed deployment recovery time | Recovery and rollback capability check | Ignoring incident severity/context |
| Change fail rate | Quality and release-risk signal | Blaming individuals for systemic failure |
| Deployment rework rate | Rework/rollback friction signal | Counting without action items |

When applying DORA, name the project type, release cadence, risk class, and
operational owner before recommending changes.

## §4 Platform Engineering Guardrails

Good internal platforms create paved roads without hiding ownership.

| Guardrail | Rule |
|---|---|
| Reusable workflows | Provide defaults, but allow explicit project inputs |
| Golden paths | Include build, test, scan, publish, deploy, rollback, and smoke proof |
| Secrets | Prefer OIDC/federation or short-lived tokens; require justification for long-lived secrets |
| Observability | Emit deploy markers, release metadata, and failure artifacts |
| Agent automation | Agents may generate config, but must collect proof and surface human decisions |
| Escape hatches | Document when a project may opt out and what evidence replaces the default |

AI-assisted DevOps amplifies existing system dynamics. Strengthen platform
guardrails, evidence bundles, and rollback paths before increasing automation.

## §5 Provider Route Rows

Keep provider notes table-only unless a task asks for provider-specific depth.

| Provider/platform | Route | Do not confuse with |
|---|---|---|
| GitHub Actions | OIDC, environments, reusable workflows, GitHub Packages | Registry-native trusted publishing unless the registry supports it |
| GitLab CI/CD | Auto DevOps, review apps, security scanning, environments | GitHub-only workflow syntax |
| Azure DevOps / Azure | Workload identity federation, environments, ACR | Generic registry OIDC |
| AWS | IAM OIDC federation, ECR, deployment roles, IaC state | Long-lived AWS keys in CI |
| Google Cloud | Workload Identity Federation, Artifact Registry, deploy targets | Service account keys by default |
| Cloudflare/Vercel | Edge/serverless deployment, previews, environment bindings | Container/Kubernetes rollout rules |

## §6 SLSA and Security Handoff

`dev-devops` owns collection of release/deploy proof. `dev-security` owns
security policy details.

DevOps proof should record:

- artifact identity and digest/version;
- builder/workflow identity;
- provenance/SBOM/signing status;
- deploy target and rollback path;
- verification commands and artifacts;
- security exceptions and owners.

Read `dev-security/references/supply-chain-sbom.md` for SLSA, SBOM, signing,
dependency audit, and provenance policy instead of duplicating those rules here.

## §7 Broad Refresh Checklist

Before changing broad DevOps guidance:

1. Identify the capability being changed.
2. Read the canonical reference in the capability map.
3. Check whether `dev-testing` or `dev-security` is the owner.
4. Keep provider examples as table rows unless provider-specific implementation
   is the task.
5. Update `dev-devops/SKILL.md` only as a route, not as a long example host.
