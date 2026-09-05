---
name: cxc-dev
description: "MUST USE for every coding task — classifies work depth (C0-C5), defines modular limits, pre-write search, verification-before-completion, and safety rules. Always-on discipline (agent-followed, not hook-enforced) that routes to surface-specific dev-* routers by change surface. Also surfaces browse/QA native tool routing so the model uses agbrowse and Codex browser plugins instead of installing Playwright directly, and owns the stacked-pull-request rules (DEV-STACK-*) for splitting dependent work across a chain of reviewable PRs. Triggers: any code change, refactor, bug fix, feature, test, review, scaffolding, browse, browser, QA, stacked PR, stacked diff, PR stack, restack, 브라우저, 브라우즈, 페이지 열어, URL 확인, 화면 확인, 스크린샷, QA 확인, 플레이라이트, 스택 PR, PR 쪼개기."
metadata:
  last-verified: "2026-07-02"
  short-description: "Universal dev discipline: work classifier, modular limits, verification gate, safety rules."
  keywords: ["develop", "implement", "refactor", "feature", "code quality", "verification", "browse", "browser", "QA", "agbrowse", "stacked PR", "stacked pull request", "stacked diff", "PR stack", "restack", "브라우저", "페이지 확인", "화면 QA", "플레이라이트", "스택 PR", "PR 쪼개기"]
---

# Dev — Common Development Guidelines

Core rules applied to every coding task, regardless of surface.

User instructions and the actual host's safety/tool contracts take precedence over skill guidance. A diagnosis or review authorizes investigation, not fixes, installs, publishing, or account changes; a change request authorizes only its scoped implementation.

## §0.0 Work Classifier (C0-C5)

**Classify every task before choosing process depth** (DEV-CLASS-01). The class selects how much
planning, reading, and verification the task deserves — never apply maximum process by default.

| Class | Name | Signals | Default Process |
|-------|------|---------|-----------------|
| C0 | Trivial Text | Typo, comment, copy, log string — zero behavior change | Direct fix + smallest proof (§0.1) |
| C1 | Single-File Local | One file, local behavior, no new abstractions | Fast path (§0.1) + targeted check |
| C2 | Ordinary Product Slice | Conventional endpoint, form, table, model, list/detail screen, integration touchpoint | Compact plan + adjacent convention search + focused tests + micro-audit |
| C3 | Cross-Domain Feature/Refactor | Multiple modules, public API, shared types, broad behavior | Compact or full PABCD depending on persistence/risk; add subagent audit when scope or risk warrants |
| C4 | High-Risk | Auth, payments, data deletion, migration, release, permission model, security boundary | Full PABCD (mandatory) + full relevant gates + durable risk/evidence record |
| C5 | Research/Ambiguous | Unclear requirements, ambiguous user value, unknown territory after one §0 clarification round | Interview-first via the `pabcd` skill, then reclassify |

**C5 is temporary** — it cannot enter implementation until Interview resolves ambiguity
and the task is reclassified C0-C4.

**Tie-break (DEFAULT):** when signals match two classes, the higher class wins. A
conventional route→service→storage slice still counts as C2 even though it spans files;
C3's "multiple modules" means crossing a module/package boundary beyond that conventional slice.

**C4-promotion triggers override any fast path** (DEV-ESCALATE-01): security, data
deletion/migration, destructive ops, public contract change, release surface, permission
model, new dependency/framework. Any of these promotes the **affected part** of the task
to C4-level care — split it out rather than inflating the whole slice. Promotion alone
does not force a user question; stopping to ask is required only for rules individually
classed **ESCALATE** (§0.2).

## §0.1 Patch Fast-Path (C0/C1)

