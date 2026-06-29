# Circular Dependency Detection & Resolution

Deep reference for detecting, classifying, and resolving circular dependencies across ecosystems.

---

## Detection Commands

### Node.js / TypeScript

```bash
# madge — the standard tool for JS/TS circular detection
npx madge --circular --extensions ts,tsx src/
npx madge --circular --extensions ts,tsx --image graph.svg src/  # visual graph

# dpdm — faster for single-entry analysis
npx dpdm --circular --tree false src/index.ts

# ESLint rule (catches at lint time, not just CI)
# .eslintrc: { "rules": { "import/no-cycle": ["error", { "maxDepth": 3 }] } }

# dependency-cruiser — most configurable
npx depcruise --validate .dependency-cruiser.cjs src/
```

### Python

```bash
# pydeps — package-level cycle detection
pydeps --no-output --show-cycles src/

# importlab — Google's import analysis tool
importlab --trim src/

# Manual: grep for cross-imports
grep -rn "from.*import" src/ | sort | uniq -d
```

### Go

```bash
# Go compiler catches import cycles at build (always enforced)
go build ./...  # cycle = compile error

# For analysis without build:
go vet ./...
```

### Rust

Rust's module system prevents circular dependencies at compile time. No detection tooling needed.

---

## Fix Strategies

### Strategy 1: Interface Extraction

**When:** Two modules need each other's types.

```
BEFORE (circular):
  user.ts imports order.ts (for OrderSummary type)
  order.ts imports user.ts (for UserInfo type)

AFTER (fixed):
  types/contracts.ts defines OrderSummary + UserInfo
  user.ts imports from types/contracts.ts
  order.ts imports from types/contracts.ts
```

### Strategy 2: Dependency Inversion

**When:** Module A calls Module B, but B also needs to notify A.

```
BEFORE (circular):
  payment.ts imports notification.ts (to send receipt)
  notification.ts imports payment.ts (to check payment status)

AFTER (fixed):
  payment.ts defines PaymentObserver interface
  notification.ts implements PaymentObserver
  payment.ts calls observer.onPaymentComplete() — no import of notification
```

### Strategy 3: Event Bus / Mediator

**When:** Multiple modules have cross-cutting communication needs.

```
BEFORE (circular web):
  auth -> user -> billing -> auth (cycle)

AFTER (fixed):
  eventBus.ts (no domain imports)
  auth emits 'user.authenticated'
  user listens 'user.authenticated', emits 'user.profile.loaded'
  billing listens 'user.profile.loaded'
  No module imports another — all communicate via events
```

### Strategy 4: Merge Modules

**When:** Two small modules are truly co-dependent and represent one concept.

```
BEFORE (circular, both small):
  validator.ts (50 lines) <-> parser.ts (40 lines)

AFTER (merged):
  parse-and-validate.ts (90 lines) — single responsibility, no cycle
```

---

## Common Patterns & Resolutions

| Pattern | Root Cause | Resolution |
|---------|-----------|------------|
| Model A references Model B and vice versa | Bidirectional relationship modeled as imports | Extract shared types to `models/types.ts` |
| Service imports Repository that imports Service | Layering violation | Repository never imports Service; use events for reverse flow |
| Test helper imports source, source imports test util | Test infrastructure leaks into production | Move test utils to `__test_utils__/` outside source tree |
| Barrel (index.ts) creates hidden cycle | Re-export graph hides actual dependencies | Remove barrel, use direct imports |
| Monorepo package A depends on B depends on A | Shared types scattered across packages | Create `@org/contracts` package |
| Plugin imports host, host imports plugin | Plugin boundary confused | Define plugin interface in host; plugin implements without importing host internals |

---

## Verification After Fix

After resolving a cycle, always:

1. Re-run detection command — must report zero cycles
2. Run full test suite — ensure no behavioral regression
3. Check bundle size — extraction should not increase bundle
4. Review the dependency graph direction — should flow inward (infra -> app -> domain)
