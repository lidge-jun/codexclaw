# Boundary Validation Matrices

### Validation Location Matrix

| Location | Validate? | Rationale | Example |
|----------|-----------|-----------|---------|
| HTTP/API controller input | YES | Untrusted external data | Zod schema, JSON schema |
| CLI argument parsing | YES | Untrusted user input | yargs/commander validation |
| File system reads | YES | External data, may be corrupt | Parse + validate structure |
| Database query results | YES at ORM-untyped/raw-query boundaries (shape only); NO when a typed schema/ORM guarantees the shape | Untyped results may drift; typed guarantees are trusted (see Banned Patterns) | Check raw-query nulls/shape; trust typed ORM results |
| Message queue consumer | YES | Cross-process boundary | Validate message schema |
| **Internal function params** | No repeated shape parsing; domain constraints may apply | Types prove shape, not every business invariant | Domain owner checks start <= end |
| **Private method args** | No repeated shape parsing; invariants may apply | Types do not prove every valid state | Enforce the private method's real domain constraints |
| **Service-to-service in same process** | No repeated trusted shape parsing; enforce domain/security rules | In-process is not a waiver for invariants or authorization | Validate the actual boundary/constraint |

### Banned Patterns

| Banned Pattern | Why Banned | Fix |
|----------------|-----------|-----|
| `if (!param) throw` at start of every internal function | Redundant with type system, clutters code | Remove — let TypeScript/types enforce |
| Repeated runtime shape checks on already validated trusted values | Adds noise without a new boundary | Trust the parsed shape; retain domain invariants and reachable-state checks |
| Assertions on a state proven impossible by the actual contract | Distracts from reachable failures | Fix types where sufficient; retain assertions for real domain/state constraints |
| Repeating the same input shape parser in every domain constructor | Duplicates a trusted ingress contract | Parse shape once; enforce domain invariants in the entity/value-object owner |
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