For **C0/C1 work** (bounded by "one file, no new abstractions, local behavior" — a ≤5-line
in-place edit is an example, not a limit):
- Skip: §0.5 convention discovery, §1.5 pre-write search, reference file reading
- Keep: §3 verification gate, §4 change documentation, §5 safety rules (imports/exports),
  §7 type/static checks when applicable. C0 changes with zero behavior impact are exempt
  from numbered implementation-unit records. C1 patches leave a short change/reason/proof
  record only when an owning unit already exists; do not create a unit just for C0/C1.
  Security, data-loss, or new-abstraction changes are not this fast path. This exception applies (UNIT-RESIDENCE-01, `pabcd` Implementation-Unit Documents).
- Role skills: read only the `SKILL.md` routing table — skip references unless the table explicitly routes to one

This is scope guidance, not an exemption. Conventions visible in the touched file still
apply even when proactive discovery is skipped. Promotion is **behavioral**, not
territorial: a patch escalates when it can alter the behavior of an auth/payment/deletion
or other DEV-ESCALATE-01 path — not merely because the file lives in such an area. A
zero-behavior edit (comment, typo, log string) inside an auth file stays C0; any edit
touching the executed logic of such a path is not C0/C1 — reclassify and read the
relevant reference.

## §0.2 Rule Classes

Rule authority is based on purpose, not typography. Safety, correctness, permission
boundaries, and truthful verification are mandatory. File-size thresholds, naming,
module layout, implementation style, and aesthetic choices are DEFAULT or STYLE_SAMPLE,
even when an older reference calls them MUST/NEVER or assigns HIGH severity. A documented
project/user contract may make a particular constraint mandatory; cite that contract.
Explicitly requested workflows retain their phase/evidence requirements. An unclassified
rule is DEFAULT unless violating it has a concrete safety or correctness consequence.

- **STRICT** — always applies; violating it blocks completion (safety, broken builds, secrets).
- **DEFAULT** — apply unless a documented, stated reason says otherwise.
- **HEURISTIC** — judgment guide; deviation needs no justification, just awareness.
- **STYLE_SAMPLE** — illustrative example or preset only. Examples illustrate acceptable
  choices but MUST NOT become universal requirements (DEV-STYLE-SAMPLE-01).
- **ESCALATE** — stop and ask the user before proceeding.

## §0.3 Methodology Overlays

Methodologies are **conditional overlays, never universal**. They activate when the routing
skill's description matches the work surface, when the user explicitly asks for the method,
when repo convention requires it, or when a strict trigger applies — required evidence
applies only when the strict trigger applies (low-risk/local work uses the smallest
proof that validates the claim, with the reduced scope stated).

| Overlay | Loads | Strict trigger |
|---------|-------|----------------|
| `tdd` / `testing` | `dev-testing` | User/repo enforces TDD, or regression risk |
| `bdd_acceptance` | `dev-testing`, `dev` | Ambiguous acceptance behavior |
| `ddd` / `clean_arch` / `hexagonal` / `architecture` | `dev-architecture`, `dev-backend` | Real boundary pressure at C3/C4 |
| `vertical_slice` | `dev-architecture`, `dev-backend`, `dev-frontend`, `dev-testing` | Thin end-to-end slice (C2) |
| `adr_rfc` | `dev-architecture`, `dev-scaffolding` | Significant decision, domain vocabulary, or ADR source-of-truth work |
| `review` / `code_review` | `dev-code-reviewer` | Review requested or C3/C4 |
| `threat_model` / `security` | `dev-security` | C4 security/data/tooling risk |
| `observability` / `observability_pipeline` | `dev-backend` (+`dev-data`, `dev-devops` for operational gates) | App instrumentation, production/runtime hooks, incident/release gates |
| `logging` (CLI / scripts / libraries) | `dev` `references/logging.md` | What to emit and where; service instrumentation stays with `dev-backend` |
| stacked pull requests (`DEV-STACK-*`) | `dev` `references/stacked-prs.md` | When to stack, cascade discipline, layer shape, review scope, bottom-up merge safety |
| `debugging` / `debugging_rca` | `dev-debugging` | Repeated failure needs root cause |
| `migration_backfill` | `dev-data`, `dev-backend`, `dev-testing` | Production or non-trivial data |
| `product_discovery` (+`_ui`) | `dev` (+`dev-uiux-design`) | Ambiguous behavior/user value/metric/prototype intent |
| `release_cd` | `dev-testing`, `dev-scaffolding`, `dev-devops` (+`dev-backend` for app hooks) | Release/CI/CD surface, rollback/smoke gates, app readiness hooks |
| `devops` / `infra` / `deploy` | `dev-devops` | Container/K8s/IaC/deploy pipeline/SRE |
| `mobile_native` | `dev-frontend` + `dev-uiux-design` + `dev-backend` (refs) | RN/Flutter/Swift/Kotlin native app |
| `ml` / `ai` / `llm` / `rag` | `dev-backend` + `dev-data` + `dev-testing` (+`dev-devops`) | ML serving, RAG, pipeline, evaluation |
| `frontend_ui` | `dev-frontend` + `dev-uiux-design` | UI/design intent or runnable prototype variant work |
| `crud_fullstack` | `dev-backend`, `dev-frontend`, `dev-testing` | Full-stack slice with coupled UI + API verification |

