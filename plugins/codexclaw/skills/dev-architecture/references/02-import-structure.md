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

Detection commands are ecosystem-specific. See `../references/circular-dependencies.md`
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

See `../references/coupling-taxonomy.md` for examples, detection signals,
refactoring patterns, and banned review responses.

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

See `../references/barrel-discipline.md` for import examples, tree-shaking
details, ESLint enforcement, and the safe barrel template.

---
