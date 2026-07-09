---
name: cxc-dev
description: "MUST USE for every coding task — classifies work depth (C0-C5), defines modular limits, pre-write search, verification-before-completion, and safety rules. Always-on discipline (agent-followed, not hook-enforced) that routes to surface-specific dev-* routers by change surface. Triggers: any code change, refactor, bug fix, feature, test, review, scaffolding."
metadata:
  last-verified: "2026-07-02"
  short-description: "Universal dev discipline: work classifier, modular limits, verification gate, safety rules."
  keywords: ["develop", "implement", "refactor", "feature", "code quality", "verification"]
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
- Keep: §3 verification gate, §4 change documentation — including the numbered
  record doc in the owning implementation unit, mandatory for ALL work
  (UNIT-RESIDENCE-01, `pabcd` Implementation-Unit Documents), §5 safety rules (imports/exports), §7.2 static analysis
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

In goal mode, multi-phase / loop work runs one FULL PABCD cycle per work-phase
(depth scaled by §0.0 class); after D closes a cycle to IDLE, YOU run `cxc orchestrate P --session <id>`
to start the next work-phase — nothing re-enters `P` automatically (the Stop hook only
blocks premature termination so you do this). Classify EACH work-phase independently —
C0-C1 fast-path applies to that work-phase's class, not the whole goal. Do each PABCD
phase's real work; never rubber-stamp a phase to advance. Work-phases chain
HETEROGENEOUS units: a completely different feature or "the next plan" is simply the
next cycle at P in the SAME session (`cxc-loop` LOOP-UNIT-CHAIN-01) — "needs its own
PABCD" never means ending the goal or waiting for a new session.

When any PABCD workflow enters divergence mode (HITL or goal mode; see `cxc-loop`),
keep the user question honest. The archive may require N>=2 candidates, but the
user-facing question does not. If the user already gave a clear implementation intent,
record `strong-1` plus `add-1` with evidence and converge silently. Ask the user to
choose among N candidates only when intent is genuinely open, success criteria conflict,
or the metric cannot separate candidates after C/D evidence. Goal mode adds only the
Stop-hook continuation/plateau prompt; divergence itself is a PABCD-layer doctrine.

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

Why this is wording, not a runtime gate: no Codex hook fires on skill load (see
`structure/00_philosophy.md` §1), so the main agent self-enforces this STRICT rule. For
SUBAGENT dispatches the discipline DOES attach deterministically: the always-on
`^spawn_agent$` PreToolUse hook rewrites the spawn `message` to prepend link-form
`$cxc-*` mentions (role baseline + inferred surfaces), which the child's first turn
parses into full SKILL.md injections — schema-safe on both the v1 and v2 spawn surfaces
because `message` is a shared field. The v1-only `items` channel via
`resolveSpawnPayloadWithSkills` (L15) remains the strongest explicit form; the hook
no-ops when `items` is already present (`structure/10`).

### Subagent Skill Injection (DEV-SKILL-INJECT-01)

When spawning a subagent for any codexclaw-governed task, attach `cxc-dev` and
the relevant surface `cxc-*` skills by putting **$cxc mentions in the spawn
message** — plain `$cxc-<skill>` or link-form `[$cxc-<skill>](skill://<abs
SKILL.md path>)` — or through the v1 `items` mechanism when routing through the
builder. Name the surface skills explicitly rather than relying on the hook's
keyword inference. Keep the skill body as the single source of truth. For
search tasks, attach `cxc-search`, and ensure subagents/delegated agents are
bound by the same search-skill policy as the main agent.