For C2 ordinary product slices, read `references/product/crud-product-development.md`
only when building a conventional feature slice.

## §0.4 Workflow Modes

The same rules flex by execution mode — know which one you are in:
ordinary chat (direct work, C0-C2 typical) · PABCD mode (`pabcd` skill) ·
goal mode (`create_goal`, evidence-backed checkpoints) · subagent
(scoped writes when explicitly delegated) · read-only review (no mutation,
findings only) · docs-only work (no code gates, docs consistency checks instead).

PABCD, goal, divergence, and repeated work-phase mechanics are canonical in
`pabcd` and `cxc-loop`. Load those skills when the selected process requires
them; classify each work-phase independently.
Multi-cycle loops (2+ work-phases) enter docs-first: the first work-phase is a
docs-only PABCD that locks the diff-level roadmap before any implementation cycle
(LOOP-DOCS-FIRST-01, `cxc-loop`).

**Production surface (shared definition):** a surface is production when it is deployed
for real users beyond the author; prototypes, spikes, and internal demos are not. Skills
that scope rules to production-surface concerns (for example `dev-backend` observability
or `dev-frontend` production checklists) condition on this definition.

## Companion Skills

This skill covers universal guidelines. **STRICT (DEV-ROUTE-01): you MUST read the
matching `dev-*` router `SKILL.md` before writing code in that surface.** Routing is not
optional discovery — for any change whose surface appears below, reading that router's
`SKILL.md` (its routing table; references only when the change needs that depth) is a
precondition for writing code there. Skipping it is a STRICT violation (dev §0.2), the
same severity as a broken build. When a change spans multiple surfaces, read each
matching router first.

| Change surface | Primary router | Also load |
|---------------|----------------|-----------|
| Backend / API / server | `dev-backend` | `dev-security` for auth/input |
| Frontend / UI / web | `dev-frontend` | `dev-uiux-design` for vague/open visual direction, UX-state meaning, IA, brand, concept gen |
| App database / OLTP / transactional schema | `dev-backend` | `dev-security` for access; `dev-testing` for migrations |
| Analytics / ETL / data quality / analytical backfills | `dev-data` | `dev-backend` for API integration |
| Tests / QA | `dev-testing` | `dev-frontend` for browser QA |
| Security / auth / secrets | `dev-security` | surface-specific router |
| Architecture / modules / deps | `dev-architecture` | `dev-scaffolding` for new structure |
| Debugging / crashes / perf | `dev-debugging` | surface-specific router |
| DevOps / deploy / infra | `dev-devops` | `dev-security` for credentials |
| Scaffolding / docs / setup | `dev-scaffolding` | `dev-architecture` for boundaries |
| Code review | `dev-code-reviewer` | `dev-security` + `dev-testing` |
| Diagrams / charts | `dev-diagram-viewer` | — |

