# Infrastructure as Code — OpenTofu, Terraform, Pulumi

Last reviewed: 2026-06-16
Applies to: OpenTofu 1.9+, Terraform 1.10+, Pulumi 3.x
When to read: Infrastructure provisioning tasks
Canonical owner: dev-devops §4

Cross-ref: read `platform-engineering.md` for provider-routing breadth,
platform guardrails, and DORA capability framing before broad IaC refreshes.

---

## §1 OpenTofu/Terraform Patterns

### Directory Structure

```
infra/
  modules/
    vpc/
      main.tf
      variables.tf
      outputs.tf
      README.md
    iam/
    ecs-service/
    rds/
  environments/
    dev/
      main.tf
      terraform.tfvars
      backend.tf
    staging/
      main.tf
      terraform.tfvars
      backend.tf
    prod/
      main.tf
      terraform.tfvars
      backend.tf
```

### State Management

| Rule | Detail |
|------|--------|
| Remote backend | S3+DynamoDB, Terraform Cloud, or OpenTofu native |
| State isolation | Separate state per app/layer/env |
| Locking | DynamoDB or backend-native lock |
| No local state | Ever. `terraform.tfstate` in `.gitignore` |

### OpenTofu State Encryption

```hcl
terraform {
  encryption {
    method "aes_gcm" "default" {
      keys = key_provider.aws_kms.default
    }
    state {
      method = method.aes_gcm.default
    }
    plan {
      method = method.aes_gcm.default
    }
  }

  backend "s3" {
    bucket         = "myorg-tf-state"
    key            = "payments/prod/terraform.tfstate"
    region         = "ap-northeast-2"
    dynamodb_table = "tf-lock"
    encrypt        = true
  }
}
```

### Blast Radius Isolation

```
State boundaries (independent apply):
├── network/     (VPC, subnets, NAT)
├── iam/         (roles, policies)
├── data/        (RDS, ElastiCache)
├── compute/     (ECS, EKS, Lambda)
└── monitoring/  (CloudWatch, alarms)
```

Each boundary has its own state file. Network changes can't accidentally destroy compute.

---

## §2 Module Design

### Good Module Boundaries

| Module | Inputs | Outputs |
|--------|--------|---------|
| `vpc` | CIDR, AZ count, tags | vpc_id, subnet_ids, nat_gateway_ids |
| `iam-role` | role_name, policy_arns, trust_policy | role_arn, instance_profile_arn |
| `ecs-service` | image, cpu, memory, vpc_id, subnet_ids | service_arn, task_def_arn, lb_dns |
| `rds` | engine, instance_class, vpc_id, subnet_ids | endpoint, port, secret_arn |

### Variable Validation

```hcl
variable "instance_type" {
  type        = string
  description = "EC2 instance type — only t3/t4g allowed for cost control"
  validation {
    condition     = can(regex("^(t3|t4g)\\.", var.instance_type))
    error_message = "Only t3.* or t4g.* instances are allowed."
  }
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}
```

### Module Interface Rules

- Typed inputs with `description` and `validation`
- Stable outputs — never expose internal resource IDs that may change
- No implementation leakage — consumers don't see internal resources
- README with usage example required
- Composition over monolith: combine small modules, don't build one giant module

---

## §3 CI/CD for IaC

### PR Pipeline

```yaml
name: Terraform Plan
on:
  pull_request:
    paths: ["infra/**"]

jobs:
  plan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: opentofu/setup-opentofu@v1
      - run: tofu init
        working-directory: infra/environments/${{ matrix.env }}
      - run: tofu plan -out=tfplan -no-color
        working-directory: infra/environments/${{ matrix.env }}
      - run: tofu show -json tfplan > plan.json
        working-directory: infra/environments/${{ matrix.env }}
      # Post plan summary as PR comment
      - uses: borchero/terraform-plan-comment@v2
        with:
          plan-file: infra/environments/${{ matrix.env }}/plan.json
    strategy:
      matrix:
        env: [dev, staging, prod]
```

### Apply Rules

| Environment | Apply | Approval |
|-------------|-------|----------|
| dev | Auto on merge | None |
| staging | Auto on merge | None |
| prod | Manual trigger | Required reviewers |

### Drift Detection

```yaml
# Scheduled — run weekly
on:
  schedule:
    - cron: "0 6 * * 1"  # Monday 6am

jobs:
  drift:
    steps:
      - run: tofu plan -detailed-exitcode
      # Exit code 2 = changes detected → notify
```

---

## §4 Pulumi Patterns

### Stack Structure

```
infra/
  Pulumi.yaml
  Pulumi.dev.yaml
  Pulumi.staging.yaml
  Pulumi.prod.yaml
  index.ts
```

### TypeScript Example

```typescript
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const env = pulumi.getStack();

const vpc = new aws.ec2.Vpc("main", {
  cidrBlock: config.require("vpcCidr"),
  tags: { Name: `${env}-vpc`, Environment: env },
});

export const vpcId = vpc.id;
```

### Pulumi vs OpenTofu Decision

| Factor | OpenTofu | Pulumi |
|--------|----------|--------|
| Language | HCL (declarative) | TS, Python, Go, C# |
| State | S3/Cloud/native encrypted | Pulumi Cloud or self-managed |
| Ecosystem | Massive provider ecosystem | Growing; wraps Terraform providers |
| Learning curve | Lower for ops | Lower for developers |
| Testing | `terraform test` (limited) | Standard test frameworks |

---

## §5 Tool Selection Decision Tree

```
Infrastructure provisioning needed?
├── Multi-cloud or hybrid?
│   ├── Yes → OpenTofu (HCL) or Pulumi (TS/Python)
│   └── No, AWS only
│       ├── Team prefers programming languages? → AWS CDK or Pulumi
│       └── Team prefers declarative? → OpenTofu
│
├── Existing Terraform codebase?
│   └── Yes → Continue Terraform or migrate to OpenTofu (drop-in compatible)
│
└── Starting fresh?
    └── OpenTofu recommended (open governance, state encryption, Terraform-compatible)

⚠️ CDKTF is deprecated (2025-12, HashiCorp) — do NOT adopt for new projects.
```

---

## §6 Anti-Patterns (Detailed)

| Banned | Why | Fix |
|--------|-----|-----|
| Local state file | Lost on disk crash; no locking; no team sharing | Remote backend with locking |
| Manual console changes | Drift; no audit trail; breaks next `apply` | All changes via code |
| Hardcoded values | Can't reuse; env-specific secrets leak | `variable` + `terraform.tfvars` |
| Monolithic main.tf | 1000+ line file; blast radius = everything | Modular decomposition |
| CDKTF (new projects) | Deprecated by HashiCorp | OpenTofu or Pulumi |
| Unpinned versions | Provider update breaks infra silently | `required_providers` with `~>` |
| `terraform apply -auto-approve` in prod | No human review | Manual approval gate |
