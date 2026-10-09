# Router r2 relocation ledger

Scope: five owned skills and their local references; no git writes, spawning, or builds. Whole-file budget includes byte-identical frontmatter.

## Measurements

| Router | Before whole B | After whole B | After body B | Frontmatter SHA-256 (unchanged) |
|---|---:|---:|---:|---|
| dev-debugging | 22270 | 5276 | 4760 | `9dc7ee83f2613b431bcd93de392dda4b23e0a582dd1577ddae1544995e238b0d` |
| dev-devops | 26050 | 4603 | 4065 | `8dd405ab34e3628f5b22aa8bdef841a95de2895afcf3340fe41fdd64e614b1ee` |
| dev-testing | 30014 | 4275 | 3827 | `11ac5e2b70e20fe87b3ca3b4a7f121b906e1150ba8a7ba5c812fe7896a54de23` |
| dev-code-reviewer | 21666 | 5085 | 4605 | `e83d5d07f7baf327189ce16d77ebe2a35d1a7795060a8532bd0f9bcd30aeff83` |
| dev-scaffolding | 19397 | 2000 | 1606 | `c8d4bbd4d4a8912ba8fe710d9672a541339965811227a1b94c3a6b2c20b052b2` |

## Moves

Paths below are repository-relative. Each moved section retains its wording, headings, examples, and rule IDs; path corrections account for the additional reference-directory depth.