### Subagent Skill Injection (DEV-SKILL-INJECT-01)
Attach `cxc-dev` and every relevant surface skill explicitly to governed subagents.
Prefer resolvable skill links; use plugin-native mentions or v1 `items` when needed.
Hooks may normalize recognized plaintext mentions but never infer omitted skills.
Attach `cxc-search` for search tasks; the same search policy binds delegated agents.

Surface-to-owner mappings live in `references/skill-ownership.md`; router trigger
metadata remains canonical in each skill's `agents/openai.yaml`.

### Capability Routing Hub
Use `dev` plus repo tools for local facts; load `search`, `pabcd`, `loop`, `recall`,
`cxc-qa`, or the matching `dev-*` owner for their named domains. `skill-hub` is deprecated.

### Browse / QA Tool Routing

Canonical selection policy: [Portable browser routing](references/browser-routing.md).
Use it for public proof, authenticated research, parallel extraction, and local UI QA.
Aside is preferred when suitable and available; agbrowse is recommended, not required.
No optional browser, CLI, account, or native plugin is assumed installed on every host.
Do not install a new driver/runner merely because a request says Playwright; use the
available capability. Explicit project-owned E2E work remains `dev-testing`'s domain.

### Skill Ownership Map
Canonical rule ownership and stub locations live in `references/skill-ownership.md`.
Update the canonical owner first and keep stubs as pointers; multi-domain tasks load
every relevant owner skill before work begins.

---

## Family Invariants (apply to every `cxc-*` skill)

> **Role boundary (canonical — identical in `dev-frontend` and `dev-uiux-design`):**
> `dev` owns universal process, evidence, and safety rules. `dev-uiux-design` owns
> design intent, direction, and concept judgment. `dev-frontend` owns concrete frontend
> implementation and rendered tell enforcement. Anti-slop has three layers: `dev` =
> output/process hygiene (FAMILY-SLOP-01), `dev-uiux-design` = concept/taste judgment
> (is this direction generic or domain-wrong?), `dev-frontend` = rendered implementation
> tell detection and removal (FE-AI-TELL-01).

These hold for every dev-family skill and every response they govern. `dev` is the canonical
owner; other routers reference this section rather than restating it. They are agent-followed
wording (no Codex hook enforces skill text — `structure/00_philosophy.md` §1), not runtime gates.

- **Anti-slop output (FAMILY-SLOP-01).** No filler, no performative narration, no decorative
  rationale. Ship no placeholders, TODO-only deliverables, fake fallbacks, speculative wrapper
  layers, or broad defensive clutter without a named boundary reason. Code-smell catalog lives
  in §6 + `dev-code-reviewer` §3; this rule is about not emitting slop in the first place.
- **file:line evidence (FAMILY-CITE-01).** When reporting code findings, plans, reviews, or
  contradictions, cite `path:line`. Plans list exact paths + the verification command; review
  and audit findings carry `path:line`; verification claims carry the command + its output or
  artifact path. This mirrors the structure doctrine (`structure/00_philosophy.md:135-141`).
- **Completion proof (FAMILY-PROOF-01).** No completion claim without fresh proof — see the
  §3 verification gate for the long form. Every other router inherits that gate; it is not
  re-stated per skill.

---

## External Evidence and Recall Routing

| Need | Route |
|---|---|
| External library syntax or pinned-version behavior | Context7 `resolve-library-id` → `query-docs`; otherwise official docs |
| Current versions, releases, CVEs, providers, or public evidence | Load `cxc-search` and follow its evidence rules |
| HTTP-first URL proof | `agbrowse fetch <url> --json`; full ladder: `cxc-search` Tier 2 |

### Recall Lookup Scope (DEV-RECALL-01, MUST)
| Trigger | Route |
|---|---|
| Prior term/file/decision is unfamiliar or context was lost | `cxc chat search "<terms>" --days 0` and `cxc memory search "<topic>"` |
| Both searches miss | Ask the user and report what was searched; full flags: `cxc-recall` |

---

## 0. Intent Clarification

