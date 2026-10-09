## 5. CI Pipeline Integration
> Full workflow templates: `ci-pipeline.md`
### 5.1 Pipeline Order
`quality -> unit/integration -> contract -> Playwright E2E -> security -> coverage/artifacts`
See `ci-pipeline.md` for job dependencies, concurrency, matrices, sharding,
Playwright dependencies, and full GitHub Actions/GitLab CI templates.
Matrix only across supported runtimes, required OS behavior, or suites exceeding CI budget.
### 5.4 Flaky Test Remediation
A flake is a defect, not a category of test. `TEST-FLAKE-ELIMINATE-01`,
`TEST-FLAKE-RERUN-01`, `TEST-FLAKE-QUARANTINE-01`, and
`TEST-FLAKE-ATTRIBUTION-01` are canonical in `ci-pipeline.md` §5 —
read it before treating any flake, including deciding whether one is
"environmental".
### 5.5 CI-Green Loop
**STRICT (TEST-CI-GREEN-01):** Latest HEAD is the source of truth. Inspect the
failing job and artifacts before editing, make the minimal correct fix, run local
verification when it reduces next-fail risk, then re-watch the latest HEAD.
Repeat until green; never blind-retry a failed job or push another change without
new failure evidence.
### 5.6 Rules
- Do not let Playwright be the **only** blocking job.
- Contract tests should run **before** browser tests.
- Upload artifacts for failures: coverage, junit, traces, screenshots.
- Fail the build on broken thresholds, not only test exit codes.
