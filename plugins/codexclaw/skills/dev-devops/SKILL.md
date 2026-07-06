---
name: cxc-dev-devops
description: "MUST USE for DevOps, infrastructure, or delivery work — container builds, deploy pipelines, Kubernetes, Infrastructure as Code, SRE foundations, edge/serverless, and ML infrastructure. Triggers: 'Dockerfile', 'container build', 'deploy', 'CI/CD', 'Kubernetes', 'K8s', 'Terraform', 'Pulumi', 'Helm', 'SRE', 'SLI', 'SLO', 'error budget', 'serverless', 'edge', '배포', '인프라', '쿠버네티스'."
metadata:
  last-verified: "2026-07-02"
  short-description: "Container, deploy, Kubernetes, IaC, and SRE guidance for production delivery."
---

# Dev-DevOps — Production Infrastructure & Delivery

> **Backend handoff rule:** When a deploy/SRE gate needs app behavior, `dev-backend` implements
> the hook (health handler, readiness dependency check, trace/span/log fields, migration
> compatibility, shutdown hook). `dev-devops` defines the operational gate, rollout/rollback
> behavior, alert policy, and release proof. This skill owns deployment strategy, rollback
> proof, observability operations, health/readiness operational gates, SLOs, incident response,
> and infrastructure/runtime delivery.


Build reliable, secure, and automated infrastructure and delivery pipelines.
This skill is a routing role that activates by **change-surface**: whenever the work primarily touches containers, CI/CD, deployment, cloud/runtime infrastructure, Kubernetes, IaC, release engineering, or SRE operations, use this skill and then load the relevant references.

> **C0/C1 work (small local patches):** See `dev` §0.0 Work Classifier + §0.1 Patch Fast-Path before reading references.

Severity mapping: `CRITICAL`/`HIGH` ⇒ STRICT; `MEDIUM` ⇒ DEFAULT (aligned with `dev` §0.2).

## Modular References

| File | When to Read | What It Covers |
|------|-------------|----------------|
| `references/docker.md` | Container build/deploy | Multi-stage builds, distroless, Docker Scout/Trivy, BuildKit secrets, SBOM/Cosign |
| `references/package-release.md` | Package publishing / release auth | npm/PyPI trusted publishing, Bun-to-npm, registry auth model, downstream distribution table |
| `references/cross-platform-release.md` | Cross-platform release proof | CI matrix vs local OS proof, Windows App/RDP prompts, desktop verification boundaries |
| `references/homebrew.md` | Homebrew distribution | Formula vs Cask, audit/test, livecheck, artifact trust, install/uninstall proof |
| `references/platform-engineering.md` | Platform / DORA / provider routing | DORA capabilities, platform guardrails, provider table rows, SLSA handoff |
| `references/kubernetes.md` | K8s deployment | Gateway API (v1.6+), Kustomize overlays, HPA/VPA, Helm, ArgoCD GitOps |
| `references/ci-cd-deploy.md` | Deploy pipeline | GHA reusable workflows, deploy strategies, rollback, GitOps, progressive delivery |
| `references/iac.md` | Infrastructure code | OpenTofu/Terraform modules, Pulumi, state encryption, blast radius isolation |
| `references/sre-foundations.md` | Operations/incidents | SLO/SLI/error budget, burn-rate alerting, incident response, blameless postmortem |
| `references/edge-serverless.md` | Edge/serverless work | Edge request shaping, auth at edge, Cloudflare Workers, Vercel Edge, edge AI triage |
| `references/ml-infra.md` | ML infrastructure | GPU cluster mgmt, model registry, scaling, edge inference, MLOps platform patterns |

Read `package-release.md` for package publishing, registry auth, npm/PyPI
trusted publishing, Bun-to-npm release decisions, and downstream package
channels. Read `cross-platform-release.md` when a release claim depends on
OS-local behavior that CI may not prove. Read `homebrew.md` for Formula/Cask
distribution work. Read `platform-engineering.md` for broader DevOps capability
refresh, DORA, provider routing, and platform guardrails. Read `docker.md` + `ci-cd-deploy.md` first for containerized deploy workflows.
For K8s-specific work, add `kubernetes.md`. For SRE/on-call, add `sre-foundations.md`.

When release, registry-auth, provider-doc, service-status, image/platform
version, or package-manager behavior depends on current external evidence, read
the active `search` skill and follow its source-fetch and evidence-status rules
instead of relying on stale memory or copied snippets.

