---
name: cxc-dev-architecture
description: "MUST USE for module boundary work, circular dependency detection, coupling review, barrel or re-export changes, and validation placement decisions. Triggers: circular import, module split, layer violation, dependency direction, utils growth, barrel file, re-export, boundary review, architecture refactor, 모듈 경계, 순환 참조."
metadata:
  last-verified: "2026-07-02"
  short-description: "Module boundaries, circular deps, coupling taxonomy, and boundary-only defensive programming."
---

# Dev-Architecture — Module Boundaries & Structural Integrity

> **C0/C1 work (small local patches):** See `dev` §0.0 Work Classifier + §0.1 Patch Fast-Path before reading references.
> **Read the `dev` skill first** for universal development discipline before applying architecture rules.

Enforces architectural rules that prevent structural decay: circular dependencies, implicit coupling, barrel abuse, and misplaced validation. These rules are mechanical — an AI coding agent can follow them without subjective judgment.

Severity mapping (dev §0.2): `Severity: CRITICAL`/`HIGH` ⇒ STRICT; `MEDIUM` ⇒ DEFAULT.

## Modular References

| File | When to Read | What It Covers |
|------|--------------|----------------|
| `references/circular-dependencies.md` | Detecting or fixing import cycles | Detection commands (madge/pydeps/go vet), fix strategies, real examples |
| `references/coupling-taxonomy.md` | Reviewing code for hidden coupling | 8 coupling types, severity matrix, refactoring patterns, banned review responses |
| `references/barrel-discipline.md` | Creating/modifying index/barrel files | When barrels OK vs banned, tree-shaking impact, safe barrel template |

## External/current architecture evidence

Architecture rules in this skill are local and mechanical. When an architectural
decision depends on current framework guidance, cloud/provider reference
architecture, package deprecation, platform limits, or public source evidence,
read the active `search` skill and follow its query-rewrite, source-fetch, and
evidence-status rules. Use browser verification only after candidate URLs exist.

---

## 1. Module Boundaries

### Structural Decision Gate

**Severity: HIGH**
**Rule (ARCH-DECISION-01):** When changing module boundaries, seams, layering, shared packages, or public exports above C0/C1 local-patch scope, name the structural decision before editing.

Required decision record, inline in the plan or in the repo's ADR/source-of-truth file:
- Context: what pressure forced the boundary change.
- Rejected alternative: at least one plausible option not chosen, with why.
- Chosen move: split, extract, merge, invert dependency, introduce adapter, or change public export.
- Consequences: new dependency direction, public contract impact, migration cost, and follow-up verification.

Route durable, surprising, hard-to-reverse, or cross-team choices to the repo's ADR/current-architecture source of truth instead of leaving them only in chat. `dev-scaffolding` owns where those durable docs live; this skill owns the boundary decision content.

### Pre-Change Structural Map

**Severity: HIGH**
**Rule (ARCH-MAP-01):** Before recommending or applying a split/extract/merge for boundary work above C0/C1, produce a compact structural map from code evidence.

Map fields:
- Core modules involved.
- Direct dependents and dependencies.
- Current and intended dependency direction.
- Public boundaries touched (`index.*`, package exports, route/API contracts, CLI entry points).
- Blast-radius class (local module, feature, package, app, cross-app/monorepo).

Do not choose the fix first and backfill the map. The map is the evidence that tells whether the right move is colocation, extraction, dependency inversion, adapter introduction, or no structural change.

### Layered Architecture Boundaries

| Layer | May Import | MUST NOT Import | Example |
|-------|-----------|-----------------|---------|
| Presentation (UI/CLI/Controller) | Application, Domain | Infrastructure directly | React component importing DB client |
| Application (Use Cases/Services) | Domain, Ports | Presentation, Infra adapters | Service importing React component |
| Domain (Entities/Value Objects) | Nothing (self-contained) | Any other layer | Entity importing Express |
| Infrastructure (Adapters/DB/HTTP) | Domain (implements ports) | Presentation, Application | DB adapter importing controller |

### When to Split a Module

