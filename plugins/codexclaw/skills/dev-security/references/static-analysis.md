# Static Analysis and Security Tooling

Security tooling belongs inside the development loop: write code, scan locally, fix findings, scan again, then let CI enforce the same baseline.

## Tool Matrix

| Tool | Primary Use | Best For |
| --- | --- | --- |
| Semgrep | Pattern-based SAST | Fast feedback and custom secure-coding rules |
| CodeQL | Semantic analysis | Data-flow issues and GitHub code scanning |
| `eslint-plugin-security` | JS and TS lint-time rules | Eval, regex, child process, object injection warnings |
| `npm audit` | Node dependency audit | Registry-known package vulnerabilities |
| `pip-audit` | Python dependency audit | Pinned dependency vulnerability checks |
| Bandit | Python code scanning | Deserialization, subprocess, weak crypto |
| gitleaks | Secret scanning | Keys, tokens, passwords in working tree and history |

## Semgrep

```bash
semgrep --config=auto .
semgrep --config=p/owasp .
semgrep --config=p/trailofbits .
```

Custom rule example:
```yaml
rules:
  - id: no-raw-query-unsafe
    message: Avoid unsafe raw SQL execution.
    languages: [javascript, typescript]
    severity: ERROR
    patterns:
      - pattern: $DB.$QUERY($SQL)
      - metavariable-regex:
          metavariable: $QUERY
          regex: '.*Unsafe$'
```

## CodeQL

```yaml
name: codeql
on:
  pull_request:
  push:
    branches: [main, agent]

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: github/codeql-action/init@6bb031f19398d5e737441fa72f52dc95012a9e8a
        with:
          languages: javascript-typescript, python, go
      - uses: github/codeql-action/autobuild@6bb031f19398d5e737441fa72f52dc95012a9e8a
      - uses: github/codeql-action/analyze@6bb031f19398d5e737441fa72f52dc95012a9e8a
```

## ESLint Security Plugin

```bash
npm install --save-dev eslint-plugin-security
```

```js
module.exports = {
  extends: ['eslint:recommended'],
  plugins: ['security'],
  rules: {
    'security/detect-eval-with-expression': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-non-literal-fs-filename': 'warn',
  },
};
```

## Dependency Audits

```bash
npm audit --audit-level=high
pip-audit
python -m bandit -q -r .
govulncheck ./...
```

Rules:
- Fail CI on high or critical findings unless an exception is documented.
- Prefer upgrades, pins, or package replacement over suppressing the alert.
- Re-run audits after dependency changes, not only before release.

## Bandit

```bash
bandit -q -r .
bandit -q -r app tests scripts
```

## Gitleaks

```bash
gitleaks detect --source=. --no-git
gitleaks protect --staged --verbose
```

Use `detect` for repository scans and `protect --staged` in hooks.

## Pre-commit Hook

Use a repo-local hook when pre-commit is not standardized.

```bash
#!/usr/bin/env bash
set -euo pipefail

gitleaks protect --staged --verbose
semgrep --config=auto .
if [ -f package.json ]; then
  npm audit --audit-level=high
fi
if [ -f requirements.txt ] || [ -f pyproject.toml ]; then
  pip-audit
  bandit -q -r .
fi
```

## GitHub Actions Security Pipeline

```yaml
name: security
on:
  pull_request:
  push:
    branches: [agent]

jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8
        if: hashFiles('package-lock.json') != ''
        with:
          node-version: '22'
      - uses: actions/setup-python@42375524ce98b5c2f38de1235a9ff8635e4d5d80
        if: hashFiles('requirements.txt', 'pyproject.toml') != ''
        with:
          python-version: '3.12'
      - run: npm ci
        if: hashFiles('package-lock.json') != ''
      - run: npm audit --audit-level=high
        if: hashFiles('package-lock.json') != ''
      - run: python -m pip install pip-audit bandit semgrep
        if: hashFiles('requirements.txt', 'pyproject.toml') != ''
      - run: pip-audit
        if: hashFiles('requirements.txt', 'pyproject.toml') != ''
      - run: bandit -q -r .
        if: hashFiles('requirements.txt', 'pyproject.toml') != ''
      - run: semgrep --config=auto .
      - run: gitleaks detect --source=. --no-git
```

## Recommended Gate by Stack

- JavaScript and TypeScript: ESLint security plugin, Semgrep, `npm audit`, gitleaks.
- Python: Bandit, Semgrep, `pip-audit`, gitleaks.
- Go: `govulncheck`, Semgrep, gitleaks.
- Polyglot repositories: CodeQL plus the language-native tools above.

Use this file with `dev-testing` for blocking CI gates and with `dev-code-reviewer` for review-start criteria.
