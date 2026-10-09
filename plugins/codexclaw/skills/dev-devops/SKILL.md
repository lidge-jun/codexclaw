---
name: cxc-dev-devops
description: "Use for infra, CI/CD, releases, repo policy, worktree cleanup and native desktop apps. Triggers: Dockerfile, K8s, IaC, SRE, Tauri, 스택 PR CI, 배포, 인프라, 쿠버네티스, 브랜치 정리, 브랜치 삭제, 워크트리 정리, 저장소 세팅, 브랜치 보호, 에이전트 PR, PR 정책, 데스크톱 앱, 메뉴 막대."
metadata:
  last-verified: "2026-09-09"
  short-description: "Container, deploy, Kubernetes, IaC, SRE, and branch-lifecycle guidance for production delivery."
---
# Dev-DevOps — Production Infrastructure & Delivery

> **Backend handoff rule:** When a deploy/SRE gate needs app behavior, `dev-backend` implements
> the hook (health handler, readiness dependency check, trace/span/log fields, migration
> compatibility, shutdown hook). `dev-devops` defines the operational gate, rollout/rollback
> behavior, alert policy, and release proof. This skill owns deployment strategy, rollback
> proof, observability operations, health/readiness operational gates, SLOs, incident response,
> and infrastructure/runtime delivery.

Class, fast path, rule authority, proof, and safety: [dev](../dev/SKILL.md). Current/public evidence: [dev routing](../dev/SKILL.md#conditional-routes).

Severity and rule authority are distinct (`dev` §0.2). Safety/correctness and release
proof remain mandatory; architecture/tool preferences need project-specific justification.

### §2.7 Release Proof Contract (STRICT)

**Rule (DEVOPS-RELEASE-PROOF-01):** A release claim must name the artifact digest, workflow/builder identity, deploy target/environment, smoke-test evidence, and rollback evidence. Keep the proof at router level; detailed package, platform, and SLSA mechanics live in [package-release.md](references/package-release.md), [cross-platform-release.md](references/cross-platform-release.md), and [platform-engineering.md](references/platform-engineering.md).

## Modular References

| Condition | Reference |
|---|---|
| Container builds or image push | [container-build-rules.md](references/container-build-rules.md); [docker.md](references/docker.md) |
| Deploy pipeline, rollout, rollback, secrets, or GitOps | [deployment-pipeline-rules.md](references/deployment-pipeline-rules.md); [ci-cd-deploy.md](references/ci-cd-deploy.md) |
| Freeze or GO/NO-GO publication decision | [release-readiness.md](references/release-readiness.md) |
| Package publishing, registry auth, trusted publishing, or distribution channels | [package-release.md](references/package-release.md) |
| Release depends on OS-local behavior | [cross-platform-release.md](references/cross-platform-release.md) |
| Tauri, AppKit/SwiftUI, WidgetKit, menu-bar/tray, embedded runtimes; desktop acceptance or release readiness | [native-desktop-acceptance.md](references/native-desktop-acceptance.md) |
| TCC, Gatekeeper, login/background items, keychain, or Apple Events approval prompts | [macos-system-approvals.md](references/macos-system-approvals.md) |
| Homebrew Formula/Cask distribution | [homebrew.md](references/homebrew.md) |
| Platform, DORA, provider routing, or SLSA handoff | [platform-engineering.md](references/platform-engineering.md) |
| K8s deploys, Gateway API, scaling, or manifest checks | [kubernetes-basics.md](references/kubernetes-basics.md); [kubernetes.md](references/kubernetes.md) |
| Stacked/dependent PRs or unexpected CI runs | [Stacked PRs](../dev/references/stacked-prs.md) |
| Authorized branch/worktree cleanup | [branch-hygiene-rules.md](references/branch-hygiene-rules.md); [branch-lifecycle.md](references/branch-lifecycle.md) |
| Repository setup, rulesets, auto-delete, or PR limits | [repo-bootstrap.md](references/repo-bootstrap.md) |
| Agent-authored intake policy or superseded PRs | [agent-pr-intake.md](references/agent-pr-intake.md) |
| Local worktree/branch GC or scheduled cleanup | [local-gc.md](references/local-gc.md) |
| IaC modules, state, or blast radius | [infrastructure-code-rules.md](references/infrastructure-code-rules.md); [iac.md](references/iac.md) |
| SLO, error budget, incident, or runbook | [sre-basics.md](references/sre-basics.md); [sre-foundations.md](references/sre-foundations.md) |
| Edge/serverless delivery | [edge-serverless.md](references/edge-serverless.md) |
| GPU clusters, model registry, scaling, or MLOps | [ml-infra.md](references/ml-infra.md) |
| Ownership overlaps with app, testing, or security work | [delivery-boundaries.md](references/delivery-boundaries.md) |
| Submitting infrastructure changes | [infrastructure-preflight.md](references/infrastructure-preflight.md) |
