---
name: cxc-dev
description: "MUST USE for every coding task — classifies work depth (C0-C5), defines modular limits, pre-write search, verification-before-completion, and safety rules. Always-on discipline (agent-followed, not hook-enforced) that routes to surface-specific dev-* routers by change surface. Also surfaces browse/QA native tool routing so the model uses agbrowse and Codex browser plugins instead of installing Playwright directly. Triggers: any code change, refactor, bug fix, feature, test, review, scaffolding, browse, browser, QA, 브라우저, 브라우즈, 페이지 열어, URL 확인, 화면 확인, 스크린샷, QA 확인, 플레이라이트."
metadata:
  last-verified: "2026-07-02"
  short-description: "Universal dev discipline: work classifier, modular limits, verification gate, safety rules."
  keywords: ["develop", "implement", "refactor", "feature", "code quality", "verification", "browse", "browser", "QA", "agbrowse", "브라우저", "페이지 확인", "화면 QA", "플레이라이트"]
---

# Dev — Common Development Guidelines

Core rules applied to every coding task, regardless of surface.

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
  §7.2 static analysis. C0 patches (typo, config, one-line fix) are exempt from
  numbered implementation-unit records. C1 patches record in the owning unit only
  when a unit already exists (UNIT-RESIDENCE-01, `pabcd` Implementation-Unit Documents).
- Role skills: read only the `SKILL.md` routing table — skip references unless the table explicitly routes to one

This is scope guidance, not an exemption. Conventions visible in the touched file still
apply even when proactive discovery is skipped. Promotion is **behavioral**, not
territorial: a patch escalates when it can alter the behavior of an auth/payment/deletion
or other DEV-ESCALATE-01 path — not merely because the file lives in such an area. A
zero-behavior edit (comment, typo, log string) inside an auth file stays C0; any edit
touching the executed logic of such a path is not C0/C1 — reclassify and read the
relevant reference.

## §0.2 Rule Classes

Every rule in the dev skill family carries one severity class. When a rule's class is not
marked, treat prohibitions (⛔/MUST/NEVER) as STRICT and everything else as DEFAULT.

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
| Frontend / UI / web | `dev-frontend` | `dev-uiux-design` for direction |
| Database / schema / data | `dev-data` | `dev-backend` for migrations |
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

**STRICT (DEV-BROWSE-NATIVE-01): for ad-hoc browse and exploratory QA tasks (브라우저
열기, 페이지 확인, URL 검증, 화면 QA, 스크린샷), do NOT install Playwright, puppeteer,
or browser drivers.** Use `tool_search` for the native browser tools first — they are
stable and enabled by default (`structure/60_native_capabilities.md` §3). Intentional
Playwright E2E test suites (플레이라이트 E2E 테스트 스위트) are `dev-testing` §4's
domain and not covered by this rule.

Two scoped ladders exist — the ordering is intentional, not contradictory:

| Context | Ladder | Order (start at 1; state why when skipping) | Owner |
|---------|--------|----------------------------------------------|-------|
| Public-web proof (search, research, URL verification) | SEARCH-BROWSE-01 | 1. `agbrowse` (scripted HTTP/CDP) → 2. `browser:control-in-app-browser` → 3. `chrome:control-chrome` → 4. `computer-use:computer-use` | `cxc-search` Tier 2 |
| QA of agent-built/served surfaces | QA-TOOL-LADDER-01 | 1. `browser:control-in-app-browser` → 2. `chrome:control-chrome` → 3. `computer-use:computer-use` → 4. `agbrowse` (public-URL shape checks only) | `dev-testing` §4.6 |

Full ladder protocols and rationale live in their owners above.

### Skill Ownership Map
Canonical rule ownership and stub locations live in `references/skill-ownership.md`.
Update the canonical owner first and keep stubs as pointers; multi-domain tasks load
every relevant owner skill before work begins.

---

## Family Invariants (apply to every `cxc-*` skill)

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

**Hard limits (DEFAULT — exceed only with a stated reason):**

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
- Use ES Module (`import`/`export`) in JS/TS projects — CommonJS `require()` breaks tree-shaking and static analysis.
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
| C0/C1 | Smallest proof for the change (build/type-check or the one relevant test) |
| C2 | Focused integration/contract test for the touched slice + targeted build/typecheck + UI smoke if UI changed (CRUD per-operation negatives: see `dev-testing` references/core/crud-test-matrix.md) |
| C3 | Affected suites + docs/contract consistency when a public contract changed |
| C4 | Full relevant gates + negative cases + durable evidence record |

**Subagent delegation:** When subagents report success, verify independently: check VCS diff → verify changes exist → confirm behavior.

---

## 4. Change Documentation
When a worklog or changelog is provided, add one factual entry per changed file:
`### [filename] — [reason]`, then `Changes`, `Impact`, and `Verification`
(command + result). Keep entries concise.

---

## 5. Safety Rules

- **Preserve existing exports** — other modules may depend on them. Deprecate first if removal is needed.
- **Verify imports exist** before adding `import` statements. Confirm the target file and export are real.
- **Externalize configuration** — use config files or environment variables. Place magic strings and numbers in named constants.
- **Handle all async errors explicitly** — surface failures at a clear boundary. In JS/TS backend code, the Result pattern (`neverthrow`) may replace per-call `try/catch` when failures are surfaced at a verified boundary (see `dev-backend/SKILL.md` §3). In other cases, use `try/catch` and log with context (`console.error('[module]', error.message)`).
- **Confirm before destructive operations (ESCALATE)** — deleting files, dropping tables, resetting state, or clearing caches require explicit user approval.

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