Clarify only ambiguous scope or technology. Present 2-3 project-specific options,
flag risk, recommend one, and confirm once; skip clarification when intent is clear.

---

## 0.5 Repository Convention Discovery

Before broad changes, inspect source layout, source-of-truth docs, agent instructions,
toolchain config, and sibling naming/test/module patterns. Devlogs use decade-range
numbering, never bare `PLAN.md`/`PHASES.md`/`RCA.md` (LEXICO-SPLIT-01; see `pabcd`).

Discover conventions in order: repo instructions/SoT docs → toolchain/config → owning
module → direct callers → 2-3 sibling examples.

MUST follow existing conventions when they are clear.
MUST read existing source-of-truth docs before broad implementation.
MUST NOT create docs folders, instruction files, or new tooling silently in an existing repo.

If the repo is immature, undocumented, or inconsistent, propose a lightweight source-of-truth structure and ask for approval before creating it.

### Broad Change Preview

For directory changes, 5+ files, cross-surface work, new modules/services, or new
project docs, preview current signals, a compact tree (max ~40 lines), planned
touch points, and whether existing conventions are reused or need approval.

---

## 1. Modular Development

Give every file, function, and class a single, clear responsibility.

**Review signals (DEFAULT — exceed with a stated responsibility/risk rationale):**

| Metric | Threshold | Action |
| ------ | --------- | ------ |
| File length | >400 lines | Split into focused modules (canonical owner: `dev-architecture` §1) |
| Function length | >50 lines | Extract helper functions |
| Class methods | >20 methods | Split by responsibility |
| Nesting depth | >4 levels | Flatten with early returns or extraction |
| Function parameters | >5 | Use an options/config object |
| PR changeset | >500 lines | Split into focused PRs |

### Blast Radius Limits

Each PR/changeset MUST be scoped to one logical change. Opportunistic rewrites, unrelated cleanup, and drive-by refactors go in separate PRs.

| Change Scope | Max Blast Radius | Exceeds → |
|---|---|---|
| Single bug fix | 1–3 files | Split fix from cleanup |
| Feature addition | 1 module/package | Separate infra from feature |
| Refactoring | Pre-approved scope only | Get scope approval first |
| Dependency upgrade | Isolated PR | Never bundle with features |

**Rules:**
- Prefer ESM for new JS/TS code when the runtime and repository support it. Preserve required CommonJS configuration/package interfaces; interop and bundler optimization are separate checks, not reasons for a blanket migration.
- One default export per file when the file has a primary purpose (JS/TS convention; other languages follow their idioms).
- Follow existing naming conventions in the project. Check sibling files before creating new ones.
- New files must match the directory structure and naming patterns already in use.
- Devlog phase documents use decade-range numbering (LEXICO-SPLIT-01, `pabcd` Implementation-Unit Documents). Never use bare filenames like `PLAN.md`, `PHASES.md`, or `RCA.md`.

---

## 1.5 Necessity Gate & Pre-Write Search Obligation

**DEV-NECESSITY-01 (DEFAULT — ponytail discipline, verified 2026-07-02):** before writing
ANY code, check the no-code options in order — do nothing / delete / configure / reuse —
and state which you rejected and why. Frame tasks exclusions-first (what NOT to add)
before the goal. Never lazy about STRICT domains: trust boundaries, data loss, security,
accessibility.

**Rule:** Before creating a new function, helper, type, component, constant, route, fixture, or module, search the codebase for an existing owner or equivalent implementation. No new abstraction may be introduced without search evidence. This section does not apply on the §0.1 fast path (C0/C1 — no new abstractions are being created).

**Structure map first (DEFAULT — DEV-MAP-FIRST-01):** for C2+ work in unfamiliar territory,
run `cxc map <dir>` (repo-map skill, tree-sitter + PageRank overview) before deep `rg`
dives; then use `rg`/ast-grep to confirm the narrowed targets. Guidance, not hook-enforced.

