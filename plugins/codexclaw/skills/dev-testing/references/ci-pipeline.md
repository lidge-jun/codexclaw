# CI Pipeline Templates
> Deep reference for `dev-testing` §5 CI Pipeline Integration.

## 1. Node.js Workflow Template

```yaml
name: node-test
on:
  push:
  pull_request:
concurrency:
  group: node-test-${{ github.ref }}
  cancel-in-progress: true
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
  test:
    needs: quality
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix: { node-version: [22, 24], shard: [1, 2, 3] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node-version }}, cache: npm }
      - run: npm ci
      - run: npx vitest run --coverage --shard=${{ matrix.shard }}/3
      - run: npm run test:contract
  e2e:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
```

## 2. Python Workflow Template

```yaml
name: python-test
on:
  push:
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        python-version: ["3.11", "3.12", "3.13"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
          cache: pip
      - run: pip install -r requirements-dev.txt
      - run: pytest --cov --cov-report=xml -n auto
      - run: pytest tests/contracts -q
      - run: pip-audit --strict
```

## 3. Matrix / Parallelization

| Axis | Include When | Example |
|------|--------------|---------|
| runtime versions | library or SDK compatibility matters | Node 22/24, Python 3.11-3.13 |
| OS | native modules or CLI behavior matter | ubuntu + macOS |
| shards | suites exceed CI budget | `1/4..4/4` |

```bash
npx vitest run --shard=2/4
npx playwright test --shard=2/4 --workers=4
pytest -n auto --dist=loadgroup
```

## 4. Coverage Reporting Integration

- publish `lcov.info` or `coverage.xml`
- upload junit / XML results for annotations
- keep contract reports separate from unit coverage
- fail the build when thresholds or diff coverage drop

## 5. Flaky Test Policy (canonical — `TEST-FLAKE-*`)

Canonical owner: `dev-testing`. Other skills carry pointer stubs only (see
`dev` `references/skill-ownership.md`). `dev-debugging` owns the diagnostic
method; this section owns the policy — what CI may do about a flake, and what
counts as closing one.

A flake is not a category of test. It is a defect that has not been diagnosed
yet, and every mechanism that makes CI green without diagnosing it is a way of
shipping that defect.

### 5.1 Eliminate the nondeterminism (`TEST-FLAKE-ELIMINATE-01`, STRICT)

A flaky test is a defect in the test or in the code under test. Diagnose the
source of nondeterminism and remove it. **A flake is closed when the cause is
named, not when the suite is green.**

| Signal | Cause to remove |
|--------|-----------------|
| intermittent timeout | implicit timing — wait on an observable condition or a fake clock |
| order-dependent failure | shared mutable state or fixture leakage between tests |
| CI-only HTTP failure | a live network dependency |
| snapshot variance | unpinned fonts, time, locale, or dynamic regions |
| passes alone, fails in the suite | resource contention or global state — isolate, then fix the sharing |

Fixing one instance is half the job: the same cause usually has siblings. After a
fix, search for other tests with the same missing cleanup or the same timing
assumption.

### 5.2 Re-running is not a resolution (`TEST-FLAKE-RERUN-01`, STRICT)

Re-running a failed job or test to obtain green is **not** a fix and is never
recorded as one. Raising a timeout until a test passes is the same violation
wearing a config change.

A re-run is permitted for exactly one purpose: measuring the failure RATE as
diagnostic input. When you use it that way, write the measurement down — "4 of 5
runs, 4 different tests" is evidence; "passed on retry" is not.

This is the CI-facing half of `TEST-ANTI-FLAKE-01` (`dev-testing` SKILL.md §1.5)
and `TEST-CI-GREEN-01` (§5.5). It exists as its own rule because the pressure to
re-run arrives precisely when a policy stated only as principle is easiest to
read past.

### 5.3 Quarantine is an exception with a cost (`TEST-FLAKE-QUARANTINE-01`, DEFAULT)

Quarantine is permitted only when the flake blocks unrelated delivery AND all
four of these are recorded in the same change:

1. the exact test name,
2. a named owner,
3. a removal deadline, and
4. the suspected cause.

A quarantine without a deadline is a deletion with extra steps. Quarantine never
closes the defect — it defers it, and the deadline is the receipt.

The exception exists deliberately. A policy with no usable escape hatch does not
eliminate the pressure that produces quarantine; it just relocates it into an
undocumented `.skip()`, which is worse because nobody is tracking it. The four
fields are the price of using the hatch honestly.

### 5.4 "Environmental" is a claim, not an observation (`TEST-FLAKE-ATTRIBUTION-01`, DEFAULT)

Before calling a failure environmental or pre-existing, prove it:

1. the identical failure reproduces on the untouched baseline,
2. no change in the current set touches that code, and
3. the matching CI job is green at the same SHA.

Without the triple it stays a candidate defect. This is the test-side mirror of
`DEVOPS-BASELINE-DEFECT-01` (`dev-devops` `references/ci-cd-deploy.md` §6.2),
and it is DEFAULT rather than STRICT because step 3 sometimes needs CI access an
agent does not have — in that case record the gap rather than asserting the
conclusion.

"It's flaky" is the single most common way a real defect reaches production. It
is also frequently true. That is exactly why it needs proof.

### 5.5 Counting greens

How many consecutive green runs make a flaky-capable suite trustworthy is a
release-gate question, not a remediation one: `DEVOPS-FLAKE-STABILITY-01` in
`dev-devops` `references/ci-cd-deploy.md` §6.5.

## 6. Recommended Job Order

```text
quality
→ backend / unit / integration
→ contract
→ e2e
→ security
→ coverage aggregation
```

## 7. Release Runtime vs Compatibility Matrix

Use the release runtime required by the publish mechanism for release jobs. For
example, npm Trusted Publishing requires a modern Node/npm pair, so release
examples should use Node 22 unless the project has a newer declared baseline.

Keep compatibility testing separate from release publishing:

| Matrix | Purpose | Example |
|---|---|---|
| Release runtime | Runtime used to build and publish artifacts | Node 22 for npm Trusted Publishing |
| Compatibility runtime | Extra supported versions the package promises to run on | Node 20 only when a project explicitly carries legacy/EOL support |
| OS smoke | Platform behavior for native modules, CLIs, installers, or shell shims | ubuntu, macOS, Windows for declared support |

Do not put legacy/EOL runtimes in generic release examples. If a project still
supports Node 20, label that lane as legacy compatibility and keep publish jobs
on the release runtime required by the registry or deployment target.

## 8. CLI Release Smoke Matrix

For CLI packages or native modules, matrix only the platforms the project
declares or the release claims to support. A Linux-only package does not need a
Windows smoke, but a cross-platform CLI claim needs runner evidence for each
declared platform.

Minimum smoke:

1. Install the packed artifact or published package.
2. Resolve the binary path.
3. Run `--version`.
4. Run `--help`.
5. Run one safe non-destructive command that touches platform-sensitive paths
   when the release depends on those paths.

CI matrix proof is enough for pure library/import behavior. For desktop,
installer, profile, permission, PATH, shell-shim, or visible OS behavior that CI
cannot observe, hand off to `dev-devops/references/cross-platform-release.md`.