---
## §1 Container Builds

### §1.1 Dockerfile Rules (STRICT)

| Rule | Detail |
|------|--------|
| Multi-stage | Separate build and runtime stages; final image has no build tools |
| Base image | Pin version + SHA256 digest: `node:22-slim@sha256:abc...` |
| Distroless | Prefer `gcr.io/distroless/*` for runtime; no shell, no package manager |
| Non-root | `USER nonroot:nonroot` (distroless) or create dedicated user |
| Dependency-first copy | `COPY package.json bun.lock ./` → install → `COPY . .` for layer caching |
| BuildKit secrets | `RUN --mount=type=secret,id=token ...` — never use `ARG` for secrets |
| `.dockerignore` | `.git`, `node_modules`, `.env*`, `*.log`, `dist/`, `coverage/`, `__pycache__/` |

For canonical Dockerfile templates, read `references/docker.md` §1.

### §1.2 Image Security (STRICT)

CRITICAL/HIGH findings → block push. No exceptions. Read
`references/docker.md` §4 for scan/SBOM/sign command examples, and
`../dev-security/references/supply-chain-sbom.md` for deeper SBOM/signing
policy.

### §1.3 Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| `FROM node:latest` | Irreproducible builds | Pinned version + digest |
| `USER root` in final stage | Attack surface | Non-root user |
| `COPY . .` as first instruction | Cache invalidation on every change | Dependency files first |
| `ARG SECRET=xxx` | Exposed in image history | BuildKit `--mount=type=secret` |
| No scan before push | Vulnerable images in prod | Trivy/Scout CI gate |
| `apt-get install` without cleanup | Bloated image | `--no-install-recommends && rm -rf /var/lib/apt/lists/*` |

---

## §2 Deploy Pipeline

### §2.1 Pipeline Stages (DEFAULT)

```
[dev-testing §5]  lint → typecheck → test → contract → e2e
[dev-devops]      build-image → scan → push-registry → deploy-staging → smoke → promote → deploy-prod
```

### §2.2 GHA Reusable Workflows (DEFAULT)

```yaml
# .github/workflows/ci.yml (caller)
jobs:
  build:
    uses: org/templates/.github/workflows/build-test.yml@v2
    with:
      service: payments
    secrets: inherit
```

| Rule | Detail |
|------|--------|
| `workflow_call` | Central CI template, max 10-level nesting |
| Permissions | Caller cannot escalate; downgrade only |
| Environment | `environment: production` + required reviewers + prevent self-review |
| Promote | Digest-based (`image@sha256:...`), never mutable tags |

### §2.3 Deploy Strategies (DEFAULT)

| Strategy | Tool | When | Risk |
|----------|------|------|------|
| Rolling update | K8s Deployment | Stateless, low risk | Low |
| Blue-green | Argo Rollouts `blueGreen:` | Instant rollback, no DB migration | Medium |
| Canary | Argo Rollouts `canary: steps:` | Traffic % control, metric-based promote | Medium |
| Progressive | Flagger | Auto analysis + rollback, A/B testing | Medium-High |
| Feature flag | LaunchDarkly / Unleash | Code-level gradual rollout | Low |

### §2.4 Rollback Rules (STRICT)

- Every deployment must be rollback-capable within 5 minutes
- Digest-based promote only — mutable tags are banned
- DB migrations: forward-only + backward-compatible (expand-contract pattern)
- Post-rollback: automatic Slack/PagerDuty notification

### §2.5 Secret Management (STRICT)

**Rule (DEVOPS-AUTH-01):** Prefer OIDC, workload identity federation, trusted publishing, or other short-lived credential flows before static long-lived tokens. When static tokens are unavoidable, scope narrowly, store in the managed secret system, and rotate on schedule or incident.

| Source | Usage |
|--------|-------|
| GHA Secrets / Vault / AWS SM | CI pipeline secrets |
| External Secrets Operator | K8s → Vault/AWS SM sync |
| `.env` files | **Never committed** — generated in CI |
| Rotation | 90-day cycle or immediate on incident |

### §2.6 GitOps (DEFAULT)

- **Actions = CI, ArgoCD = CD** — separation of concerns
- Actions updates deploy repo (image digest PR/commit) → ArgoCD reconciles
- Self-heal: ArgoCD auto-reverts drift
- Environment protection: GitHub Environments for prod approval gate