**Read before editing (DEV-READ-FIRST-01).** Beyond new-abstraction creation, any C2+ edit to
existing code reads the target file (and its direct caller/consumer when the change crosses a
boundary) before writing. Do not propose or apply a change to code you have not read. The §0.1
fast path still applies to C0/C1.

| Artifact being created | Required searches | Preferred outcome |
|---|---|---|
| Function/helper | Exact name, verb phrase, domain noun | Extend existing helper or add next to owner |
| Type/interface/schema | Exact type name and shape fields | Reuse or extend existing contract |
| Component | UI label, route, component name, feature folder | Modify owning component |
| Constant/magic string | Literal value and semantic name | Move to existing constants/contract module |
| Test fixture/factory | Fixture factory and existing test data | Extend shared fixture factory |
| Route/API client | Endpoint path, handler name, client wrapper | Update both server and client owner |
| Config/env flag | Env var prefix and config module | Add to central config owner |

**Banned patterns:**
- Creating `utils.ts`, `helpers.ts`, or `common.ts` without owner search
- Duplicating a type because import path was not obvious
- Creating parallel API clients for the same endpoint
- "I could not find it" without showing search terms

**Search evidence required:** When code is changed, include terms searched, files inspected, reuse decision, and new-code justification in the final response.

---

## 2. Systematic Debugging

Root-cause method, instrumentation, hypothesis testing, emergency stop triggers,
and postmortems are canonical in `dev-debugging/SKILL.md`. Reproduce and isolate
before editing for any non-obvious defect. Load `dev-debugging` for runtime failures,
unclear causality, or after 2 failed repair attempts.

**Repeated-friction rule (DEV-FRICTION-01, DEFAULT).** When the same shell command
class fails twice with the same normalized error, do not retry a third time
unchanged: switch approach (different tool, different flags, or root-cause the
environment). Repeated identical failures are friction evidence, not bad luck.

**Repeated-edit-shape rule (DEV-EDIT-SHAPE-01, DEFAULT).** Three same-shaped edits
in a row (same structural transform on different sites) mean you are hand-running
a codemod: stop and switch to `$cxc-ast-grep` (or a scripted rewrite) so the
remaining sites are transformed deterministically.

---

## 3. Verification Before Completion (STRICT)

Verify every completion claim with evidence. Run the relevant command fresh, read full output, and confirm the claim matches.

**Verification gate (before any completion claim):**

1. **Identify** — What command proves this claim?
2. **Run** — Execute fresh (not cached).
3. **Read** — Full output. Check exit code. Count failures.
4. **Confirm** — Does the output actually support the claim?
5. **Report** — State the claim with evidence attached.

| Claim | Requires | Not Sufficient |
| ----- | -------- | -------------- |
| "Tests pass" | Test command output: 0 failures | Previous run, "should pass" |
| "Build succeeds" | Build command: exit 0 | "Linter passed" |
| "Bug fixed" | Original symptom verified resolved | "Code changed, assumed fixed" |
| "Feature complete" | Each requirement checked line-by-line | "Tests pass" |
| "Subagent completed" | VCS diff shows actual changes | Subagent report says "success" |
| "Regression test works" | Red-green cycle verified | Test passes once |

**Per-class verification floor (DEV-VERIFY-FLOOR-01).** The gate above is universal; the
minimum *scope* scales with the work class (§0.0). This is the floor, not a cap:

| Class | Minimum verification |
| ----- | -------------------- |
| C0/C1 | Smallest relevant proof: text consistency for C0; focused test/checker for C1, or an observed repro with stated limits when automation does not fit |
| C2 | Focused integration/contract test for the touched slice + targeted build/typecheck + UI smoke if UI changed (CRUD per-operation negatives: see `dev-testing` references/core/crud-test-matrix.md) |
| C3 | Affected suites + docs/contract consistency when a public contract changed |
| C4 | Full relevant gates + negative cases + durable evidence record |

**Subagent delegation:** When subagents report success, verify independently: check VCS diff → verify changes exist → confirm behavior.

---

