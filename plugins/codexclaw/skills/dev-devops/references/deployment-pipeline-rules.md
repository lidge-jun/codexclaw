## §2 Deploy Pipeline

### §2.1 Pipeline Stages (DEFAULT)

```
[dev-testing §5]  lint → typecheck → test → contract → e2e
[dev-devops]      build-image → scan → push-registry → deploy-staging → smoke → promote → deploy-prod
```

For stacked/dependent PR CI, read [stacked PRs](../../dev/references/stacked-prs.md).

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
