---
name: cxc-dev-security
description: "Use for security and trust boundaries. Triggers: auth, secrets, XSS, CSRF, SQL injection, JWT, OAuth, OWASP, PII, uploads, payments, supply chain, CI integrity, agent security, threat model."
metadata:
  last-verified: "2026-07-02"
  short-description: "Security router for auth, validation, secrets, supply chain, and hardening."
  keywords:
    - xss
    - csrf
    - sql injection
    - jwt
    - oauth
    - secrets
    - owasp
    - auth hardening
    - supply chain
    - threat model
  injection_condition: "security-sensitive code, trust boundary changes, PII/payment/upload/CI integrity changes, tool-using agents, or security/threat_model task_tags"
---

# Dev-Security — Production Security Hardening

Treat security as a build constraint, not a cleanup step.
This skill is the authoritative source for authentication, authorization, input validation, secrets, headers, rate limiting, supply-chain security policy and evidence requirements, PII handling, and agentic AI safety.
Validation ownership split: this skill owns **what the validation schema enforces** (content/policy); **placement** (boundary-only validation) is owned by `dev-architecture` §4.
`dev-backend` delegates here for policy and verification depth.
`dev-frontend` remains responsible for UI implementation, but frontend security touchpoints such as CSP compliance, CORS behavior, XSS prevention, and dependency auditing are defined here.
This skill activates by change-surface whenever code crosses a trust boundary or changes the blast radius of a failure.

Before security work, read [dev](../dev/SKILL.md) for classification, fast paths, rule authority, family invariants, verification, and safety; current CVEs/public evidence follow its [Conditional Routes](../dev/SKILL.md#conditional-routes).

## Threat Model First

**Rule (SEC-THREAT-01):** Security-sensitive changes start with a repo-grounded threat model, then controls. Do not begin with a checklist and assume it is sufficient.

Before implementation, read the [threat-model procedure](references/01-threat-model.md); before completion, read the applicable [security review and must-pass addenda](references/05-security-review.md).

## Modular References

| Condition | Reference |
|---|---|
| Before security-sensitive implementation | [Threat model](references/01-threat-model.md) |
| Input validation, login/session/token/OAuth, authorization, or sensitive flows | [Access controls](references/02-access-controls.md) |
| Secrets, headers/CSP/CORS, or abuse/rate limits | [Runtime controls](references/03-runtime-controls.md) |
| AI-suggested dependencies, security claims/static checks, agent configuration, MCP, or sandboxing | [Agent integrity and scans](references/04-agent-integrity.md) (SEC-ANTIPATTERN-01) |
| Security-sensitive completion, deploy/release, uploads/payments/logging/PII, or control ownership | [Security review and ownership matrix](references/05-security-review.md), [ASVS checklist](references/asvs-checklist.md) |
| Any security-sensitive code | [OWASP Top 10](references/owasp-top10.md) |
| JS/TS, Python, SQL, or Go security work | [Language quirks](references/language-quirks.md) |
| Before claiming code is secure | [Static analysis recipes](references/static-analysis.md) |
| Tool-using agents or prompt-driven flows | [Agentic AI](references/agentic-ai-security.md) |
| LLMs, RAG, or tool/agent output | [LLM supply chain](references/llm-supply-chain.md) |
| Add/vet MCP servers | [MCP supply chain](references/mcp-supply-chain.md) |
| Dependency audit or release integrity | [SBOM and signing](references/supply-chain-sbom.md) |
| Domain implementation, CI credential delivery/signing, frontend, testing, review, RCA, scaffolding, or pipelines | [Companion owners](references/05-security-review.md#10-security-ownership-matrix); load the domain skill too |

Read only the references relevant to the current task.
A small CSS change needs no OWASP reference.
Auth, data access, secrets, file uploads, webhooks, or incident response changes do.
