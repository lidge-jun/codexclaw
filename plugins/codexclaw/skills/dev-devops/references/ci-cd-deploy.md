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
| Full-suite gate run as one process | Not the gate CI applies | `DEVOPS-SUITE-PARTITION-01` §6.1 |
| Red test waved as "environmental" | The most common way a real defect ships | `DEVOPS-BASELINE-DEFECT-01` §6.2 |
| New runner flags landed during a freeze | Red becomes indistinguishable from noise | `DEVOPS-VERIFY-INSTRUMENT-01` §6.3 |
| "It was green when I checked" | The head moved under you | `DEVOPS-EXACT-HEAD-01` §6.4 |
| `delete_branch_on_merge` treated as full branch hygiene | Closed-unmerged PRs keep their heads forever | `DEVOPS-BRANCH-AUTODELETE-01`, `branch-lifecycle.md` |
| Bulk-pruning branches by name pattern | Patterns encode neither PR state, stacks, nor forks | `DEVOPS-BRANCH-DELETE-EVIDENCE-01`, `branch-lifecycle.md` |

---

## §6 Verification Evidence Rules

Owner: this file. The GO/NO-GO decision rules that consume these live in
`dev-devops` SKILL.md §2.8. Sources are cited to the OpenCodex trains that
produced them, because each was learned by getting it wrong first.

### §6.1 Suite partitioning (`DEVOPS-SUITE-PARTITION-01`, STRICT)

A local one-process full-suite run is **not** the CI suite gate. Replay the
partition CI actually applies — the general shards plus each segregated job's
exact command — and record both forms.

Why: OpenCodex excludes three load-sensitive path patterns from its general
batches (`scripts/ci/run-bun-test-batches.sh`:50) and covers them with two
dedicated jobs — `storage policy` runs six files together, `api usage` runs one
(`.github/workflows/ci.yml`). Running everything in one process therefore fails
tests that CI never runs together, and the resulting red is not the gate's
verdict. Decomposed, the same tree gave 14565 pass / 0 fail on the general suite
and 9/0 on the storage-policy job
(`260824_v2_32_1_hotfix_train/900_go_nogo_readiness_report.md`:54-58).

Corollary: if you cannot state which CI job a local command corresponds to, that
command is not a gate.

### §6.2 Baseline versus defect (`DEVOPS-BASELINE-DEFECT-01`, STRICT)

A local red test is a **candidate defect** until all three hold:

1. the identical failure reproduces on the untouched pre-change baseline SHA,
2. no merged unit in the change set touches that code, and
3. CI's matching job is green at the freeze SHA.

Two out of three is not evidence. "It's flaky" and "it's environmental" are
conclusions, not observations, and they need the same proof as every other claim.
Remediation of a genuine flake is `dev-testing` `references/ci-pipeline.md` §5.

Source: `260824_v2_32_1_hotfix_train/900_go_nogo_readiness_report.md`:69-72, where
a local `api-usage` failure was waived only after all three legs were shown.

### §6.3 Instrument stability (`DEVOPS-VERIFY-INSTRUMENT-01`, STRICT)

Do not change the verification instrument — runner flags, parallelism, shard
layout, timeouts, retry policy — while using it to certify a freeze. Change it
against a known-good baseline, or defer it.

Stated at the source as: *a verification instrument gets changed against a
known-good baseline; it does not get used to establish one*
(`260824_v2_32_1_hotfix_train/070_wp2_pr2427_parallel_test_runner.md`:44-45).
That train deferred its parallel-runner PR for exactly this reason: across five
recorded runs, four different tests flaked, and the freeze gate was itself a
full-suite run — so landing the new runner would have made red indistinguishable
from noise (`070`:78-121).

### §6.4 Exact-head evidence (`DEVOPS-EXACT-HEAD-01`, STRICT)

Re-read the PR or branch head immediately before claiming exact-head evidence. A
contributor push mid-verification makes a recorded SHA stale; keep stale rows
labeled stale and never merge on them. A remembered pass is not evidence.

Source: `070_wp2_pr2427_parallel_test_runner.md`:136-139 — a MERGE recommendation
was formed against a head the author had already replaced, and the run table keeps
the superseded rows explicitly marked stale (`070`:87-98).

### §6.5 Stability counting (`DEVOPS-FLAKE-STABILITY-01`, DEFAULT)

A flaky-capable suite is stable only after N consecutive greens at **one** head
plus the required CI matrix. Declare N in the GO report; OpenCodex set its bar at
N=3 plus Linux and Windows CI
(`260824_v2_32_1_hotfix_train/070_wp2_pr2427_parallel_test_runner.md`:125-126) —
and never collected it, which is why that PR was deferred rather than landed.
One green run is not a land signal: at the head under test the recorded runs were
green, green, then a failure (`070`:87-98).

This rule counts greens. It does not tell you how to fix a flake: that is
`dev-testing` `references/ci-pipeline.md` §5, which owns `TEST-FLAKE-*`.
