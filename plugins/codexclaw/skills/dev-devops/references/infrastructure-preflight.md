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
