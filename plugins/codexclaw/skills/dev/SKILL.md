---
name: cxc-dev
description: "MUST USE for every coding task — classifies work depth (C0-C5), defines modular limits, pre-write search, verification-before-completion, and safety rules. Always-on discipline (agent-followed, not hook-enforced) that routes to surface-specific dev-* routers by change surface. Triggers: any code change, refactor, bug fix, feature, test, review, scaffolding."
metadata:
  short-description: "Universal dev discipline: work classifier, modular limits, verification gate, safety rules."
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
- Keep: §3 verification gate, §4 change documentation when a worklog/changelog file is provided, §5 safety rules (imports/exports), §7.2 static analysis
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
| `observability` / `observability_pipeline` | `dev-backend` (+`dev-data`) | Production, incident, release, long-lived runtime |
| `debugging` / `debugging_rca` | `dev-debugging` | Repeated failure needs root cause |
| `migration_backfill` | `dev-data`, `dev-backend`, `dev-testing` | Production or non-trivial data |
| `product_discovery` (+`_ui`) | `dev` (+`dev-uiux-design`) | Ambiguous behavior/user value/metric/prototype intent |
| `release_cd` | `dev-testing`, `dev-backend`, `dev-scaffolding`, `dev-devops` | Release/CI/CD surface |
| `devops` / `infra` / `deploy` | `dev-devops` | Container/K8s/IaC/deploy pipeline/SRE |
| `mobile_native` | `dev-frontend` + `dev-uiux-design` + `dev-backend` (refs) | RN/Flutter/Swift/Kotlin native app |
| `ml` / `ai` / `llm` / `rag` | `dev-backend` + `dev-data` + `dev-testing` (+`dev-devops`) | ML serving, RAG, pipeline, evaluation |
| `frontend_ui` | `dev-frontend` + `dev-uiux-design` | UI/design intent or runnable prototype variant work |
| `crud_fullstack` | `dev-backend`, `dev-frontend`, `dev-testing` | Full-stack slice with coupled UI + API verification |

### Ordinary product reference (on-demand)

For C2 ordinary product slices, the recipe lives in
`references/product/crud-product-development.md` — read it when building a conventional
feature slice, not for every task.

## §0.4 Workflow Modes

The same rules flex by execution mode — know which one you are in:
ordinary chat (direct work, C0-C2 typical) · PABCD mode (`pabcd` skill) ·
goal mode (`create_goal`, evidence-backed checkpoints) · subagent
(scoped writes when explicitly delegated) · read-only review (no mutation,
findings only) · docs-only work (no code gates, docs consistency checks instead).

In goal mode, multi-phase / loop work runs one FULL PABCD cycle per work-phase
(depth scaled by §0.0 class); after D closes a cycle to IDLE, YOU run `cxc orchestrate P`
to start the next work-phase — nothing re-enters `P` automatically (the Stop hook only
blocks premature termination so you do this). Classify EACH work-phase independently —
C0-C1 fast-path applies to that work-phase's class, not the whole goal. Do each PABCD
phase's real work; never rubber-stamp a phase to advance.

For maximize-metric work that enters divergence mode (see `cxc-loop`), keep the user
question honest. The archive may require N>=2 candidates, but the user-facing question
does not. If the user already gave a clear implementation intent, record `strong-1`
plus `add-1` with evidence and converge silently. Ask the user to choose among N
candidates only when intent is genuinely open, success criteria conflict, or the metric
cannot separate candidates after C/D evidence.

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
SUBAGENT dispatches codexclaw provides a spawn-wrapper builder (L15) that CAN attach the
matching `cxc-*` skill to the spawn `items` — but only WHEN the dispatcher routes through
`resolveSpawnPayloadWithSkills`. There is no production hook auto-applying it yet (a
`^spawn_agent$` PreToolUse rewrite is feasible only on the v1 spawn surface; v2 rejects
extra `items`), so today attachment depends on the agent following the dispatch doctrine
(E5), not on an automatic gate (`structure/10`).

