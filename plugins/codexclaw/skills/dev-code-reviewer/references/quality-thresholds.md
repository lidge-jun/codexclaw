## 2. Quality Thresholds

Flag these during review:

| Issue | Threshold | Severity |
|-------|-----------|----------|
| Long function | >50 lines | Medium |
| Large file | >400 lines | Medium; apply `dev-architecture` §1 canonical split rule |
| God class | >20 methods | High |
| Too many parameters | >5 | Medium |
| Deep nesting | >4 levels | Medium |
| High cyclomatic complexity | >10 branches | High |
| Missing error handling | any unhandled async | High |
| Hardcoded secrets | API keys, passwords in source | **Critical** |
| SQL injection | string concatenation in queries | **Critical** |
| Debug statements | console.log, debugger left in | Low |
| TODO/FIXME | unresolved in production code | Low |
| TypeScript `any` | bypassing type safety | Medium |

### File Size Guidance

Canonical rule imported from `dev-architecture` §1: **>400 LOC -> split (DEFAULT)**.

| Range | Interpretation |
|-------|---------------|
| 200-400 lines | Healthy — easy to navigate and review |
| 400-500 lines | Should split unless the author states a concrete reason |
| >500 lines | Strong review signal; not a blocker by size alone. Accept a documented cohesion/risk rationale |
