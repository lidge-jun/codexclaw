### §2.8 Freeze & GO/NO-GO Gates (STRICT)

`DEVOPS-RELEASE-PROOF-01` governs the proof bundle for an artifact you already
published. This section governs the decision to publish at all — the readiness
report, and the gates it claims to have passed.

| Rule | Severity | Statement |
|------|----------|-----------|
| `DEVOPS-FREEZE-SHA-01` | STRICT | Pin the readiness report to the code SHA its gates describe. If the head moved after the freeze, prove the delta is docs-only (`git diff --name-only <freeze> <head>`) and keep every gate receipt on the freeze SHA. |
| `DEVOPS-GATE-WEAKEN-01` | STRICT | A red named gate is never excused inside the report that gate failed. Make the original command green, or replace it with a pre-declared equivalent CI actually runs — and declare the swap **before** the verdict, not after the failure. |
| `DEVOPS-REVIEW-THREADS-01` | STRICT | Unresolved review threads on merged PRs are a GO blocker. Count them **after** merge: a thread opened minutes before merge still counts until it is fixed or explicitly dismissed. |
| `DEVOPS-GATE-OWNER-01` | STRICT | A mandatory GO gate needs an implementing work-phase and a recorded terminal outcome — pass, not-reproduced, or explicitly deregistered. A gate nobody implements is not a gate; it is a wish. |

Operational mechanics — suite partitioning, baseline-versus-defect attribution,
instrument stability, and exact-head evidence — live in
`ci-cd-deploy.md` §6. Runtime and operator-signal evidence rules live
in `sre-foundations.md` §7.
