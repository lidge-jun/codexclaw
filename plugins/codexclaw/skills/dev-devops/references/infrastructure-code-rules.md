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