### §2.7 Release Proof Contract (STRICT)

**Rule (DEVOPS-RELEASE-PROOF-01):** A release claim must name the artifact digest, workflow/builder identity, deploy target/environment, smoke-test evidence, and rollback evidence. Keep the proof at router level; detailed package, platform, and SLSA mechanics live in `package-release.md`, `cross-platform-release.md`, and `platform-engineering.md`.

---

## §3 Kubernetes Basics

### §3.1 Minimum Viable K8s (DEFAULT)

| Resource | Purpose |
|----------|---------|
| Deployment | Pod template + replica management |
| Service | Internal networking |
| HTTPRoute (Gateway API) | External traffic routing — **not Ingress** |
| ResourceQuota | Request/limit enforcement |
| Probes | Liveness + readiness + startup |
| Namespace | Environment isolation (dev/staging/prod) |

### §3.2 Gateway API (v1.6+, verified 2026-07-02 — TCPRoute/UDPRoute GA in v1.6)

Gateway API is the successor for new routing while Ingress remains GA but feature-frozen. Role separation: platform team owns `GatewayClass` + `Gateway`, app team owns `HTTPRoute`.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: payments-route
spec:
  parentRefs:
    - name: shared-gateway
  hostnames: ["payments.example.com"]
  rules:
    - matches:
        - path: { type: PathPrefix, value: /api }
      backendRefs:
        - name: payments-svc
          port: 8080