| Source | Removed heading / block | Destination |
|---|---|---|
| plugins/codexclaw/skills/dev-debugging/SKILL.md | C0/C1 and dev-canonical blocks (unheaded) | pointer to plugins/codexclaw/skills/dev/SKILL.md#01-patch-fast-path-c0c1; #02-rule-classes; #3-verification-before-completion-strict; #5-safety-rules (owner verified) |
| plugins/codexclaw/skills/dev-devops/SKILL.md | C0/C1 and dev-canonical blocks (unheaded) | pointer to plugins/codexclaw/skills/dev/SKILL.md#01-patch-fast-path-c0c1; #02-rule-classes; #3-verification-before-completion-strict; #5-safety-rules (owner verified) |
| plugins/codexclaw/skills/dev-testing/SKILL.md | C0/C1 and dev-canonical blocks (unheaded) | pointer to plugins/codexclaw/skills/dev/SKILL.md#01-patch-fast-path-c0c1; #02-rule-classes; #3-verification-before-completion-strict; #5-safety-rules (owner verified) |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | C0/C1 and dev-canonical blocks (unheaded) | pointer to plugins/codexclaw/skills/dev/SKILL.md#01-patch-fast-path-c0c1; #02-rule-classes; #3-verification-before-completion-strict; #5-safety-rules (owner verified) |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | C0/C1 and dev-canonical blocks (unheaded) | pointer to plugins/codexclaw/skills/dev/SKILL.md#01-patch-fast-path-c0c1; #02-rule-classes; #3-verification-before-completion-strict; #5-safety-rules (owner verified) |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | The Phases | plugins/codexclaw/skills/dev-debugging/references/root-cause-phases.md#the-phases |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Phase 0: Is This a Bug or a Design Problem? | plugins/codexclaw/skills/dev-debugging/references/root-cause-phases.md#phase-0-is-this-a-bug-or-a-design-problem |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Phase 1: Root Cause Investigation | plugins/codexclaw/skills/dev-debugging/references/root-cause-phases.md#phase-1-root-cause-investigation |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Phase 2: Pattern Analysis | plugins/codexclaw/skills/dev-debugging/references/root-cause-phases.md#phase-2-pattern-analysis |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Phase 3: Hypothesis and Testing | plugins/codexclaw/skills/dev-debugging/references/root-cause-phases.md#phase-3-hypothesis-and-testing |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Phase 4: Implementation | plugins/codexclaw/skills/dev-debugging/references/root-cause-phases.md#phase-4-implementation |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Compact Summary | plugins/codexclaw/skills/dev-debugging/references/root-cause-phases.md#compact-summary |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Red Flags — Return to Phase 1 | plugins/codexclaw/skills/dev-debugging/references/debugging-pitfalls.md#red-flags--return-to-phase-1 |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Slop Debugging Patterns | plugins/codexclaw/skills/dev-debugging/references/debugging-pitfalls.md#slop-debugging-patterns |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Concrete Debugging Scenarios | plugins/codexclaw/skills/dev-debugging/references/debugging-scenarios.md#concrete-debugging-scenarios |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Scenario A: API Returns 500 | plugins/codexclaw/skills/dev-debugging/references/debugging-scenarios.md#scenario-a-api-returns-500 |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Scenario B: React Hydration Mismatch | plugins/codexclaw/skills/dev-debugging/references/debugging-scenarios.md#scenario-b-react-hydration-mismatch |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Scenario C: N+1 Query Performance | plugins/codexclaw/skills/dev-debugging/references/debugging-scenarios.md#scenario-c-n1-query-performance |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Scenario D: Flaky Test (Intermittent Failure) | plugins/codexclaw/skills/dev-debugging/references/debugging-scenarios.md#scenario-d-flaky-test-intermittent-failure |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | When to Escalate vs When to Keep Digging | plugins/codexclaw/skills/dev-debugging/references/escalation-and-postmortems.md#when-to-escalate-vs-when-to-keep-digging |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Keep Digging When: | plugins/codexclaw/skills/dev-debugging/references/escalation-and-postmortems.md#keep-digging-when |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Escalate When: | plugins/codexclaw/skills/dev-debugging/references/escalation-and-postmortems.md#escalate-when |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | How to Escalate Well | plugins/codexclaw/skills/dev-debugging/references/escalation-and-postmortems.md#how-to-escalate-well |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Post-Mortem Discipline | plugins/codexclaw/skills/dev-debugging/references/escalation-and-postmortems.md#post-mortem-discipline |
| plugins/codexclaw/skills/dev-debugging/SKILL.md | Integration with Other Skills | plugins/codexclaw/skills/dev-debugging/references/skill-boundaries.md#integration-with-other-skills |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §1 Container Builds | plugins/codexclaw/skills/dev-devops/references/container-build-rules.md#1-container-builds |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §1.1 Dockerfile Rules (STRICT) | plugins/codexclaw/skills/dev-devops/references/container-build-rules.md#11-dockerfile-rules-strict |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §1.2 Image Security (STRICT) | plugins/codexclaw/skills/dev-devops/references/container-build-rules.md#12-image-security-strict |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §1.3 Anti-Patterns | plugins/codexclaw/skills/dev-devops/references/container-build-rules.md#13-anti-patterns |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §2 Deploy Pipeline | plugins/codexclaw/skills/dev-devops/references/deployment-pipeline-rules.md#2-deploy-pipeline |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §2.1 Pipeline Stages (DEFAULT) | plugins/codexclaw/skills/dev-devops/references/deployment-pipeline-rules.md#21-pipeline-stages-default |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §2.2 GHA Reusable Workflows (DEFAULT) | plugins/codexclaw/skills/dev-devops/references/deployment-pipeline-rules.md#22-gha-reusable-workflows-default |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §2.3 Deploy Strategies (DEFAULT) | plugins/codexclaw/skills/dev-devops/references/deployment-pipeline-rules.md#23-deploy-strategies-default |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §2.4 Rollback Rules (STRICT) | plugins/codexclaw/skills/dev-devops/references/deployment-pipeline-rules.md#24-rollback-rules-strict |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §2.5 Secret Management (STRICT) | plugins/codexclaw/skills/dev-devops/references/deployment-pipeline-rules.md#25-secret-management-strict |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §2.6 GitOps (DEFAULT) | plugins/codexclaw/skills/dev-devops/references/deployment-pipeline-rules.md#26-gitops-default |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §2.8 Freeze & GO/NO-GO Gates (STRICT) | plugins/codexclaw/skills/dev-devops/references/release-readiness.md#28-freeze--gono-go-gates-strict |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §2.9 Branch Lifecycle Hygiene (STRICT) | plugins/codexclaw/skills/dev-devops/references/branch-hygiene-rules.md#29-branch-lifecycle-hygiene-strict |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §3 Kubernetes Basics | plugins/codexclaw/skills/dev-devops/references/kubernetes-basics.md#3-kubernetes-basics |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §3.1 Minimum Viable K8s (DEFAULT) | plugins/codexclaw/skills/dev-devops/references/kubernetes-basics.md#31-minimum-viable-k8s-default |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §3.2 Gateway API (v1.6+, verified 2026-07-02 — TCPRoute/UDPRoute GA in v1.6) | plugins/codexclaw/skills/dev-devops/references/kubernetes-basics.md#32-gateway-api-v16-verified-2026-07-02--tcprouteudproute-ga-in-v16 |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §3.3 Scaling (DEFAULT) | plugins/codexclaw/skills/dev-devops/references/kubernetes-basics.md#33-scaling-default |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §3.4 Anti-Patterns | plugins/codexclaw/skills/dev-devops/references/kubernetes-basics.md#34-anti-patterns |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §4 Infrastructure as Code | plugins/codexclaw/skills/dev-devops/references/infrastructure-code-rules.md#4-infrastructure-as-code |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §4.1 OpenTofu/Terraform Rules (DEFAULT) | plugins/codexclaw/skills/dev-devops/references/infrastructure-code-rules.md#41-opentofuterraform-rules-default |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §4.2 Tool Selection (HEURISTIC) | plugins/codexclaw/skills/dev-devops/references/infrastructure-code-rules.md#42-tool-selection-heuristic |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §4.3 Anti-Patterns | plugins/codexclaw/skills/dev-devops/references/infrastructure-code-rules.md#43-anti-patterns |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §5 SRE Foundations | plugins/codexclaw/skills/dev-devops/references/sre-basics.md#5-sre-foundations |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §5.1 SLO/SLI (DEFAULT) | plugins/codexclaw/skills/dev-devops/references/sre-basics.md#51-slosli-default |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §5.2 Error Budget Policy (DEFAULT) | plugins/codexclaw/skills/dev-devops/references/sre-basics.md#52-error-budget-policy-default |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §5.3 Incident Response (DEFAULT) | plugins/codexclaw/skills/dev-devops/references/sre-basics.md#53-incident-response-default |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §5.4 Runbook Template (HEURISTIC) | plugins/codexclaw/skills/dev-devops/references/sre-basics.md#54-runbook-template-heuristic |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §5.5 Anti-Patterns | plugins/codexclaw/skills/dev-devops/references/sre-basics.md#55-anti-patterns |
| plugins/codexclaw/skills/dev-devops/SKILL.md | §6 Cross-References | plugins/codexclaw/skills/dev-devops/references/delivery-boundaries.md#6-cross-references |
| plugins/codexclaw/skills/dev-devops/SKILL.md | Pre-flight Checklist | plugins/codexclaw/skills/dev-devops/references/infrastructure-preflight.md#pre-flight-checklist |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 1. Test Strategy | plugins/codexclaw/skills/dev-testing/references/test-strategy.md#1-test-strategy |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 1.1 Models | plugins/codexclaw/skills/dev-testing/references/test-strategy.md#11-models |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 1.2 Recommended Trophy Distribution | plugins/codexclaw/skills/dev-testing/references/test-strategy.md#12-recommended-trophy-distribution |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 1.5 General Rules | plugins/codexclaw/skills/dev-testing/references/test-strategy.md#15-general-rules |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 1.6 Property-Based & Mutation Testing (verified 2026-07-02) | plugins/codexclaw/skills/dev-testing/references/property-and-mutation-testing.md#16-property-based--mutation-testing-verified-2026-07-02 |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 2. Backend & API Testing | plugins/codexclaw/skills/dev-testing/references/api-test-patterns.md#2-backend--api-testing |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 2.1 Coverage Map | plugins/codexclaw/skills/dev-testing/references/api-test-patterns.md#21-coverage-map |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 2.2 Mock Strategy Hierarchy | plugins/codexclaw/skills/dev-testing/references/api-test-patterns.md#22-mock-strategy-hierarchy |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 2.3 Service & API Patterns | plugins/codexclaw/skills/dev-testing/references/api-test-patterns.md#23-service--api-patterns |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 2.4 Database Truth with Testcontainers | plugins/codexclaw/skills/dev-testing/references/api-test-patterns.md#24-database-truth-with-testcontainers |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 2.5 Fixture / Seed Synchronization | plugins/codexclaw/skills/dev-testing/references/api-test-patterns.md#25-fixture--seed-synchronization |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 3. Contract Testing | plugins/codexclaw/skills/dev-testing/references/api-test-patterns.md#3-contract-testing |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 3.1 Contract-Stable Surface | plugins/codexclaw/skills/dev-testing/references/api-test-patterns.md#31-contract-stable-surface |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 3.2 Contract Options | plugins/codexclaw/skills/dev-testing/references/api-test-patterns.md#32-contract-options |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 3.3 Consumer Contract — TypeScript (Pact / PactV4) | plugins/codexclaw/skills/dev-testing/references/api-test-patterns.md#33-consumer-contract--typescript-pact--pactv4 |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 3.4 Schema Verification | plugins/codexclaw/skills/dev-testing/references/api-test-patterns.md#34-schema-verification |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 3.5 Rules | plugins/codexclaw/skills/dev-testing/references/api-test-patterns.md#35-rules |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 4. Playwright Browser Testing | plugins/codexclaw/skills/dev-testing/references/browser-testing.md#4-playwright-browser-testing |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 4.1 Decision Tree: Choosing Your Approach | plugins/codexclaw/skills/dev-testing/references/browser-testing.md#41-decision-tree-choosing-your-approach |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 4.2 Example: Using with_server.py | plugins/codexclaw/skills/dev-testing/references/browser-testing.md#42-example-using-with_serverpy |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 4.3 Reconnaissance-Then-Action Pattern | plugins/codexclaw/skills/dev-testing/references/browser-testing.md#43-reconnaissance-then-action-pattern |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 4.4 Best Practices | plugins/codexclaw/skills/dev-testing/references/browser-testing.md#44-best-practices |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 4.5 Reference Files | plugins/codexclaw/skills/dev-testing/references/browser-testing.md#45-reference-files |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 4.6 Browser Testing Rules | plugins/codexclaw/skills/dev-testing/references/browser-testing.md#46-browser-testing-rules |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 4.7 Exploratory browser QA (TEST-CU-QA-01) | plugins/codexclaw/skills/dev-testing/references/browser-testing.md#47-exploratory-browser-qa-test-cu-qa-01 |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 5. CI Pipeline Integration | plugins/codexclaw/skills/dev-testing/references/ci-integration.md#5-ci-pipeline-integration |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 5.1 Pipeline Order | plugins/codexclaw/skills/dev-testing/references/ci-integration.md#51-pipeline-order |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 5.4 Flaky Test Remediation | plugins/codexclaw/skills/dev-testing/references/ci-integration.md#54-flaky-test-remediation |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 5.5 CI-Green Loop | plugins/codexclaw/skills/dev-testing/references/ci-integration.md#55-ci-green-loop |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 5.6 Rules | plugins/codexclaw/skills/dev-testing/references/ci-integration.md#56-rules |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 6. TDD Enforcement Mode | plugins/codexclaw/skills/dev-testing/references/tdd-and-regressions.md#6-tdd-enforcement-mode |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 6.1 RED → GREEN → REFACTOR | plugins/codexclaw/skills/dev-testing/references/tdd-and-regressions.md#61-red--green--refactor |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 6.2 Self-Audit Checklist | plugins/codexclaw/skills/dev-testing/references/tdd-and-regressions.md#62-self-audit-checklist |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 6.3 Vertical Tracer-Bullet TDD | plugins/codexclaw/skills/dev-testing/references/tdd-and-regressions.md#63-vertical-tracer-bullet-tdd |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 6.4 Default Style | plugins/codexclaw/skills/dev-testing/references/tdd-and-regressions.md#64-default-style |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 6.5 Boundary with dev-debugging | plugins/codexclaw/skills/dev-testing/references/tdd-and-regressions.md#65-boundary-with-dev-debugging |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 6.6 AI-Assisted Development Regressions | plugins/codexclaw/skills/dev-testing/references/tdd-and-regressions.md#66-ai-assisted-development-regressions |
| plugins/codexclaw/skills/dev-testing/SKILL.md | Common AI Regression Patterns | plugins/codexclaw/skills/dev-testing/references/tdd-and-regressions.md#common-ai-regression-patterns |
| plugins/codexclaw/skills/dev-testing/SKILL.md | Regression Naming Convention | plugins/codexclaw/skills/dev-testing/references/tdd-and-regressions.md#regression-naming-convention |
| plugins/codexclaw/skills/dev-testing/SKILL.md | Sandbox-Mode API Testing | plugins/codexclaw/skills/dev-testing/references/tdd-and-regressions.md#sandbox-mode-api-testing |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 6.7 Test-Induced Production Defense Detection | plugins/codexclaw/skills/dev-testing/references/tdd-and-regressions.md#67-test-induced-production-defense-detection |
| plugins/codexclaw/skills/dev-testing/SKILL.md | TDD Evidence Contract (TEST-TDD-EVIDENCE-01, DEFAULT) | plugins/codexclaw/skills/dev-testing/references/tdd-and-regressions.md#tdd-evidence-contract-test-tdd-evidence-01-default |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 7. Accessibility Testing | plugins/codexclaw/skills/dev-testing/references/acceptance-gates.md#7-accessibility-testing |
| plugins/codexclaw/skills/dev-testing/SKILL.md | Component, Page, and CI Gates | plugins/codexclaw/skills/dev-testing/references/acceptance-gates.md#component-page-and-ci-gates |
| plugins/codexclaw/skills/dev-testing/SKILL.md | Observability Verification | plugins/codexclaw/skills/dev-testing/references/acceptance-gates.md#observability-verification |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 8. Security Testing | plugins/codexclaw/skills/dev-testing/references/acceptance-gates.md#8-security-testing |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 9. Coverage & Quality Gates | plugins/codexclaw/skills/dev-testing/references/acceptance-gates.md#9-coverage--quality-gates |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 9.1 Suggested Thresholds | plugins/codexclaw/skills/dev-testing/references/acceptance-gates.md#91-suggested-thresholds |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 9.2 Outcome Metrics | plugins/codexclaw/skills/dev-testing/references/acceptance-gates.md#92-outcome-metrics |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 9.3 Coverage Workflow | plugins/codexclaw/skills/dev-testing/references/acceptance-gates.md#93-coverage-workflow |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 9.4 Quality Gate Checklist | plugins/codexclaw/skills/dev-testing/references/acceptance-gates.md#94-quality-gate-checklist |
| plugins/codexclaw/skills/dev-testing/SKILL.md | 10. Pre-Flight Test Checklist | plugins/codexclaw/skills/dev-testing/references/acceptance-gates.md#10-pre-flight-test-checklist |
| plugins/codexclaw/skills/dev-testing/SKILL.md | Acceptance-Row Reachability (TEST-ROW-REACHABLE-01, DEFAULT) | plugins/codexclaw/skills/dev-testing/references/acceptance-row-reachability.md#acceptance-row-reachability-test-row-reachable-01-default |
| plugins/codexclaw/skills/dev-testing/SKILL.md | Test Oracle Integrity (TEST-PROMPT-SEAM-01 / TEST-ORACLE-INDEPENDENCE-01 / TEST-PRECEDENCE-FIXTURE-01, DEFAULT) | plugins/codexclaw/skills/dev-testing/references/test-oracle-integrity.md#test-oracle-integrity-test-prompt-seam-01--test-oracle-independence-01--test-precedence-fixture-01-default |
| plugins/codexclaw/skills/dev-testing/SKILL.md | Patch Integrity Gate (TEST-PATCH-INTEGRITY-01, DEFAULT) | plugins/codexclaw/skills/dev-testing/references/patch-integrity.md#patch-integrity-gate-test-patch-integrity-01-default |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | 1. Code Review Process | plugins/codexclaw/skills/dev-code-reviewer/references/review-process.md#1-code-review-process |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Automated Pre-Scan | plugins/codexclaw/skills/dev-code-reviewer/references/review-process.md#automated-pre-scan |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Review Order (by impact, not preference) | plugins/codexclaw/skills/dev-code-reviewer/references/review-process.md#review-order-by-impact-not-preference |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Review Mindset | plugins/codexclaw/skills/dev-code-reviewer/references/review-process.md#review-mindset |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Pre-Review Checklist | plugins/codexclaw/skills/dev-code-reviewer/references/review-process.md#pre-review-checklist |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | File Size Guidance | plugins/codexclaw/skills/dev-code-reviewer/references/quality-thresholds.md#file-size-guidance |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Structural | plugins/codexclaw/skills/dev-code-reviewer/references/common-antipatterns.md#structural |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Dead Code | plugins/codexclaw/skills/dev-code-reviewer/references/common-antipatterns.md#dead-code |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Logic | plugins/codexclaw/skills/dev-code-reviewer/references/common-antipatterns.md#logic |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Security | plugins/codexclaw/skills/dev-code-reviewer/references/common-antipatterns.md#security |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | 3.5 Security Review Quick-Check | plugins/codexclaw/skills/dev-code-reviewer/references/security-performance-review.md#35-security-review-quick-check |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Must-Check Every PR | plugins/codexclaw/skills/dev-code-reviewer/references/security-performance-review.md#must-check-every-pr |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Conditional Checks | plugins/codexclaw/skills/dev-code-reviewer/references/security-performance-review.md#conditional-checks |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | 3.6 Performance Review Quick-Check | plugins/codexclaw/skills/dev-code-reviewer/references/security-performance-review.md#36-performance-review-quick-check |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Database & API | plugins/codexclaw/skills/dev-code-reviewer/references/security-performance-review.md#database--api |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Frontend-Specific | plugins/codexclaw/skills/dev-code-reviewer/references/security-performance-review.md#frontend-specific |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | General | plugins/codexclaw/skills/dev-code-reviewer/references/security-performance-review.md#general |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | 4. Receiving Code Review | plugins/codexclaw/skills/dev-code-reviewer/references/review-feedback.md#4-receiving-code-review |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | 5. Requesting Code Review | plugins/codexclaw/skills/dev-code-reviewer/references/review-feedback.md#5-requesting-code-review |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Reviewing AI-Generated Code | plugins/codexclaw/skills/dev-code-reviewer/references/review-feedback.md#reviewing-ai-generated-code |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | 6. Subagent Review Mode | plugins/codexclaw/skills/dev-code-reviewer/references/subagent-and-slop-review.md#6-subagent-review-mode |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | AI Tool Integration Awareness | plugins/codexclaw/skills/dev-code-reviewer/references/subagent-and-slop-review.md#ai-tool-integration-awareness |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | AI Slop Cleanup Checklist (REVIEW-SLOP-01) | plugins/codexclaw/skills/dev-code-reviewer/references/subagent-and-slop-review.md#ai-slop-cleanup-checklist-review-slop-01 |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Changed-File Coverage Ledger (REVIEW-COVERAGE-01, DEFAULT) | plugins/codexclaw/skills/dev-code-reviewer/references/finding-verification.md#changed-file-coverage-ledger-review-coverage-01-default |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Finding Falsification (REVIEW-FALSIFY-01, DEFAULT) | plugins/codexclaw/skills/dev-code-reviewer/references/finding-verification.md#finding-falsification-review-falsify-01-default |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Interdiff Re-Review (REVIEW-INTERDIFF-01, DEFAULT) | plugins/codexclaw/skills/dev-code-reviewer/references/finding-verification.md#interdiff-re-review-review-interdiff-01-default |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | External/current review evidence | plugins/codexclaw/skills/dev-code-reviewer/references/external-review-evidence.md#externalcurrent-review-evidence |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 1. Structural Standard | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#1-structural-standard |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 2.2 Project Skeleton | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#22-project-skeleton |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 3. Language Detection | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#3-language-detection |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 3.1 Tech Stack Decision (New Projects) | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#31-tech-stack-decision-new-projects |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 4. Fullstack Split Rule | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#4-fullstack-split-rule |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 5. Feature Module Rules | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#5-feature-module-rules |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 6. Naming Conventions | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#6-naming-conventions |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 7. File Suffixes | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#7-file-suffixes |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 9. Split Rules | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#9-split-rules |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 10. Cross-Cutting Scaffolding | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#10-cross-cutting-scaffolding |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | Health Endpoints | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#health-endpoints |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | SEO Boilerplate (Web Projects) | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#seo-boilerplate-web-projects |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | CI Template | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#ci-template |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | Security Boilerplate | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-layout.md#security-boilerplate |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 2. Existing Repo First | plugins/codexclaw/skills/dev-scaffolding/references/source-of-truth-layout.md#2-existing-repo-first |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | Codexclaw-First Durable Docs | plugins/codexclaw/skills/dev-scaffolding/references/source-of-truth-layout.md#codexclaw-first-durable-docs |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 2.1 Lightweight Source of Truth (implementation-unit devlog) | plugins/codexclaw/skills/dev-scaffolding/references/source-of-truth-layout.md#21-lightweight-source-of-truth-implementation-unit-devlog |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 8. Function-Structure Docs | plugins/codexclaw/skills/dev-scaffolding/references/source-of-truth-layout.md#8-function-structure-docs |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 11. Documentation Generation | plugins/codexclaw/skills/dev-scaffolding/references/source-of-truth-layout.md#11-documentation-generation |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | README Generation | plugins/codexclaw/skills/dev-scaffolding/references/source-of-truth-layout.md#readme-generation |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | API Documentation | plugins/codexclaw/skills/dev-scaffolding/references/source-of-truth-layout.md#api-documentation |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | Structure Documentation | plugins/codexclaw/skills/dev-scaffolding/references/source-of-truth-layout.md#structure-documentation |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | Planning Documentation | plugins/codexclaw/skills/dev-scaffolding/references/source-of-truth-layout.md#planning-documentation |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | 12. Audit | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-verification.md#12-audit |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | Scaffold Contract (SCAFFOLD-CONTRACT-01, DEFAULT) | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-verification.md#scaffold-contract-scaffold-contract-01-default |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | Post-Scaffold Verification (SCAFFOLD-VERIFY-01, DEFAULT) | plugins/codexclaw/skills/dev-scaffolding/references/scaffold-verification.md#post-scaffold-verification-scaffold-verify-01-default |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | External/current scaffolding evidence | plugins/codexclaw/skills/dev-scaffolding/references/external-scaffolding-evidence.md#externalcurrent-scaffolding-evidence |
| plugins/codexclaw/skills/dev-testing/references/ci-pipeline.md | DEVOPS-BASELINE-DEFECT-01 test-side mirror | pointer to plugins/codexclaw/skills/dev-devops/references/ci-cd-deploy.md#62-baseline-versus-defect-devops-baseline-defect-01-strict (owner verified); TEST-FLAKE-ATTRIBUTION-01 CI-access caveat retained |
| plugins/codexclaw/skills/dev-scaffolding/SKILL.md | SOT-SYNC-01 definition | pointer to plugins/codexclaw/skills/pabcd/references/phase-check.md#check-phase (owner verified); before-patch reading and scaffolding proposal guidance retained in source-of-truth-layout.md |
| plugins/codexclaw/skills/dev-devops/SKILL.md | Sources: the OpenCodex v2.32.1 hotfix train and the operator-visibility train | history → devlog/_plan/261009_prompt_reduction/evidence/r2-moved-history.md |
| plugins/codexclaw/skills/dev-devops/SKILL.md | Per-rule sources: FREEZE-SHA `900`:3-7; GATE-WEAKEN `900`:47-49; REVIEW-THREADS | history → devlog/_plan/261009_prompt_reduction/evidence/r2-moved-history.md |
| plugins/codexclaw/skills/dev-devops/SKILL.md | **Why the merged/closed distinction is load-bearing.** `delete_branch_on_merge` | history → devlog/_plan/261009_prompt_reduction/evidence/r2-moved-history.md |
| plugins/codexclaw/skills/dev-testing/SKILL.md | **The two known violations were deleted, not repaired (260726).** | history → devlog/_plan/261009_prompt_reduction/evidence/r2-moved-history.md |
| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | There is no automated check, and there cannot be a useful one: codexclaw owns no registry | history → devlog/_plan/261009_prompt_reduction/evidence/r2-moved-history.md |

