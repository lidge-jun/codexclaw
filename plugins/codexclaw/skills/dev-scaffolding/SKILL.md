---
name: cxc-dev-scaffolding
description: "Use for project/module setup and docs. Triggers: scaffold, structure audit, architecture docs, API docs, monorepo setup, 스캐폴딩, 새 프로젝트, 새 기능, 구조 점검, 모듈 추가."
metadata:
  last-verified: "2026-07-02"
  short-description: "Project and module scaffolding with repo-first convention reuse and structural audits."
---
# Dev Scaffolding

Rules for generating and auditing project structures. Create files directly following these rules.
This skill activates by **change-surface**: new project setup, feature/module scaffolding,
structural audits, or documentation scaffolding.

Class, fast path, rule authority, proof, and safety: [dev](../dev/SKILL.md). Current/public evidence: [dev routing](../dev/SKILL.md#conditional-routes).

Use the [audit](references/scaffold-verification.md#12-audit) for verification when it applies.

MUST preserve mature repo conventions over the default scaffold pattern.

## Modular References

| Condition | Reference |
|---|---|
| New project/module, layout/language choice, naming/suffixes, or cross-cutting skeleton | [scaffold-layout.md](references/scaffold-layout.md) |
| Existing repo, durable docs, source-of-truth proposal, or documentation generation | [source-of-truth-layout.md](references/source-of-truth-layout.md) |
| C2+/multi-phase/cross-session units | [implementation-log.md](references/implementation-log.md) |
| Architecture/contracts/structure changed: SoT synchronization | [Check phase](../pabcd/references/phase-check.md#check-phase) (SOT-SYNC-01) |
| API docs | [api-docs.md](references/api-docs.md) |
| Monorepo setup/build optimization | [monorepo-tooling.md](references/monorepo-tooling.md) |
| Scaffold manifest, determinism, audit, or usability verification | [scaffold-verification.md](references/scaffold-verification.md) |
| Current generator/template/version/bootstrap proof | [external-scaffolding-evidence.md](references/external-scaffolding-evidence.md) |
