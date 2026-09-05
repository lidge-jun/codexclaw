# wp2 C consumer closure

Russell found non-blocking residuals in architecture private/in-process rows, API envelope reference, and compact debugging summary. All are accepted and corrected below. Main additionally preserves existing assurance targets and corrects the ASVS reference table to avoid accidental security-policy weakening.

## MODIFY plugins/codexclaw/skills/dev-architecture/SKILL.md

Before:

`````text
| **Private method args** | **NO** | Same module, same author | Redundant — types suffice |
`````

After:

`````text
| **Private method args** | No repeated shape parsing; invariants may apply | Types do not prove every valid state | Enforce the private method's real domain constraints |
`````

## MODIFY plugins/codexclaw/skills/dev-architecture/SKILL.md

Before:

`````text
| **Service-to-service in same process** | **NO** | In-process calls share type system | Interface contracts handle this |
`````

After:

`````text
| **Service-to-service in same process** | No repeated trusted shape parsing; enforce domain/security rules | In-process is not a waiver for invariants or authorization | Validate the actual boundary/constraint |
`````

## MODIFY plugins/codexclaw/skills/dev-backend/references/core/api-design.md

Before:

`````text
Every endpoint MUST use the same envelope:
`````

After:

`````text
For APIs that choose a shared envelope, use it consistently within that contract.
Preserve existing contracts and protocol-native GraphQL/gRPC/SSE responses; do not
wrap them in this REST sample. Responses such as HTTP 204 have no JSON body.
`````

## MODIFY plugins/codexclaw/skills/dev-debugging/SKILL.md

Before:

`````text
(2) Core principle — no fixes without root cause,
`````

After:

`````text
(2) Core principle — RCA before permanent repair; preauthorized reversible incident mitigation may come first,
`````

## MODIFY plugins/codexclaw/skills/dev-security/SKILL.md

Before:

`````text
| `references/asvs-checklist.md` | Before deploy or release | ASVS 5.0.0 pre-deploy checklist by chapter (V-shortcodes) and requirement level L1/L2 |
`````

After:

`````text
| `references/asvs-checklist.md` | Before deploy or release | Local release checklist; formal ASVS 5.0.0 assessment requires full applicable requirement-level evidence |
`````

## MODIFY plugins/codexclaw/skills/dev-security/references/asvs-checklist.md

Before:

`````text
mapping. Select the required assurance level from the product's threat model.
Passing these summaries alone does not establish ASVS compliance.
`````

After:

`````text
mapping. Keep existing assurance requirements: the local baseline target is L1 for
ordinary authenticated apps and L2 for admin, multi-tenant, PII, payments, uploads,
and elevated internal tools. The threat model may require more; lowering an existing
target requires a separately approved policy, not this documentation rewrite.
Passing these summaries alone does not establish ASVS compliance.
`````