| Skill File | Routes When (surface) | Covers |
| ---------- | --------------------- | ------ |
| `dev-frontend/SKILL.md` | UI/frontend work | Frontend implementation, component architecture, responsive layouts, animation, design-system application |
| `dev-backend/SKILL.md` | API/server/database work | API design, app architecture patterns, database optimization, error handling, middleware, app-level operational hooks |
| `dev-data/SKILL.md` | Data pipelines, SQL, analysis, ETL/ELT | Data pipelines, ETL/ELT, data quality validation, SQL optimization, analysis and reporting |
| `dev-security/SKILL.md` | Security-sensitive code, auth, secrets, threat modeling | OWASP Top 10, auth hardening, input validation, secrets management, supply chain security |
| `dev-testing/SKILL.md` | Test strategy, regression protection, acceptance checks | Test strategy, browser testing, coverage analysis, contract testing |
| `dev-debugging/SKILL.md` | Runtime debugging, repeated failures, RCA | Root cause analysis, boundary instrumentation, hypothesis testing, postmortem |
| `dev-code-reviewer/SKILL.md` | Code review and quality audit | Review process, quality thresholds, antipattern detection, giving/receiving feedback |
| `dev-architecture/SKILL.md` | Module boundaries, dependency direction, layer work | Circular deps, module boundaries, coupling taxonomy, barrel/re-export discipline |
| `dev-uiux-design/SKILL.md` | Vague design direction, onboarding/empty/error UX | Design judgment, intent discovery, design vocabulary, product personalities, typography/layout decisions |
| `dev-scaffolding/SKILL.md` | New project/feature setup, structural audit, docs generation | Scaffolding, colocation, public boundary export, documentation generation |
| `pabcd/SKILL.md` | Multi-phase planning, interview-first discovery, gated execution | PABCD workflow, phase gates, interview flow |