Canonical file-size rule: **>400 LOC -> split (DEFAULT)**. Deviations require a stated reason.

| Signal | Action |
|--------|--------|
| File exceeds 400 LOC | Split by responsibility (DEFAULT) |
| Module has 6+ direct dependents | Extract shared interface |
| Two unrelated features share a file | Separate into own modules |
| Circular import detected | Extract shared types/interfaces to a third module |
| Module name contains "and" or "utils" | Split by actual concern |

### Banned Patterns

| Banned | Why | Fix |
|--------|-----|-----|
| `utils.ts` / `helpers.ts` growing unbounded | Becomes a coupling magnet | Split by domain: `date-utils.ts`, `string-format.ts` |
| Cross-layer direct import | Breaks dependency direction | Use ports/adapters or event bus |
| Shared mutable state between modules | Hidden temporal coupling | Pass explicitly or use event system |
| God module (20+ exports) | Everything depends on it | Extract cohesive sub-modules |

### Module SSOT (Single Source of Truth)

Every concept, constant, type, or configuration value MUST have exactly one canonical owner module.

| Concept | Canonical Owner | Consumers Do |
|---------|----------------|--------------|
| Shared types / interfaces | `types/` or `contracts/` module | Import, never redefine |
| Constants / magic values | Domain-specific constants module | Import the constant |
| Config / env | Central config module | Import resolved values |
| Validation schemas | Boundary module (API entry) | Import schema, don't recreate |
| API contracts | API layer | Import types from API module |

| Banned | Why | Fix |
|--------|-----|-----|
| Duplicating a type/constant in a consumer | Two sources of truth → drift | Import from canonical owner |
| "Local copy for convenience" | Convenience becomes divergence | Import the original |
| Re-deriving a value that has a canonical source | Silent inconsistency | Import the derived value or computation |

### Deep Modules and Seams

Use this vocabulary when deciding whether an abstraction earns its keep:

| Term | Meaning |
|------|---------|
| Module | A cohesive unit with a named responsibility and public interface |
| Interface | The small surface consumers depend on |
| Implementation | The hidden work behind that surface |
| Depth | Large useful behavior hidden behind a small interface |
| Seam | A boundary where alternative implementations are real or likely |
| Adapter | Code translating one external shape into the module's interface |
| Leverage | How much change the abstraction absorbs for its callers |
| Locality | How close related behavior stays to its owning concept |

Frontend depth means small props/events hiding complex rendering, state management,
data transformation, or integration behavior. One adapter usually means hypothetical
indirection; two adapters, or a near-term second adapter, is evidence of a real seam.
Do not expose internals only for tests; test through the public interface or add a
boundary-owned diagnostic hook with production value.

---

## 2. Circular Dependency Detection & Prevention

**Severity: CRITICAL**
**Rule:** No circular dependency may exist between modules. Every detected cycle MUST be resolved before merge.

### Required Agent Workflow

| Phase | Required Action | Pass Condition |
|-------|-----------------|----------------|
| 1. Detect | Run ecosystem-specific detection command | Command exits clean (no cycles reported) |
| 2. Classify | Identify cycle type: direct A<->B or transitive A->B->C->A | Type documented |
| 3. Analyze | Determine root cause: shared type? callback? event? | Root interface identified |
| 4. Fix | Apply appropriate fix strategy (see references/) | Detection command passes |
| 5. Verify | Re-run detection + confirm no regressions | Zero cycles in report |

Detection commands are ecosystem-specific. See `references/circular-dependencies.md`
for command templates, examples, and verification details.

### Banned Patterns

| Banned Pattern | Why Banned | Required Fix |
|----------------|-----------|--------------|
| A imports B, B imports A (direct cycle) | Compile failures, bundler issues, test fragility | Extract shared interface to C |
| Type-only cycle (`import type` both ways) | Still signals wrong boundary | Move shared types to `types/` module |
| Barrel re-export creating hidden cycle | Index file masks real dependency graph | Remove barrel, use direct imports |
| Lazy import to "break" cycle (`require()` inside function) | Hides the problem, breaks tree-shaking | Fix the architecture, not the symptom |
| "It works in runtime" as justification | Fragile, bundler-dependent, blocks refactoring | Must pass static analysis |
| Circular via test file importing source that imports test helper | Test infra leaking into production graph | Isolate test helpers in `__test_utils__/` |