| Skill File | Routes When (surface) | Covers |
| ---------- | --------------------- | ------ |
| `dev-frontend/SKILL.md` | UI/frontend work | UI/UX implementation, design aesthetics, component architecture, responsive layouts, animation |
| `dev-backend/SKILL.md` | API/server/database work | API design, architecture patterns, database optimization, error handling, middleware |
| `dev-data/SKILL.md` | Data pipelines, SQL, analysis, ETL/ELT | Data pipelines, ETL/ELT, data quality validation, SQL optimization, analysis and reporting |
| `dev-security/SKILL.md` | Security-sensitive code, auth, secrets, threat modeling | OWASP Top 10, auth hardening, input validation, secrets management, supply chain security |
| `dev-testing/SKILL.md` | Test strategy, regression protection, acceptance checks | Test strategy, browser testing, coverage analysis, contract testing |
| `dev-debugging/SKILL.md` | Runtime debugging, repeated failures, RCA | Root cause analysis, boundary instrumentation, hypothesis testing, postmortem |
| `dev-code-reviewer/SKILL.md` | Code review and quality audit | Review process, quality thresholds, antipattern detection, giving/receiving feedback |
| `dev-architecture/SKILL.md` | Module boundaries, dependency direction, layer work | Circular deps, module boundaries, coupling taxonomy, barrel/re-export discipline |
| `dev-uiux-design/SKILL.md` | Vague design direction, onboarding/empty/error UX | Intent discovery, design vocabulary, product personalities, typography, layout patterns |
| `dev-scaffolding/SKILL.md` | New project/feature setup, structural audit, docs generation | Scaffolding, colocation, barrel export, documentation generation |
| `pabcd/SKILL.md` | Multi-phase planning, interview-first discovery, gated execution | PABCD workflow, phase gates, interview flow |

**Visibility decision (E6, L16):** only `cxc-dev` is implicit-visible
(`allow_implicit_invocation: true`); every `dev-*` router stays on-demand. This is a
deliberate context-budget trade — auto-rendering all 13 routers into every turn would
crowd the window — so the STRICT routing rule above (read the router before writing) is
how the right surface skill gets loaded, not always-on visibility. Each `dev-*` router
still carries a strong `MUST USE for <surface>` frontmatter trigger, so it loads on
explicit mention or trigger match. Re-evaluate promotion only if a single surface proves
high-traffic enough to justify its always-on cost.

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
| Test-induced defense | `dev-testing` §6.6 | `dev-code-reviewer` |
| Boundary-only defense | `dev-architecture` §4 | `dev-backend`, `dev-security` |
| Process isolation | `dev-backend` references/ | `dev-code-reviewer` |
| Long-lived connections | `dev-backend` §1 | `dev-frontend` |
| Async task queue | `dev-backend` §2 | — |
| Debugging methodology | `dev-debugging` | `dev-code-reviewer` |
| Data pipeline patterns | `dev-data` | `dev-backend` |
| Design intent discovery | `dev-uiux-design` | `dev-frontend` |
| Project scaffolding / docs | `dev-scaffolding` | `pabcd` |
| PABCD workflow | `pabcd` | — |

When updating a rule, update the canonical owner first, then verify stubs still point correctly.

**When your task spans multiple domains** (for example, building an API endpoint that returns analyzed data), read each relevant skill file before starting.

---

## Documentation Verification (Context7)

If Context7 MCP is available, verify external library syntax before using it:

1. `resolve-library-id` — get the library ID (for example, `/vercel/next.js`)
2. `query-docs` — fetch current docs for the specific API/feature

**When to verify:** using any API you haven't verified in this session, library version is pinned in `package.json`/`requirements.txt`, syntax or behavior seems uncertain, or the library had a major release in the past 6 months.

**When to skip:** language built-ins (`Array.map`, `str.split`), standard library (`fs`, `os`, `path`, `http`), syntax you just verified this session.

**If Context7 MCP is unavailable:** fall back to official docs lookup. Never rely on training data alone for library-specific API calls.

### External/current evidence

For current versions, release notes, CVEs, package/source checks, provider
behavior, or browser-verifiable public evidence, use current-source retrieval
and primary-source verification rather than memory alone.

---

## 0. Intent Clarification

