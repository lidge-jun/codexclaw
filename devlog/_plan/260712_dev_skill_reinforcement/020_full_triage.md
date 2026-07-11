---
created: 2026-07-12
tags: [codexclaw, dev-skills, triage, 96-gaps]
---

# Full Triage — 12 Dev-Skill Audit (96 Gaps)

9 sol explorers: Pasteur (frontend bloat), Beauvoir (uiux bloat), Harvey (backend),
Cicero (testing), Hegel (debugging), Popper (architecture+scaffolding), Ohm (security),
Faraday (devops), Euler (code-reviewer+data+diagram).

## WP1: Bloat Audit (dev-frontend + dev-uiux-design)

### dev-frontend (Pasteur): 19 IDs, ~55-65% signal
- No logical contradictions between FE-* rules
- 5 condensed restatements should become route stubs (GRADIENT-01, ONENOTE-01, METACOPY-01, BENTO-01, HERO-SPLIT-01)
- ASSET-BG-01 cutout recipe (42 lines) duplicates asset-requirements.md
- Dual preflight (§14 + §16 pointer) — keep §16 pointer, trim §14
- New convergence rules: 7 KEEP, 7 MERGE into existing sections
- anti-slop.md at 456 lines — recommend split into focused refs at ~220 lines
- ACTION: DEFER trim to separate WP (risk of breaking existing compliance)

### dev-uiux-design (Beauvoir): 24 IDs, moderately bloated
- FE-DIAL-PRESET-01 → rename to UX-DIAL-PRESET-01
- 6 dial preset contradictions with inference rules → FIX NOW
- UX-CONCEPT-GEN-01 too complex (competing flows) → DEFER simplification
- anti-rationalization.md not linked → FIX NOW
- ACTION: Fix dial presets + link anti-rationalization.md

## WP2: dev-backend (12 gaps), dev-testing (7 gaps), dev-debugging (10 gaps)

### dev-backend (Harvey) — P0 additions:
- resilience.md: deadlines, retries, circuit breakers, bulkheads
- database-performance-workflow.md: baseline → EXPLAIN ANALYZE → change → remeasure
- webhooks-integrations.md: HMAC, replay, dedup, DLQ
- transactions-concurrency.md: isolation, locking, idempotency

### dev-testing (Cicero) — P0 additions:
- Patch-integrity gate (TEST-PATCH-INTEGRITY-01): baseline → implement → re-run original
- TDD evidence contract: RED failure + GREEN output + refactor suite
- Flake measurement: reproduction count, reinstatement criterion

### dev-debugging (Hegel) — P0 additions:
- Performance-debugging protocol: baseline → bottleneck → fix → remeasure → guard
- Log-analysis reference: format detection, signature clustering, correlation
- Incident containment vs permanent fix distinction

## WP3: dev-architecture (8 gaps), dev-scaffolding (10 gaps), dev-security (10 gaps)

### dev-architecture (Popper) — P0:
- Persistent structural index concept (ARCH-INDEX-01)
- Circular-dep ratcheting (not just recommendation)
- Architecture conformance test contract

### dev-scaffolding (Popper) — P0:
- Deterministic scaffold contract with dry-run
- Post-scaffold verification (install+build+test+lint)

### dev-security (Ohm) — P0:
- agent-skill-integrity.md: OWASP AST01-10 coverage
- Skill provenance requirements

## WP4: dev-devops (10), dev-code-reviewer (10), dev-data (8), dev-diagram-viewer (11)

### dev-devops (Faraday) — P0:
- agent-infra-safety.md: plan-only default, credential separation
- resilience-dr.md: backup/restore, RTO/RPO, chaos testing
- Policy-as-code gate concept

### dev-code-reviewer (Euler) — P0:
- Coverage ledger for changed files
- Falsification pass per finding
- Interdiff/re-review protocol

### dev-data (Euler) — P0:
- Data-specific review checklist
- Schema-change detection rules

### dev-diagram-viewer (Euler) — P0:
- Mandatory render verification
- Syntax validation before display
- A11y contract (labels, contrast, keyboard)
