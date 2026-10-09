### 1.6 Property-Based & Mutation Testing (verified 2026-07-02)

| Technique | Use for | Default tools | When |
|-----------|---------|---------------|------|
| Property-based | Pure logic, parsers, serializers, state machines, API invariants | fast-check (TS), Hypothesis (Python) | DEFAULT for invariant-heavy code |
| Mutation | Judging test-suite strength on critical logic/validators/security branches | Stryker (JS/TS), mutmut (Python) | Selective, after stable unit/property tests |

- Vitest 4 is the current runner baseline: Browser Mode is stable (visual regression `toMatchScreenshot`, Playwright trace generation, `expect.schemaMatching`).