When a request has **ambiguous scope or unspecified technology**, clarify before coding.
If the user already specifies clear tech and scope (for example, "Build a React drawer component"), skip this step entirely.

### How
1. **Adapt depth to the question**: vague/abstract → explain each option in detail. If the user already knows the terms, give a brief trade-off comparison only.
2. **Present options as `<TechName> — <plain explanation>`**: include pros/cons relevant to THIS project. Flag options that are complex, expensive, or carry risk (for example memory leaks or operational overhead).
3. **Recommend one with reasoning**: explain why it fits this project's context.
4. **Let the user decide**: confirm once, then move on. If the user picks a risky option, warn once, then respect the choice.

### Over-engineering guard
Consider whether simpler alternatives exist before suggesting heavy frameworks. A 3-page portfolio probably doesn't need Next.js — but if the user has deployment, SEO, or CMS plans, it might. Use judgment, not absolute rules.

### Limit
One confirmation round: 2-3 options → 1 recommendation → confirm → move on. Don't turn clarification into an interview unless the task is truly C5.

---

## 0.5 Repository Convention Discovery

Before broad changes, inspect existing project conventions:
- Source layout: `src/`, `app/`, `packages/`, `frontend/`, `backend/`
- Source-of-truth docs/logs: `docs/`, `architecture/`, `adr/`, `plans/`, changelogs
- Agent context: `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, tool-specific instruction files
- JS/TS setup: `package.json`, `tsconfig*`, ESLint/Biome config, sibling file extensions
- Existing naming, test, module, and phase-document patterns
- If the repo already uses numbered phase documents, preserve that numbering scheme; decade-range numbering is an optional convention, not a universal rule

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
| File length | >400 lines | Split into focused modules (per `dev-architecture`) |
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
- If the repo already uses numbered phase or planning documents, preserve the existing numbering/naming convention. Do not invent generic filenames like `PLAN.md`, `PHASES.md`, or `RCA.md` when the repo already has a clear pattern.

---

## 1.5 Pre-Write Codebase Search Obligation

**Rule:** Before creating a new function, helper, type, component, constant, route, fixture, or module, search the codebase for an existing owner or equivalent implementation. No new abstraction may be introduced without search evidence. This section does not apply on the §0.1 fast path (C0/C1 — no new abstractions are being created).

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

**Subagent delegation:** When subagents report success, verify independently: check VCS diff → verify changes exist → confirm behavior.

**Long external verification:** when a verification gate depends on a
long-running external process (CI run, deploy, remote build), spawn a
background subagent and poll with short wait cycles. Local commands (tests,
`tsc`, builds that finish in minutes) stay blocking — backgrounding is for
genuinely long external work.

**Red flags — unverified claims creeping in:**
- Using words like "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Done!")
- Relying on partial verification or a previous run
- Trusting subagent success reports without independent verification
- Thinking "just this once"

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

## 6. Code Quality Signals

Watch for these anti-patterns and fix immediately. For the full detection catalog and review-specific guidance, see `dev-code-reviewer/SKILL.md` §3.

| Anti-Pattern | Symptom | Fix |
| ------------ | ------- | --- |
| **God class** | >20 methods, mixed responsibilities | Split by domain into focused classes |
| **Long method** | >50 lines, does multiple things | Extract into named helper functions |
| **Deep nesting** | >4 levels of if/for/try | Early returns, guard clauses, extract |
| **Magic numbers** | Hardcoded `86400`, `1024`, `3` | Named constants with clear intent |
| **Stringly typed** | Strings where enums/types belong | Define explicit types or enums |
| **Missing error handling** | No catch at trust boundaries | Add `try/catch` at boundaries (controller, API edge, event handler). Internal code propagates errors — see `dev-architecture` §4. |
| **Floating promises** | Async call without `await` | Always `await` or handle rejection |
| **Copy-paste code** | Same logic in 2+ places | Extract shared function, import it |

---

## 7. Type Safety & Static Analysis

### 7.0 JS/TS Source File Default

For new JavaScript/TypeScript source files, prefer TypeScript:
- Use `.ts` for logic and `.tsx` for typed UI components when the project already supports TypeScript or is greenfield JS/TS.
- Use `.js`/`.jsx` only when the repo is clearly JS-only, build/runtime constraints require JS, or the user asks for JS.
- Do not introduce TypeScript tooling, convert existing JS, or change `tsconfig` without user approval.

New TypeScript MUST be strict-compatible from the first patch:
- No implicit `any`.
- Explicit `any` requires a nearby justification comment.
- Prefer `unknown` plus narrowing over `any`.
- Type exported function parameters and return values.
- Handle null/undefined deliberately.
- Avoid code that only passes because `strict` is disabled.

Verification:
- Run the project's configured typecheck when available.
- If TypeScript is present but no typecheck script exists, use the closest safe command such as `tsc --noEmit`.
- If strict compatibility cannot be verified, state that explicitly.

### 7.1 Type Annotations

Add explicit type annotations to all function signatures, return types, and non-trivial variables.

| Language | Rule |
| -------- | ---- |
| TypeScript | `strict: true` in `tsconfig`. Avoid implicit `any`; explicit `any` requires a line comment with justification. |
| Python | Type hints on all function params and returns (`def fetch(url: str) -> Response:`). |
| Go | Already enforced by compiler — ensure exported types have doc comments. |
| C# / Java | Use nullability annotations (`?`, `@Nullable`). Avoid raw `Object` or `dynamic`. |
| General | If the language supports a strict/pedantic mode, enable it. |

### 7.2 Static Analysis Gate

After every code change, run the project's static analysis toolchain as part of the verification gate (Section 3).

| Toolchain | Command | Must Pass |
| --------- | ------- | --------- |
| TypeScript | `tsc --noEmit` | Zero errors |
| Python (typed) | `mypy .` or `pyright` | Zero errors on changed files |
| ESLint / Biome | `npx eslint .` or `npx biome check .` | Zero errors |
| Go | `go vet ./...` | Zero issues |
| Rust | `cargo clippy -- -D warnings` | Zero warnings |
| C# | `dotnet build /warnaserror` | Zero warnings |

#### Common Rule ↔ Prose Mapping

| Anti-Pattern (prose) | ESLint / Biome Rule |
|---|---|
| Unused variable/import | `no-unused-vars`, `@typescript-eslint/no-unused-vars` |
| Unsafe `any` type | `@typescript-eslint/no-explicit-any` |
| Loose equality (`==`) | `eqeqeq` |
| Circular import | `import/no-cycle` |
| Unhandled async | `@typescript-eslint/no-floating-promises` |
| `var` usage | `no-var`, `prefer-const` |
| Complex function | `complexity`, `max-depth`, `max-lines-per-function` |

This table is not exhaustive — check project config for the canonical set.

If no static analysis tool is configured in the project, recommend one to the
user — but do not add tooling without approval.

### 7.3 Escape Hatches

When bypassing the type system is unavoidable:

- **Add a comment** explaining why the escape is needed.
- **Scope it minimally** — cast at the narrowest point, not the broadest.
- **Prefer assertion functions** over raw casts (`assertIsString(x)` > `x as string`).
- TypeScript: `as unknown as T` double-cast requires a linked issue or TODO.
- Python: `# type: ignore[code]` must specify the exact mypy error code.

---

## 8. Token Budget Awareness

When multiple skills are active simultaneously (for example `dev` + `dev-backend` + `dev-security`), token consumption grows quickly. Follow these rules to stay efficient:

**Tiered reference loading:**
1. **Always read**: `SKILL.md` files for active skills (these are the orchestrators)
2. **Read on demand**: reference files (`references/`) — only load when the task touches that specific topic
3. **Do not preload all references** (HEURISTIC) — a backend task about caching doesn't need unrelated architecture or observability references

**Example:** For "Add Redis caching to user endpoint":
- Read: `dev/SKILL.md` + `dev-backend/SKILL.md` + `dev-backend/references/core/caching.md`
- Skip: unrelated references unless the task touches them

**Cost awareness for subagents:** Each subagent receives its own copy of active skills. Minimize skills loaded per subagent — give only what's needed for that specific sub-task.