**Visibility decision (canonical):** the implicit-visible set is `{dev, search, interview, pabcd, recall, loop, dev-frontend, dev-uiux-design}` (`allow_implicit_invocation: true` in each skill's `agents/openai.yaml`; the 2026-07-05 expansion added metadata rows only — `dev` alone carries the always-on body discipline; the 2026-07-09 expansion added `dev-frontend` + `dev-uiux-design` so anti-slop design grammar reaches every UI-generating session without routing). Everything else — `skill-hub` (deprecated), `qa`, `repo-map`, and every other `dev-*` router — is on-demand (`allow_implicit_invocation: false`) and loads by explicit mention, trigger match, or `dev` routing. This is the correct set; any claim that only `cxc-dev` is implicit is stale.

### Capability Routing Hub

Use this hub instead of `skill-hub`: repo fact-finding stays in `dev` plus repo tools; current/external/public facts load `search`; multi-step planning loads `pabcd`; repeated work phases load `loop`; past-session context loads `recall`; review loads `dev-code-reviewer`; runtime failure loads `dev-debugging`; module boundaries load `dev-architecture`; backend/frontend/data/security/devops/scaffolding load their matching routers; manual surface-driving QA (prove a built web/TUI/CLI/API surface actually works before done) loads `cxc-qa`. `skill-hub` is deprecated.

### Skill Ownership Map

Each rule area has exactly one canonical owner. Other skills may contain stubs but MUST NOT duplicate canonical content.

| Rule Area | Canonical Owner | Stub Locations |
|-----------|----------------|----------------|
| Circular dependencies | `dev-architecture` | `dev`, `dev-code-reviewer` |
| Module boundaries / layers | `dev-architecture` | `dev-backend`, `dev-frontend` |
| Coupling taxonomy | `dev-architecture` | `dev-code-reviewer` |
| Barrel / re-export | `dev-architecture` | `dev-scaffolding` |
| Pre-write search | `dev` §1.5 | `dev-code-reviewer` |
| Edge-first testing | `dev-testing` §6 | — |
| Manual surface QA / evidence matrix | `cxc-qa` | `dev-testing` §4.6 (tool routing stays there) |
| Test-induced defense | `dev-testing` §6.7 | `dev-code-reviewer` |
| Boundary-only defense | `dev-architecture` §4 | `dev-backend`, `dev-security` |
| Process isolation | `dev-backend` references/ | `dev-code-reviewer`, `dev-devops` |
| Long-lived connections | `dev-backend` §1 app hooks | `dev-frontend`, `dev-devops` operational gates |
| Async task queue | `dev-backend` §2 app hooks | `dev-devops` operational gates |
| Debugging methodology | `dev-debugging` | `dev-code-reviewer` |
| Data pipeline patterns | `dev-data` | `dev-backend` |
| Frontend implementation | `dev-frontend` | `dev-uiux-design` |
| Design intent discovery | `dev-uiux-design` | `dev-frontend` |
| Design judgment | `dev-uiux-design` | `dev-frontend` |
| Operational gates | `dev-devops` | `dev-backend`, `dev-scaffolding` |
| Project scaffolding / docs | `dev-scaffolding` | `pabcd` |
| PABCD workflow | `pabcd` | — |
| Anti-slop output | `dev` §Family Invariants | all `dev-*` |
| file:line evidence | `dev` §Family Invariants | all `dev-*` |
| Completion proof | `dev` §Family Invariants | `pabcd`, all `dev-*` |

When updating a rule, update the canonical owner first, then verify stubs still point correctly.

**When your task spans multiple domains** (for example, building an API endpoint that returns analyzed data), read each relevant skill file before starting.

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

## Documentation Verification (Context7)

If Context7 MCP is available, verify external library syntax before using it
(`resolve-library-id` → `query-docs`). **Verify when:** API not verified this session,
pinned version, uncertain behavior, or a major release in the past 6 months.
**Skip for:** language built-ins, standard library, syntax verified this session.
If unavailable, fall back to official docs lookup — never training data alone.

### External/current evidence

For current versions, release notes, CVEs, package/source checks, provider
behavior, or browser-verifiable public evidence, read the active `search` skill
and follow its source-fetch/evidence-status rules rather than relying on memory
alone. Subagents/delegated agents are bound by the same search-skill policy.

`agbrowse` is on PATH for HTTP-first URL verification. For any URL proof, prefer
`agbrowse fetch <url> --json` before reaching for browser tools; the full tier
ladder lives in `$cxc-search` (Tier 2).

### Recall Lookup Scope (DEV-RECALL-01, MUST)

Past work context lives in the Codex session root and is searchable in
milliseconds. Before asking the user about PRIOR work, search it yourself:

- **When**: an earlier-work term/file/decision is unfamiliar; context lost after a
  compact/restart; the user references past work; or you are about to write "I don't
  have context about X".
- **How** (read-only): `cxc chat search "<terms>" --days 0` (full-history FTS;
  `--context 2`, `--cwd <repo>`) and `cxc memory search "<topic>"`.
- Only after both miss may you ask the user — and say what you searched.
  Full flag set: `$cxc-recall`. Subagents are bound by this rule too.

---

## 0. Intent Clarification

When a request has **ambiguous scope or unspecified technology**, clarify before coding.
If the user already specifies clear tech and scope (for example, "Build a React drawer component"), skip this step entirely.

Clarification shape: present 2-3 `<TechName> — <plain explanation>` options with
project-specific pros/cons, flag complex or risky options, recommend one with
reasoning, confirm once, then move on. Consider simpler alternatives before
heavy frameworks; do not turn clarification into an interview unless the task is
truly C5.

---

## 0.5 Repository Convention Discovery

Before broad changes, inspect existing project conventions:
- Source layout: `src/`, `app/`, `packages/`, `frontend/`, `backend/`
- Source-of-truth docs/logs: `docs/`, `architecture/`, `adr/`, `plans/`, changelogs
- Agent context: `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, tool-specific instruction files
- JS/TS setup: `package.json`, `tsconfig*`, ESLint/Biome config, sibling file extensions
- Existing naming, test, module, and phase-document patterns
- Devlog phase documents use decade-range numbering (000-009 research, 010-019 phase 1, ...); never bare `PLAN.md`/`PHASES.md`/`RCA.md` (LEXICO-SPLIT-01). Full convention: `pabcd`.

MUST follow existing conventions when they are clear.
MUST read existing source-of-truth docs before broad implementation.
MUST NOT create docs folders, instruction files, or new tooling silently in an existing repo.

If the repo is immature, undocumented, or inconsistent, propose a lightweight source-of-truth structure and ask for approval before creating it.

### Broad Change Preview

Before broad changes, show a compact tree and planned touch points.

Broad change means any of:
- Creates or reorganizes directories
- Touches 5+ files
- Spans frontend + backend or multiple top-level packages
- Adds a new feature/module/service
- Adds project documentation or source-of-truth structure

Preview format:
- Current signals: detected stack and docs/conventions found
- Compact tree: max ~40 lines; omit generated/vendor folders and VCS internals
- Planned edits: files/folders to create or modify
- Convention decision: reuse existing structure, or ask before proposing new structure

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

Investigate the root cause before applying any fix — guessing leads to compounding rework.

For full debugging methodology — boundary instrumentation, pattern analysis, hypothesis testing, and postmortem — see `dev-debugging/SKILL.md`.

This section covers the **emergency stop triggers** every coding agent should recognize:

**Red flags — stop and return to root cause investigation:**

| Rationalization | Reality |
| --------------- | ------- |
| "Quick fix for now, investigate later" | First fix sets the pattern. Do it right from the start. |
| "Just try changing X and see" | Guessing guarantees rework. |
| "I don't fully understand but this might work" | Seeing symptoms ≠ understanding root cause. |
| "Proposing solutions before investigating" | You haven't done Phase 1. |
| "One more fix attempt" (after 2+ failures) | 3+ failures = architectural problem. |

**If 3+ fix attempts fail:** pause and reassess. Each fix revealing a new problem elsewhere signals an **architectural issue**, not a simple bug. Question fundamentals: Is this pattern sound? Are we sticking with it through inertia? Discuss with the user before attempting more fixes.

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

**Long external verification:** when a verification gate depends on a
long-running external process (CI run, deploy, remote build), spawn a
background subagent and poll with short wait cycles. Local commands (tests,
`tsc`, builds that finish in minutes) stay blocking — backgrounding is for
genuinely long external work.

**Red flags — unverified claims creeping in:** "should"/"probably"/"seems to" · satisfaction before verification · partial/previous-run evidence · trusting agent success reports · "just this once".

---

## 4. Change Documentation

When a worklog or changelog file is provided, record every change in this format:

```markdown
### [filename] — [reason for change]
- **Changes**: what was modified and why
- **Impact**: modules that import or depend on this file
- **Verification**: how the change was tested (command + result)
```

Keep entries factual and concise. One entry per file changed.

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

When a task needs a capability or domain workflow not covered by the loaded
codexclaw skills, search external skill catalogs before hand-rolling logic.

**Catalog priority:**

| Priority | Source | CLI flag | Notes |
|----------|--------|----------|-------|
| 1st | **jaw** (cli-jaw-skills) | `--source jaw` (default) | Curated, tested, adapter-compatible |
| 2nd | **clawhub** | `--source clawhub` | Community catalog, larger but unvetted |
| 3rd | **hermes** | `--source hermes` | Experimental, sparse |

**Quick path (no search needed):** browse `references/skill-catalog.md` for
the full cli-jaw skill list, organized by domain with active/reference status.
If the skill you need is listed there, load it directly.

**Search path:**

```bash
cxc skill search <query>                # searches jaw (default, 1st-class)
cxc skill search <query> --source all   # jaw + clawhub + hermes
cxc skill show <id>                     # loads the skill with adapter preamble
```

**Rules:**
- Try jaw first. Fall back to clawhub only when jaw has no match.
- External skills get the adapter preamble automatically (`cxc skill show`
  prepends it). cxc-dev discipline always wins on conflict.
- Do not preload external skills speculatively. Load one when the task clearly
  needs it, then follow its SKILL.md instructions.
- If the skill name collides with a codexclaw built-in (dev-*, search, recall,
  pabcd, loop), the built-in is authoritative; use the external as supplementary
  reference only.