### Fix Guidance

| Situation | Preferred Fix |
|-----------|---------------|
| Two modules share types | Extract `types.ts` or `contracts/` module both import |
| Module A calls back into B | Dependency inversion: A defines interface, B implements |
| Event producer and consumer import each other | Event bus / mediator pattern |
| Circular at package level (monorepo) | Introduce `shared` or `contracts` package |
| UI component imports its container | Lift shared state to context or prop drilling |
| Service layer cycle | Extract orchestrator service or use events |

---

## 3. Implicit Coupling Taxonomy

**Severity: CRITICAL**
**Rule:** Every coupling instance in a code review MUST be classified by type. Coupling severity determines whether the code can merge.

### Coupling Types (ordered by severity, worst first)

| # | Type | Definition | Example | Severity | Fix Pattern |
|---|------|-----------|---------|----------|-------------|
| 1 | **Content** | Module reaches into another's internals | Accessing private fields, reading internal state | CRITICAL | Expose via public API/method |
| 2 | **Common** | Multiple modules share global mutable state | Global config object mutated by services | CRITICAL | Dependency injection, immutable config |
| 3 | **Control** | Module passes flag to control another's logic | `processOrder(order, isRetry=true)` | HIGH | Polymorphism, strategy pattern |
| 4 | **Stamp** | Module passes large struct when only one field needed | `renderHeader(entireUserObject)` | HIGH | Pass only needed fields |
| 5 | **External** | Multiple modules depend on same external format | Both parse same CSV format independently | HIGH | Single parser module, shared schema |
| 6 | **Temporal** | Modules must execute in specific order | `init()` must run before `process()` | MEDIUM | Make ordering explicit (state machine, builder) |
| 7 | **Sequential** | Output of A is input of B (pipeline) | ETL stages | LOW | Document the contract, validate at boundary |
| 8 | **Functional** | Modules share a well-defined interface | Function call with typed params/return | LOW | This is GOOD coupling — the target state |

### Review Decision Matrix

| Severity | Merge? | Action Required |
|----------|--------|-----------------|
| CRITICAL (Content, Common) | BLOCK | Must refactor before merge |
| HIGH (Control, Stamp, External) | BLOCK unless justified | Require tech-debt ticket if merged |
| MEDIUM (Temporal) | Allowed with documentation | Add ordering comments or state assertions |
| LOW (Sequential, Functional) | ALLOWED | No action needed |

See `references/coupling-taxonomy.md` for examples, detection signals,
refactoring patterns, and banned review responses.

---

## 4. Boundary-Only Defensive Programming

**Severity: CRITICAL**
**Rule:** Validation and defensive checks belong ONLY at system boundaries. Internal module boundaries MUST trust their callers.

Ownership split: **placement** (validation happens at the boundary, nowhere else) is owned
by this section; **what the validation schema enforces** (content/policy) is owned by
`dev-security` §1.

### Validation Location Matrix

| Location | Validate? | Rationale | Example |
|----------|-----------|-----------|---------|
| HTTP/API controller input | YES | Untrusted external data | Zod schema, JSON schema |
| CLI argument parsing | YES | Untrusted user input | yargs/commander validation |
| File system reads | YES | External data, may be corrupt | Parse + validate structure |
| Database query results | YES at ORM-untyped/raw-query boundaries (shape only); NO when a typed schema/ORM guarantees the shape | Untyped results may drift; typed guarantees are trusted (see Banned Patterns) | Check raw-query nulls/shape; trust typed ORM results |
| Message queue consumer | YES | Cross-process boundary | Validate message schema |
| **Internal function params** | **NO** | Caller is trusted code you control | Type system handles this |
| **Private method args** | **NO** | Same module, same author | Redundant — types suffice |
| **Service-to-service in same process** | **NO** | In-process calls share type system | Interface contracts handle this |

