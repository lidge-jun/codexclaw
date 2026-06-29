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

## 5. Flaky Test Quarantine Strategy

1. detect the flaky test by exact name
2. move it to a quarantine tag or job
3. keep quarantine non-blocking but visible
4. assign an owner and removal deadline
5. restore only after repeated green runs

| Signal | Action |
|--------|--------|
| intermittent timeout | replace implicit timing with deterministic waits |
| order-dependent failure | reset shared state or fixture leakage |
| CI-only HTTP failure | remove live network dependency |
| snapshot variance | stabilize fonts, time, locale, and dynamic regions |

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