| plugins/codexclaw/skills/dev-debugging/SKILL.md | When to Activate | plugins/codexclaw/skills/dev-debugging/references/debugging-pitfalls.md#when-to-activate |

| plugins/codexclaw/skills/dev-devops/SKILL.md | Reference-reading order (unheaded) | plugins/codexclaw/skills/dev-devops/references/delivery-boundaries.md#reference-reading-order |
| plugins/codexclaw/skills/dev-testing/SKILL.md | Limited-Oracle / Score-Objective Evaluation | pointer to plugins/codexclaw/skills/dev-testing/references/limited-oracle-evaluation.md (same router condition retained) |

| plugins/codexclaw/skills/dev-debugging/SKILL.md | External-proof paragraph in Phase 2 (unheaded) | pointer to plugins/codexclaw/skills/dev/SKILL.md#conditional-routes (owner verified) |
| plugins/codexclaw/skills/dev-devops/SKILL.md | External/current proof paragraph (unheaded) | pointer to plugins/codexclaw/skills/dev/SKILL.md#conditional-routes (owner verified) |
| plugins/codexclaw/skills/dev-testing/SKILL.md | External/current proof paragraph (unheaded) | pointer to plugins/codexclaw/skills/dev/SKILL.md#conditional-routes (owner verified) |
| plugins/codexclaw/skills/dev-devops/SKILL.md | Stacked-PR CI preflight (unheaded) | pointer to plugins/codexclaw/skills/dev/references/stacked-prs.md (dev owner route verified) |

