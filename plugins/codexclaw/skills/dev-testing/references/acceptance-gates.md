## 7. Accessibility Testing
### Component, Page, and CI Gates
- Run axe-core through jest-axe or vitest-axe on rendered components.
- Run `@axe-core/playwright` across every changed or critical route.
- Verify keyboard operation, visible focus, focus order, and focus restoration manually.
- Gate order: component axe -> page axe -> keyboard/focus checks.
- Block serious/critical axe violations; keep Lighthouse scores advisory.
### Observability Verification

Verify trace propagation in integration tests. Assert that spans appear for critical paths. Check structured log format matches the schema in `../../dev-backend/references/core/observability.md`.

---

## 8. Security Testing
**→ Delegated**: threat modeling and secure design policy belong to `dev-security`.
This section covers the **automated test hooks and CI gates** that enforce those rules.
`fast checks -> SAST -> dependency audit -> auth/validation regressions`
Use the repository's pinned audit and SAST products; detailed product setup belongs in
the security-testing reference or CI owner, not this router.
Test missing/insufficient auth and contract error codes on protected endpoints.
- Run dependency audit and SAST in CI.
- Add auth, permission, malicious-input, and malformed-input regressions.
- Block policy-defined high/critical findings; exceptions require owner and expiry.
## 9. Coverage & Quality Gates
### 9.1 Suggested Thresholds
These are project/risk-based, not universal minimums. Adjust for your context.

| Metric | Suggested Floor | Ideal |
|--------|-----------------|-------|
| Line coverage | 70% | 85%+ |
| Branch coverage | 60% | 80%+ |
| Function coverage | 80% | 90%+ |
| Diff coverage | 80% | 90%+ |
### 9.2 Outcome Metrics
| Metric | Target |
|--------|--------|
| Defect detection rate | > 80% |
| Mean time to detect | < 1 CI run |
| Test signal-to-noise | > 95% |
| Contract drift rate | near 0 |
### 9.3 Coverage Workflow
1. generate coverage reports
   ```bash
   npm test -- --coverage
   npx vitest run --coverage
   pytest --cov --cov-report=xml
   ```
2. review by priority: auth, payment, mutations, upload, contracts first
3. write targeted tests for the gaps
4. publish artifacts and fail the merge when thresholds drop
### 9.4 Quality Gate Checklist
- [ ] focused unit / service tests
- [ ] API integration tests for changed routes
- [ ] contract tests for shared payload changes
- [ ] Playwright smoke for critical rendered journeys
- [ ] security scan / dependency scan
- [ ] coverage thresholds and diff coverage
- [ ] CI artifacts uploaded for failure analysis
---
## 10. Pre-Flight Test Checklist
Choose the smallest checklist that covers the work class and changed boundaries:
- [ ] C0/C1: focused test or smallest proof; no unrelated broad suite.
- [ ] C2: targeted unit/service plus affected API, contract, or rendered smoke.
- [ ] C3: affected suites, boundary negatives, contracts, and integration evidence.
- [ ] C4/release: full gates, security/data negatives, rollback or smoke proof.
- [ ] Fixtures are deterministic; real dependencies cover correctness-sensitive paths.
- [ ] External calls are intentionally mocked/recorded; no accidental live traffic.
- [ ] Changed errors/data contracts are asserted; shared fixtures remain synchronized.
- [ ] Flakes are diagnosed, not accepted through retry.
- [ ] CI jobs actually run and failure artifacts are retained.
- [ ] `ENFORCE_TDD` evidence exists when enabled.
- [ ] Coverage and security thresholds match repository policy.
