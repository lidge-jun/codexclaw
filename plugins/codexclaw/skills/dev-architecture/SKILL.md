---
name: cxc-dev-architecture
description: "Use for module boundaries and dependencies. Triggers: circular import, coupling, barrel, re-export, validation placement, 모듈 경계, 순환 참조."
metadata:
  last-verified: "2026-07-02"
  short-description: "Module boundaries, circular deps, coupling taxonomy, and boundary-only defensive programming."
---

# Dev-Architecture — Module Boundaries & Structural Integrity

Enforces architectural rules that prevent structural decay: circular dependencies, implicit coupling, barrel abuse, and misplaced validation. These rules are mechanical — an AI coding agent can follow them without subjective judgment.

Before architecture work, read [dev](../dev/SKILL.md) for classification, fast paths, rule authority, family invariants, verification, and safety; current/public evidence follows its [Conditional Routes](../dev/SKILL.md#conditional-routes).

Use browser verification only after candidate URLs exist.

## Modular References

| Condition | Reference |
|---|---|
| Change boundaries, seams, layers, shared packages, or public exports above C0/C1; choose module owners/depth | [Module boundaries](references/01-module-boundaries.md) (ARCH-DECISION-01, ARCH-MAP-01) |
| Detect/fix import cycles or classify coupling | [Import structure](references/02-import-structure.md), [cycle commands](references/circular-dependencies.md), [coupling examples](references/coupling-taxonomy.md) |
| Create/modify index or re-export files | [Barrel policy](references/02-import-structure.md#5-barrelre-export-discipline), [barrel examples](references/barrel-discipline.md) |
| Place shape parsing, domain invariants, or security checks | [Validation matrices and exceptions](references/03-boundary-validation.md) |
| Review structural changes, add CI conformance, query structural indexes, or use decision trees | [Architecture review](references/04-architecture-review.md) |
| Durable architecture documentation | `cxc-dev-scaffolding` |
| Security policy/auth, observability, review, RCA, or infrastructure boundaries | [Cross-skill owners](references/04-architecture-review.md#cross-skill-references) |

## 4. Boundary-Only Defensive Programming

**Severity: CRITICAL**
**Rule:** Parse untrusted data at trust boundaries and avoid repeating shape validation
inside one trusted typed boundary. Domain invariants (valid ranges, state transitions,
relational constraints) belong to the domain owner even for in-process callers.
Authorization and assertions for genuinely reachable invalid states remain allowed.

Ownership: this section distinguishes ingress shape parsing, domain invariants and
reachable-state assertions. `dev-security` owns security validation and authorization
policy; placement must not erase a business invariant or required defense-in-depth.