| plugins/codexclaw/skills/dev-debugging/SKILL.md | Routing role introduction (unheaded) | plugins/codexclaw/skills/dev-debugging/references/skill-boundaries.md#routing-role |

| plugins/codexclaw/skills/dev-devops/SKILL.md | Routing role introduction (unheaded) | plugins/codexclaw/skills/dev-devops/references/delivery-boundaries.md#routing-role |

| plugins/codexclaw/skills/dev-code-reviewer/SKILL.md | Routing role introduction (unheaded) | plugins/codexclaw/skills/dev-code-reviewer/references/review-process.md#routing-role |

## Relocation checks

- Cross-skill flake and CI-stage pointers resolve to testing’s actual reference files; SBOM handoff resolves to security’s actual owner.
- RCA hypothesis and implementation entry gates remain verbatim in the debugging router; phase reference points back, so each ID has one owner.
- Frontmatter compared byte-for-byte against the pre-edit read; SHA-256 values above.
- Every newly moved file compared to its source chunks with only path relocation, explicitly verified owner pointers, and listed history extraction.
- External-review and external-scaffolding browser/query detail stays verbatim in local references because dev does not contain that exact downstream/query rule.
- SOT-SYNC-01 stays canonical in PABCD; scaffolding retains explicit before-patch SoT reads and convention/proposal guidance.
- DEVOPS-BASELINE-DEFECT-01 stays canonical in DevOps; testing retains its DEFAULT attribution class and CI-access caveat.
- Baseline is parent-owned; new sizes and retired duplicate entries need parent baseline edits.