## 4. Change Documentation
For C2+ work with a supplied log, add a concise factual change/reason/verification entry.
C0/C1 automatic record duties follow §0.1; merely finding a devlog or changelog does
not reinstate them. An explicit user request or a documented release-record contract
still governs its named log. Do not create an unrelated record to satisfy this section.

---

## 5. Safety Rules

- **Preserve public contracts** — trace external consumers before removing exports. Internal unused exports may be removed within scope after consumer search; public removals need a compatibility/migration decision.
- **Verify imports exist** before adding `import` statements. Confirm the target file and export are real.
- **Externalize configuration** — use config files or environment variables. Place magic strings and numbers in named constants.
- **Handle all async errors explicitly** — surface failures at a clear boundary. In JS/TS backend code, the Result pattern (`neverthrow`) may replace per-call `try/catch` when failures are surfaced at a verified boundary (see `dev-backend/SKILL.md` §3). In other cases, use `try/catch` and log with context (`console.error('[module]', error.message)`).
- **Confirm before destructive operations (ESCALATE)** — deleting files, dropping tables, resetting state, or clearing caches require explicit user approval.
- **Commit incrementally (DEV-GIT-COMMIT-01, DEFAULT)** — commit working progress as you go during implementation. Each logically complete step (passing test, wired feature, fixed bug) gets its own commit so that progress is checkpointed on disk and recoverable after compaction or failure. Do not accumulate an entire feature as uncommitted changes.
- **Push requires explicit user approval (DEV-GIT-PUSH-01, ESCALATE)** — never `git push` without the user's explicit approval in the current session. Committing locally is autonomous; pushing to a remote is an external state change that the user must authorize. If the user has not approved a push, do not push — even at D/completion. This applies equally to force-push, branch creation on remote, and tag push.
- **Stack dependent work instead of one oversized PR (DEV-STACK-01, DEFAULT)** — when a change splits into 2+ dependency-ordered parts and one PR would be too large to review, publish a bottom-up stack: each branch based on the one below, each PR's base pointing at its parent. Editing a lower layer means cascading the rebase to every layer above before pushing (`DEV-STACK-02`, STRICT). Merging a stack is bottom-up and stays user-authorized (`DEV-STACK-04`, ESCALATE). Canonical rules, depth guidance, anti-patterns, review scope, and tooling: `references/stacked-prs.md`.

---

## 6. Code Quality Signals (stub)

Anti-pattern detection (god class, long method, deep nesting, magic numbers, stringly
typed, missing boundary error handling, floating promises, copy-paste) is canonically
owned by `cxc-dev-code-reviewer` §3 — read it when writing or reviewing code.
Thresholds mirror §1 hard limits; boundary-error placement follows `cxc-dev-architecture` §4.

---

## 7. Type Safety & Static Analysis

Default to strict, explicit types in new code, use TypeScript for new JS/TS
source when the repo supports it, and run the project's configured static
analysis as part of §3 verification. Do not introduce new type/lint tooling or
convert a JS repo to TS without user approval.

Escape hatches (`any`, casts, `type: ignore`) must be narrow, explained near the
code, and verified by the strongest local checker available. Detailed language
rules, command examples, and rule mappings live in
`references/static-analysis.md`. Per-toolchain gate commands and type-annotation
rules live in `references/static-analysis-gate.md`.

---

## 8. Token Budget Awareness

When multiple skills are active, token consumption grows quickly. Always read
active `SKILL.md` files, read `references/` only when the task touches that
topic, and do not preload unrelated references (HEURISTIC). Each subagent gets
its own active-skill context, so load only what the sub-task needs.

---

## 9. Skill Discovery (DEV-SKILL-DISCOVERY-01, DEFAULT)

For uncovered capabilities, check `references/skill-catalog.md`, then run
`cxc skill search <query>` (jaw first; `--source all` adds clawhub and hermes).
Load only the needed result with `cxc skill show <id>`; its adapter preserves
`cxc-dev` authority, and built-in codexclaw skills win name conflicts.
