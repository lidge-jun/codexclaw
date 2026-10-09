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
