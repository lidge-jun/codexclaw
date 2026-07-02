# Implicit Coupling Taxonomy

Last reviewed: 2026-07-02

Deep reference for classifying, detecting, and resolving coupling in code reviews.

---

## The 8 Coupling Types

### 1. Content Coupling (CRITICAL)

**Definition:** Module directly accesses/modifies another module's internal data.

**Examples:**
- Reading `other._privateField` (bypassing encapsulation)
- Monkey-patching another module's internals
- Directly manipulating another component's DOM/state

**Refactoring:** Expose a public method or getter. If no natural API exists, the modules may need to merge.

### 2. Common Coupling (CRITICAL)

**Definition:** Multiple modules read/write the same global mutable state.

**Examples:**
- Global config object mutated by multiple services
- Shared singleton with mutable state
- Module-level `let` variable imported and modified by others

**Refactoring:** Dependency injection. Pass config explicitly. Use immutable config frozen at startup.

### 3. Control Coupling (HIGH)

**Definition:** Module passes a flag/enum that controls another module's internal logic flow.

**Examples:**
- `processOrder(order, isRetry=true, skipValidation=false)`
- Boolean parameter that switches between two unrelated behaviors
- Enum that selects internal algorithm

**Refactoring:** Polymorphism. Split into `processNewOrder()` / `retryOrder()`. Strategy pattern for algorithm selection.

### 4. Stamp Coupling (HIGH)

**Definition:** Module passes a large data structure when only a small part is needed.

**Examples:**
- `renderHeader(entireUserObject)` when only `user.name` is needed
- Passing full DB row to a function that uses one field
- React component receiving entire store slice as prop

**Refactoring:** Pass only needed fields. Define minimal interface. Destructure at call site.

### 5. External Coupling (HIGH)

**Definition:** Multiple modules independently depend on the same external data format or protocol.

**Examples:**
- Two services both parse the same CSV format with inline logic
- Multiple modules assume specific JSON structure from third-party API
- Hardcoded external URL in multiple places

**Refactoring:** Single adapter/parser module. All consumers import the parsed result, not raw external data.

### 6. Temporal Coupling (MEDIUM)

**Definition:** Modules must execute in a specific (undocumented) order.

**Examples:**
- `init()` must be called before `process()` but nothing enforces this
- Service A must start before Service B
- Config must be loaded before any module initializes

**Refactoring:** State machine (make illegal states unrepresentable). Builder pattern. Explicit initialization chain.

### 7. Sequential Coupling (LOW)

**Definition:** Output of module A feeds directly as input to module B (pipeline).

**Examples:**
- ETL: extract -> transform -> load
- Middleware chain: parse -> validate -> authorize -> handle
- Compiler: lex -> parse -> analyze -> generate

**Refactoring:** Usually acceptable. Document the contract between stages. Validate at stage boundaries.

### 8. Functional Coupling (LOW — TARGET STATE)

**Definition:** Modules interact through well-defined, typed interfaces.

**Examples:**
- Function call with typed parameters and return value
- Interface implementation
- Event with typed payload

**Refactoring:** No refactoring needed. This is the goal state for all inter-module communication.

---

## Severity Matrix (Review Decision)

| Severity | Types | Merge Decision | Required Action |
|----------|-------|----------------|-----------------|
| CRITICAL | Content, Common | BLOCK | Refactor before merge. No exceptions. |
| HIGH | Control, Stamp, External | BLOCK unless justified | Tech-debt ticket with deadline + reviewer approval |
| MEDIUM | Temporal | ALLOW with docs | Add ordering documentation or state assertions |
| LOW | Sequential, Functional | ALLOW | No action needed |

---

## Banned Review Responses

These responses are NEVER acceptable when coupling is identified:

| Banned Response | Why It's Banned | What To Say Instead |
|-----------------|-----------------|---------------------|
| "It works so it's fine" | Working code can be unmaintainable | "It works, but this is [type] coupling (severity: X). Must fix / ticket." |
| "We'll fix it later" (no ticket) | "Later" = never in practice | "Creating ticket [PROJ-XXX] with deadline [date] for decoupling." |
| "It's just one place" | One instance becomes ten within weeks | "Fix now while blast radius is small." |
| "The tests pass" | Tests don't measure architectural integrity | "Tests verify behavior, not structure. Static analysis says X." |
| "It's internal, nobody else uses it" | Internal coupling compounds fastest | "Internal coupling is MORE dangerous — harder to detect, easier to spread." |

---

## Detection Signals During Review

| Signal in Code | Likely Coupling Type | Investigate |
|----------------|---------------------|-------------|
| Accessing `._private` or internal field | Content | Encapsulation breach |
| Global `let` / mutable singleton | Common | Shared mutable state |
| Boolean/enum parameter controlling flow | Control | Hidden polymorphism |
| Passing full object, using 1-2 fields | Stamp | Over-broad interface |
| Duplicated parsing logic | External | Missing shared adapter |
| Comment: "must call X before Y" | Temporal | Missing state machine |
| Pipeline without input validation | Sequential | Undocumented contract |