```

### §3.3 Scaling (DEFAULT)

| Mechanism | Scope | Watch |
|-----------|-------|-------|
| HPA | CPU/memory + custom metrics | Don't combine with VPA on same metric |
| VPA | Request auto-tuning | Use `Off` mode for recommendations only |
| PDB | Disruption budget | `minAvailable: 50%` or `maxUnavailable: 1` |

### §3.4 Anti-Patterns

| Banned | Fix |
|--------|-----|
| `Ingress` (new projects) | Gateway API `HTTPRoute` |
| No resource limits | Always set requests + limits |
| `image: app:latest` | SHA digest or pinned SemVer |
| Single replica in prod | Minimum 2 + PDB |
| Secrets in ConfigMap | K8s Secret + External Secrets Operator |
| Annotation-based routing | Gateway API native fields |

---

## §4 Infrastructure as Code

### §4.1 OpenTofu/Terraform Rules (DEFAULT)

| Rule | Detail |
|------|--------|
| State | Remote backend required (S3+DynamoDB / TF Cloud / OpenTofu) |
| Encryption | OpenTofu native state/plan encryption via KMS |
| Blast radius | Separate state per app/layer/env |
| Modules | Purpose-built (vpc, iam, ecs-service), typed I/O |
| Apply | `plan` → PR review → `apply`; auto-apply staging only |
| Versions | Pin provider + module versions explicitly |

### §4.2 Tool Selection (HEURISTIC)

| Tool | Best For | 2026 Status |
|------|----------|-------------|
| OpenTofu (HCL) | Open-source/licensing-neutral IaC default (MPL-2.0, Linux Foundation) | ✅ Recommended for OSS neutrality |
| Terraform / HCP Terraform (BSL) | Vendor support or HashiCorp platform integration | ✅ Active (check BSL competitive-use terms) |
| Pulumi (TS/Python) | Teams preferring programming languages | ✅ Active |
| AWS CDK | AWS-only infrastructure | ✅ Active (AWS only) |
| **CDKTF** | — | ❌ Deprecated 2025-12-10; repo archived/read-only, no further fixes |

### §4.3 Anti-Patterns

| Banned | Fix |
|--------|-----|
| Local state file | Remote backend required |
| Manual console changes | All changes via code |
| Hardcoded values | Variables + tfvars |
| Monolithic main.tf | Modular decomposition |
| CDKTF (new projects) | OpenTofu or Pulumi |
| Unpinned provider versions | Explicit version constraints |

---

## §5 SRE Foundations

### §5.1 SLO/SLI (DEFAULT)

| SLI | Measurement | Typical SLO |
|-----|-------------|-------------|
| Availability | Success requests / total | 99.9% (28-day rolling) |
| Latency | p50/p95/p99 response time | p99 < 500ms |
| Error rate | 5xx / total | < 0.1% |
| Freshness | Data update delay | < 5min (pipelines) |

SLIs measure **user experience**, not infrastructure metrics. "CPU is fine ≠ users are fine."

Error budget = 1 − SLO (99.9% → 0.1% budget).

**DORA 2025 (verified 2026-07-02):** AI acts as an *amplifier* — returns depend on the underlying sociotechnical system. For AI-agent-heavy delivery invest in golden paths, guardrails, observability, provenance, and review gates.

### §5.2 Error Budget Policy (DEFAULT)

| Budget State | Action |
|-------------|--------|
| Normal (>50%) | Continue releases, routine monitoring |
| Accelerated burn (20–50%) | Heightened alerts, slow releases, reliability triage |
| **Exhausted (≤0%)** | **Feature freeze** — security/bugfix only; VP exception required |

Single incident consuming >20% → mandatory postmortem.
Two consecutive window misses → architecture review.

### §5.3 Incident Response (DEFAULT)

1. **Detect** → **Triage** (S1/S2/S3) → **Stabilize** → **Fix** → **Postmortem**
2. Roles: IC, Primary Responder, Comms Lead, Scribe
3. **Mitigation first, diagnosis second** during active incidents
4. All S1/S2 → mandatory blameless postmortem within 5 business days
5. Status updates: S1 every 15min, S2 every 30min

### §5.4 Runbook Template (HEURISTIC)

```markdown
## [Service] — [Symptom]
### Diagnosis
1. Logs: `kubectl logs -l app=<name> --tail=100`
2. Metrics: Grafana → [dashboard URL]
3. Dependencies: `curl -s http://<dep>/health | jq .`
### Emergency Mitigation
1. Rollback: `argocd app rollback <app>`
2. Traffic block: ...
### Root Fix
1. ...
### Escalation
- Owner: @team-sre
- PagerDuty: [policy]
```

### §5.5 Anti-Patterns

| Banned | Fix |
|--------|-----|
| Infrastructure-only SLIs | User-experience-based SLIs |
| SLO without consequences | Error budget policy with freeze gate |
| Too many SLIs (>5 per service) | 2-4 meaningful SLIs |
| Page on every deviation | Burn-rate multi-window alerting |
| Blame individuals | Blameless postmortem, system improvement |
| No error budget policy | Define 3-stage policy (normal/accelerated/exhausted) |

---

## §6 Cross-References

| Topic | Canonical Owner | What dev-devops defers |
|-------|----------------|----------------------|
| Test strategy & CI test stages | `dev-testing` §5 | Test pyramid, coverage gates |
| Backend observability code patterns | `dev-backend` `observability.md` | OTel SDK setup, structured logging |
| Security hardening (app-layer) | `dev-security` | OWASP, auth, input validation |
| SBOM/signing depth | `dev-security` `references/supply-chain-sbom.md` | Supply-chain evidence policy beyond image scan gates |
| Architecture module boundaries | `dev-architecture` | Coupling taxonomy, barrel discipline |
| Scaffolding conventions | `dev-scaffolding` | File naming, project structure |
| Frontend build/bundle | `dev-frontend` | Vite/webpack config, SSR |

**dev-devops owns**: container builds, image security, deploy pipelines, K8s manifests, IaC modules, SRE/incident response, edge infra, ML infra.
**dev-backend owns**: application-layer observability code, API design, health check implementation.
Overlap: observability alerting rules (dev-devops §5) ↔ observability code instrumentation (dev-backend `observability.md`). Cross-ref both.

## Pre-flight Checklist

Before submitting infrastructure changes:

- [ ] Dockerfile is multi-stage with distroless/slim final image and non-root user
- [ ] Image scanned (Trivy/Scout) with CRITICAL/HIGH gate — no unresolved findings
- [ ] SBOM generated and attestation signed (Cosign) for production images
- [ ] Deploy pipeline uses digest-based promotion, never mutable tags
- [ ] K8s manifests have resource requests/limits, probes, PDB, and use Gateway API (not Ingress)
- [ ] IaC uses remote state, pinned versions, and modular decomposition
- [ ] Secrets are managed through Vault/AWS SM/GHA Secrets — no `.env` commits, no `ARG` secrets
- [ ] SLO/SLI defined with error budget policy and burn-rate alerting
- [ ] Rollback plan documented and tested — <5min rollback capability confirmed
- [ ] Runbook exists for critical failure scenarios
