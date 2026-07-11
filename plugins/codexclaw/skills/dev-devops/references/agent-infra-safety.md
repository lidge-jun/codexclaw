# Agent Infrastructure Safety (DEVOPS-AGENT-SAFETY-01, DEFAULT)

Source: sol research (microsoft/skills governance, cloudflare/skills sandbox, google/skills).

## Execution Model
- Default mode: PLAN-ONLY. The agent generates the plan; a human approves execution.
- Write mode: explicitly granted per task. Scoped to declared resources only.
- Destructive actions (delete, scale-to-zero, revoke, drop): require explicit confirmation even in write mode.

## Credential Separation
- Read credentials: service account with read-only IAM bindings
- Write credentials: separate service account with scoped write permissions
- Never share a single credential across read and write operations
- Prefer workload identity / OIDC over long-lived secrets

## Command Allowlist
- Agents should operate through declarative tools (Terraform plan, kubectl diff, helm template)
- Direct imperative commands (kubectl delete, aws ec2 terminate) require explicit approval
- Shell pipes and command chaining are suspicious in infrastructure context

## Audit Correlation
- Every infrastructure action is tagged with: agent session ID, task ID, operator identity
- Actions without correlation tags are audit failures
- Retain action logs for the organization's compliance window

## Sandbox and Egress
- Infrastructure agents run with network egress restricted to declared endpoints
- Cloud API endpoints are allowed; arbitrary internet access is not
- File system access limited to the working directory and declared output paths

## Approval Classes
| Action class | Approval required |
|-------------|-------------------|
| Read/inspect/plan | None (read credentials sufficient) |
| Create/update (non-destructive) | Task-level write grant |
| Delete/revoke/scale-down | Explicit per-resource confirmation |
| Cross-account/cross-region | Elevated approval + blast-radius statement |
| Production environment | Always requires human confirmation |