## Test results

- `node --test plugins/codexclaw/test/manifest-policy.test.mjs plugins/codexclaw/test/skill-catalog.test.mjs plugins/codexclaw/test/port-provenance.test.mjs`: exit 0; 16 tests passed, 0 failed/cancelled/skipped. Final run duration: 41.372166 ms.
- `node plugins/codexclaw/scripts/check-prompt-architecture.mjs`: exit 1 with 21 expected stale baseline findings across concurrent lanes; no link or new-ID violation. The r2 findings are the five reduced router sizes plus obsolete `SOT-SYNC-01` and `DEVOPS-BASELINE-DEFECT-01` legacy duplicate records.
- Read-only invocation of exported `checkPromptArchitecture`, with only stale below-budget router and now-single-owner ID entries removed **in memory**: PASS; baseline file untouched. This is supplemental proof, not a claim that the raw gate passed.
- Removed-heading survival check against `git show HEAD:<router>`: every removed heading has a ledger row. Ledger destination paths/fragments resolve.
- `rg` pins: native-desktop-acceptance and macos-system-approvals still routed by DevOps; native desktop suites still routed by testing; Swift runtime still routed by debugging. RCA entry gates, release proof, harness selector, and review output/blocker contracts remain in routers.
- Final frontmatter SHA-256 values match the initial lane read; all whole files <=10,240 B.
- `git diff --check -- <five owned skill directories> <two r2 evidence files>`: exit 0, no whitespace errors.

## Parent handoff / limitations

- Remove the five r2 router baseline records using the final sizes above. Remove legacy duplicate records for `SOT-SYNC-01` and `DEVOPS-BASELINE-DEFECT-01`; each now has one gate-recognized owner.
- Research body targets were aspirational: debugging 4,760 B, DevOps 4,065 B, testing 3,827 B, review 4,605 B, scaffolding 1,606 B. All hard whole-file limits pass. The higher bodies retain direct runtime selectors, RCA entry conditions, and output/verdict contracts.
- The gate does not recognize the existing `**STRICT (DEBUG-...):**` declaration form. Supplemental exact-declaration scanning confirms each RCA ID appears in exactly one declaration file, the debugging router. No declaration syntax was rewritten.
- No builds, product runtime checks, broad suite, git writes, spawned workers, or orchestration/goal commands ran. Parent owns baseline integration and independent semantic review.