### Banned Patterns

| Banned Pattern | Why Banned | Fix |
|----------------|-----------|-----|
| `if (!param) throw` at start of every internal function | Redundant with type system, clutters code | Remove — let TypeScript/types enforce |
| Runtime type checks in typed language internals | Duplicates compiler work, adds noise | Trust the type system |
| `assert(x !== null)` in module-internal code | If x can be null, fix the type; if it can't, the assert is noise | Fix type signature or remove assert |
| Validation in domain entity constructor for in-process callers | Entities should be created from validated data | Validate at boundary, trust domain layer |
| Try-catch around every internal call | Hides bugs, makes debugging harder | Let errors propagate, catch at boundary |
| Null checks after DB query that schema guarantees NOT NULL | Distrusts your own schema | Trust schema, validate at migration time |

### Allowed Defensive Checks (Exceptions)

| Situation | Why Allowed | Pattern |
|-----------|-------------|---------|
| Security-critical path (auth, crypto) | Defense in depth required by policy | Double-check even internal calls |
| Data from deserialization (JSON.parse) | Runtime data, types lost | Validate with schema (Zod/io-ts) |
| Plugin/extension boundary | Third-party code, untrusted | Validate at plugin interface |
| Across deployment boundary (microservice call) | Network = system boundary | Full validation required |
| Feature flags / A-B test paths | Runtime variation, not type-safe | Guard with runtime check |

### Fix Guidance

| Smell | Diagnosis | Fix |
|-------|-----------|-----|
| 10+ `if (!x) throw` in one file | Over-defensive internal code | Remove guards, fix types |
| Every function starts with parameter validation | Boundary confusion | Move all validation to entry point |
| `try { } catch { return null }` everywhere | Error suppression | Let errors bubble, handle at boundary |
| `typeof x === 'string'` in TypeScript | Distrusting compiler | Remove, or fix the type to be accurate |
| Same validation in controller AND service | Duplicated boundary | Validate once at controller, service trusts |

---

## 5. Barrel/Re-export Discipline

**Severity: HIGH**
**Rule:** Barrel files (index.ts/index.js/__init__.py) are ONLY allowed at public boundaries — package APIs and feature public boundary exports. Internal convenience barrels are banned.

### Barrel Policy Matrix

