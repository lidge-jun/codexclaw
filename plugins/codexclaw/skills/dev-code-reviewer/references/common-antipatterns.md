## 3. Common Antipatterns

### Structural

| Pattern | Symptom | Fix |
|---------|---------|-----|
| God class | One class does everything | Split by single responsibility |
| Long method | Function does 5+ distinct things | Extract named helper functions |
| Deep nesting | 4+ levels of if/for/try | Guard clauses, early returns, extraction |
| Feature envy | Method uses another object's data more than its own | Move method to the data owner |
| Shotgun surgery | One change requires edits in 10+ files | Consolidate related logic |

### Dead Code

| Pattern | Detection | Fix |
|---------|-----------|-----|
| Unreachable code after return/throw | `no-unreachable`, compiler warnings | Delete the dead branch |
| Unused imports / variables | `no-unused-vars`, `@typescript-eslint/no-unused-vars` | Remove |
| Commented-out code blocks | Manual review | Delete — use version control history |
| Unused exports | `ts-prune`, `knip`, consumer search | Remove scoped internal dead exports; public contracts require compatibility review before removal |
| Stale feature-flagged code | Check flag status in flag service | Remove dead branch and the flag check |

Dead code is a maintenance tax — remove rather than comment out.

### Logic

| Pattern | Symptom | Fix |
|---------|---------|-----|
| Boolean blindness | `doThing(true, false, true)` | Named options object or enum |
| Stringly typed | `status === 'actve'` (typo = silent bug) | Define enum or union type |
| Magic numbers | `if (retries > 3)` | Named constant: `MAX_RETRIES = 3` |
| Primitive obsession | Passing 5 related strings around | Create a data object/type |
| Direct mutation | `user.name = 'x'`, `arr.push(y)` | Immutable: `{...obj, name: 'x'}`, `[...arr, y]` |
| Missing boundary validation | Business logic handles raw user input | Delegate placement to `dev-architecture` §4; schema/content depth to `dev-security` |

### Security

This section owns the mandatory review pre-scan; `dev-security` owns security
policy and deep analysis. Use this checklist for hardcoded secrets, injection,
validation, auth, authorization, and logging findings.
