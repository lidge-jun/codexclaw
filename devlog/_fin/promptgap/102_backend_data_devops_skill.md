# 102 — Backend / Data / DevOps Skill Reinforcement

Gap class: PROMPT/SKILL · evidence: explorer #102

> codexclaw's backend/data/devops routers are already broad, but the discipline is still
> softer than the strongest reference trees at a few important edges: boundary parsing,
> timeout/shutdown safety, migration/backfill sequencing, modern data-tool defaults, and
> release-proof / automation-gate language. These are prompt-text gaps, not runtime gaps.

## Parity table

| reference 실측 | codexclaw 실측 | 격차 | jaw식 보강 (our way) |
| --- | --- | --- | --- |
| `omo/programming/SKILL.md:38-46` + `omo/programming/references/typescript/data-modeling.md:76-99,144-176` | `plugins/codexclaw/skills/dev-backend/SKILL.md:268-299,431-448` | backend says "validate with schema" and "stable envelope", but never states the stronger contract: parse once at the trust boundary, then stop re-validating inside the service core | add one strict boundary rule to `dev-backend`: "Parse at ingress; inside the boundary typed values are proof. No duplicate validation/null-defense unless crossing a new trust boundary." |
| `omo/programming/references/go/backend-stack.md:96-105,229-244` | `plugins/codexclaw/skills/dev-backend/SKILL.md:116-155,396-445` | backend covers long-lived connections and perf targets, but it still lacks an always-visible transport baseline for request timeouts and graceful shutdown budgets; the stronger ref treats nil/default server timeouts as an operational bug | add a short "server runtime safety" stub in `dev-backend`: explicit read/write/shutdown timeouts, graceful drain on SIGTERM/deploy, and request-id propagation into every log path as default production posture |
| `cli-jaw/skills_ref/database-migrations/SKILL.md:20-35,69-83,302-338` + `cli-jaw/skills_ref/dev-testing/references/core/crud-test-matrix.md:39-43` | `plugins/codexclaw/skills/dev-data/SKILL.md:61-69,89-123,157-167` | data has good ingest/idempotency basics, but schema evolution/backfill guidance is still too vague for production changes: no explicit schema-vs-data split, no expand/migrate/contract sequence, no dry-run/reconciliation evidence language | add a migration/backfill subsection to `dev-data` that says: schema and backfill are separate steps; production changes use expand -> backfill -> dual read/write as needed -> contract; require dry-run, idempotency proof, and reconciliation counts |
| `omo/programming/references/python/data-processing.md:3-22,32-45` | `plugins/codexclaw/skills/dev-data/SKILL.md:246-279` | data tool guidance is materially weaker than omo's modern default: codexclaw still blesses `pandas` for small exploration, while the reference tree has a crisp Polars + DuckDB default and treats pandas as legacy drag | tighten `dev-data` wording from a neutral tool matrix to a default stack rule: DuckDB/Polars first, pandas only when a required downstream library forces it and the exception is stated |
| `cli-jaw/devlog/_fin/260621_devops_skill_refresh/41_phase4_detailed_research.md:18-25,35-39,52-53` + `cli-jaw/skills_ref/dev-devops/references/platform-engineering.md:52-59,76-82` | `plugins/codexclaw/skills/dev-devops/SKILL.md:17-44,103-164,319-347` | devops says rollback, environments, secrets, and GitOps. Already present (A-gate correction): the automated-vs-manual gate boundary is satisfied at `dev-devops/SKILL.md:118` (required reviewers + prevent-self-review) and `:158` (prod approval gate), so that is NOT a gap. Genuinely missing: a router-level release-evidence bundle, and an OIDC/short-lived-credential preference stated before long-lived secrets | reinforce `dev-devops` with a compact router-level proof contract: collect artifact digest + workflow/builder identity + deploy target + smoke/rollback evidence; prefer OIDC/federation or other short-lived auth before static tokens |

## Reinforcement shape

1. Add one backend boundary paragraph that upgrades "schema validation exists" into
   "parse once at ingress; typed interior is trusted".
2. Add one backend runtime-safety paragraph that makes timeouts, shutdown budgets,
   and request-id log propagation explicit default discipline.
3. Add one data migration/backfill paragraph that separates DDL from DML and names
   expand/backfill/contract sequencing plus reconciliation evidence.
4. Tighten data tool wording so the default is modern and decisive: DuckDB/Polars
   first, pandas only as an explicit compatibility exception.
5. Add one devops proof-and-gates paragraph: evidence bundle, manual approval
   evidence bundle and OIDC/short-lived credential preference (the manual-vs-automated
   gate boundary already exists at `dev-devops/SKILL.md:118,158`, per A-gate).
6. Keep the heavy examples in references; the router only needs the compact
   discipline lines so the right caution is always loaded before the deep docs.

Status: RESEARCH, text-only.