| Context | Barrel Allowed? | Rationale |
|---------|-----------------|-----------|
| Library/package public API (`packages/ui/index.ts`) | YES | Single entry point for consumers |
| Framework plugin entry (`plugin/index.ts`) | YES | Plugin contract requires it |
| Feature public boundary export (`features/auth/index.ts` as the feature's single external entry) | YES | Public Boundary Export (dev-scaffolding §1); external consumers import the boundary |
| Feature internal convenience barrel (re-exporting siblings for imports inside the feature) | NO | Hides internal structure, breaks tree-shaking |
| Utility folder (`utils/index.ts`) | NO | Creates coupling magnet |
| Component folder re-exporting siblings | NO | Direct imports are clearer |
| Monorepo package boundary (`@org/shared/index.ts`) | YES | Cross-package contract |

See `references/barrel-discipline.md` for import examples, tree-shaking
details, ESLint enforcement, and the safe barrel template.

---

## 6. Review Integration

### Architecture Review Checklist (for code-reviewer)

When reviewing any PR that adds/modifies module structure, verify:

- [ ] **No new circular dependencies** — run `madge --circular` or equivalent
- [ ] **Layer violations** — no upward imports (infra->domain OK, domain->infra BLOCKED)
- [ ] **Coupling classified** — any new cross-module dependency has coupling type identified
- [ ] **No CRITICAL/HIGH coupling without justification** — Content/Common/Control coupling blocked
- [ ] **Barrel files** — no new internal barrels; existing public barrels use named exports only
- [ ] **Validation placement** — new validation is at system boundary, not internal functions
- [ ] **Module size** — new/modified modules under 400 LOC
- [ ] **No "utils" growth** — shared code placed in domain-specific module, not catch-all utils
- [ ] **Dependency direction** — dependencies point inward toward Domain: outer layers depend on inner layers (Presentation/Application/Infrastructure -> Domain), and inner layers never import outward
- [ ] **No lazy-import hacks** — no `require()` inside function body to hide circular deps

### Automated Enforcement (CI Recommendations)

| Check | Tool | CI Command |
|-------|------|------------|
| Layer/dependency rules (preferred CI gate) | dependency-cruiser | `npx depcruise --validate .dependency-cruiser.cjs src/` |
| Circular deps (quick visualization) | madge | `npx madge --circular --extensions ts,tsx src/ && echo "OK"` |
| Dead files/exports/deps | knip | `npx knip` |
| Monorepo package consistency | sherif | `npx sherif` |
| Import boundaries | eslint-plugin-boundaries | ESLint with boundaries config |
| Layer violations | dependency-cruiser | `npx depcruise --validate .dependency-cruiser.cjs src/` |
| Barrel abuse | custom ESLint rule | `no-restricted-imports` pattern for internal index files |
| Module size | custom script | `find src -name '*.ts' -exec wc -l {} + | awk '$1 > 400'` |

---

## Cross-Skill References

- **Observability**: Trace emission at module boundaries is a production/long-lived-runtime concern (DEFAULT there, not universal). See `dev-backend/references/core/observability.md` for the canonical OTel setup.
- **Security**: Validate at every trust/process/external boundary (HTTP entry, IPC, file/CLI input, third-party responses). Intra-trust-domain module calls follow §4 boundary-only defense — do not re-validate already-trusted data. See `dev-security/SKILL.md` for input validation and auth patterns.

---

## Quick Decision Trees

### "Should I create a new module?"

```
Does the code serve a distinct responsibility? 
  NO  -> Keep in existing module
  YES -> Is it used by 3+ other modules?
    NO  -> Co-locate with primary consumer
    YES -> Create dedicated module with clear interface
```

### "Is this coupling acceptable?"

```
What type? (see taxonomy above)
  Content/Common -> BLOCK, refactor now
  Control/Stamp/External -> BLOCK unless tech-debt ticket created
  Temporal -> ALLOW with documentation
  Sequential/Functional -> ALLOW
```

### "Where does this validation go?"

```
Is the data source external (HTTP, file, queue, DB, user input)?
  YES -> Validate here (boundary)
  NO  -> Is this a security-critical path?
    YES -> Validate (defense in depth)
    NO  -> Trust the type system, no validation needed
```

---

## Structural Index Concept (ARCH-INDEX-01, DEFAULT)

Source: sol research (wednesday-solutions/ai-agent-skills AST dependency graph).

Instead of reconstructing a module map for every task, maintain a lightweight
structural index that agents can query:

- Use `cxc map <dir>` for on-demand symbol-level maps (already shipped).
- For larger repos, consider a persistent dependency graph artifact (e.g.,
  `dependency-cruiser` JSON, Nx project graph, or a custom SQLite index).
- The index should track: module → exports, module → imports, symbol → callers.
- Freshness: re-generate on significant structural changes (new modules, moved files).
- Query before editing: "what depends on this module?" should be answerable from
  the index without a full codebase scan.

This is a guidance concept, not a shipped tool. The agent should check for existing
index artifacts before running ad-hoc scans.

## Architecture Conformance Tests (ARCH-CONFORMANCE-01, DEFAULT)

Source: sol research (HoangNguyen0403/agent-skills-standard compliance auditing).

Architecture rules that exist only as prose are invisible to CI. For C3+ work
where boundary violations would cause real harm:

- Generate tool-specific configs from architecture decisions (dependency-cruiser
  rules, ESLint boundaries plugin, Nx enforce-module-boundaries, Go `depguard`).
- Include at least one allowed-edge and one forbidden-edge test fixture.
- The CI gate should FAIL on new violations while allowing a baselined set of
  legacy violations (ratcheting: new cycles fail, old ones are migrated).
- Return a machine-readable report (JSON or SARIF) that agents can consume.
