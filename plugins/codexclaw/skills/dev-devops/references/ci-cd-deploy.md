# CI/CD & Deploy — Pipeline & Delivery Patterns

Last reviewed: 2026-06-16
Applies to: GitHub Actions, ArgoCD 2.14+, Argo Rollouts 1.8+
When to read: Deploy pipeline setup or modification
Canonical owner: dev-devops §2

---

## §0 Release Routing

For package publishing and release-auth decisions, read
`references/package-release.md` before writing workflow YAML.
For platform engineering, DORA capability framing, or provider-routing breadth,
read `references/platform-engineering.md`.

This file owns deployment pipelines, GitOps promotion, rollback, environments,
and progressive delivery. `package-release.md` owns package registry defaults
such as npm/PyPI trusted publishing, Bun-to-npm decisions, Homebrew as a
downstream channel, and token fallback boundaries.

## §1 GHA Reusable Workflow Templates

### Called Workflow (Template)

```yaml
# .github/workflows/templates/build-test.yml
name: Build & Test
on:
  workflow_call:
    inputs:
      service_name:
        required: true
        type: string
      dockerfile:
        required: false
        type: string
        default: Dockerfile
    outputs:
      image_digest:
        value: ${{ jobs.build.outputs.digest }}
    secrets:
      REGISTRY_TOKEN:
        required: true

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      digest: ${{ steps.push.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.REGISTRY_TOKEN }}
      - uses: docker/build-push-action@v6
        id: push
        with:
          push: true
          file: ${{ inputs.dockerfile }}
          tags: ghcr.io/${{ github.repository }}/${{ inputs.service_name }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Caller Workflow

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]

jobs:
  build:
    uses: ./.github/workflows/templates/build-test.yml
    with:
      service: payments
    secrets: inherit

  deploy-staging:
    needs: build
    uses: ./.github/workflows/templates/deploy-gitops.yml
    with:
      environment: staging
      image_digest: ${{ needs.build.outputs.image_digest }}
    secrets: inherit
```

### Rules

| Rule | Detail |
|------|--------|
| Nesting | Max 10 levels (GitHub limit) |
| Permissions | Caller cannot escalate called workflow permissions |
| Secrets | `secrets: inherit` or explicit pass; never hardcode |
| Pinning | Pin reusable workflows to SHA or tag: `@v2` or `@sha256:...` |

---

## §2 GitOps Architecture

### Actions = CI, ArgoCD = CD

```
Developer → PR → CI (lint/test/build/scan/push) → merge
  → CI updates deploy repo (image digest) → ArgoCD detects → sync to cluster
```

| Pattern | When |
|---------|------|
| Single repo | Small team, 1-3 services |
| App + Deploy repo | Larger teams, separation of CI and deploy config |

### Digest-Based Promotion

```bash
# CI updates deploy repo kustomization.yaml
yq -i '.images[0].digest = "sha256:abc123..."' overlays/prod/kustomization.yaml
git commit -m "promote payments to sha256:abc123"
git push
# ArgoCD auto-syncs
```

| Banned | Fix |
|--------|-----|
| `image: app:v2.1` (mutable tag) | `image: app@sha256:abc123...` (immutable digest) |
| CI runs `kubectl apply` | ArgoCD reconciles from Git |

### Environment Protection

```yaml
# GitHub Environment settings (UI or API)
environment:
  name: production
  protection_rules:
    required_reviewers: 2
    prevent_self_review: true
    wait_timer: 5  # minutes
```

---

## §3 Progressive Delivery

### Argo Rollouts — Canary

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: payments
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
        - setWeight: 30
        - pause: { duration: 5m }
        - setWeight: 60
        - pause: { duration: 5m }
      canaryService: payments-canary
      stableService: payments-stable
      analysis:
        templates:
          - templateName: success-rate
        startingStep: 2
```

### Argo Rollouts — Blue-Green

```yaml
spec:
  strategy:
    blueGreen:
      activeService: payments-active
      previewService: payments-preview
      autoPromotionEnabled: false
      prePromotionAnalysis:
        templates:
          - templateName: smoke-test
```

### Flagger

```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: payments
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: payments
  service:
    port: 8080
  analysis:
    interval: 1m
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
      - name: request-success-rate
        thresholdRange: { min: 99 }
      - name: request-duration
        thresholdRange: { max: 500 }
```

### Selection Guide

| Tool | Best For | Granularity |
|------|----------|-------------|
| Argo Rollouts | K8s-native canary/blue-green, manual or metric-driven | Traffic weight steps |
| Flagger | Fully automated analysis + promote/rollback | Metric-driven auto |
| Feature flags | Code-level, user-segment targeting | Per-user/segment |

---

## §4 Rollback & DB Migration

### Expand-Contract Pattern

```
Phase 1: Add new column (nullable) → deploy code that writes both
Phase 2: Backfill old data → verify
Phase 3: Deploy code that reads new column only
Phase 4: Drop old column
```

| Rule | Detail |
|------|--------|
| Forward-only | Never write `down()` migrations; use expand-contract |
| Backward-compatible | New code must work with old schema during rollout |
| Rollback plan | Document per-service: what to rollback, how, who |
| Time budget | Every deploy rollback-capable within 5 minutes |

---

## §5 Anti-Patterns

| Banned | Why | Fix |
|--------|-----|-----|
| Mutable tag deploy | Can't reproduce; ArgoCD drift | Digest-based promotion |
| `kubectl apply` from CI | No audit trail, manual drift | GitOps (ArgoCD) |
| Manual deployment | Human error, no rollback path | Automated pipeline |
| No prod approval | Unreviewed changes hit users | Environment protection |
| `down()` migrations | Rollback breaks forward-deployed code | Expand-contract |
| Deploy without smoke test | Silent failures | Post-deploy smoke in pipeline |
