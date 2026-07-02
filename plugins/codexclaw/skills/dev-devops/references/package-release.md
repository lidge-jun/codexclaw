# Package Release — Trusted Publishing & Registry Auth

Last reviewed: 2026-07-02
Applies to: npm, PyPI, Bun-to-npm, Homebrew, crates.io, RubyGems, Go modules, GHCR, Docker Hub
When to read: Package publishing, release auth, downstream distribution, CLI package release
Canonical owner: dev-devops package-release guidance

Cross-ref: read `../../dev-security/references/supply-chain-sbom.md` for SBOM/signing depth.

---

## §1 Release Auth Decision Table

Pick the publish path by ecosystem and artifact type before asking for tokens.

| Target | Default path | Token fallback |
|---|---|---|
| npm public package | npm Trusted Publishing/OIDC from GitHub-hosted Actions; use Node 22 and npm 11.5.1+ | `NPM_TOKEN` only when OIDC is unsupported, rejected, or explicitly not configured |
| PyPI package | PyPI Trusted Publisher/OIDC with `pypa/gh-action-pypi-publish@release/v1` | `PYPI_TOKEN` only when Trusted Publisher is unsupported, rejected, or explicitly not configured |
| Bun project publishing to npm | Install/test/build with Bun; publish public npm packages with `npm publish` unless Bun OIDC support is proven in current docs | `NPM_CONFIG_TOKEN` only for explicit `bun publish` fallback |
| Homebrew Formula/Cask | Downstream channel after canonical upstream release exists | GitHub/token auth only for tap automation; never replaces upstream provenance |
| crates.io | Trusted Publishing/OIDC when configured | crates.io API token only when trusted publishing is unavailable |
| RubyGems | Trusted Publishing/OIDC with `rubygems/release-gem` when configured | `RUBYGEMS_API_KEY` only when trusted publishing is unavailable |
| Go modules | VCS tag release; no central registry publish token | Host credentials only for creating tags/releases |
| GHCR | GitHub Actions `GITHUB_TOKEN` with `packages: write` for repository packages | PAT only for cross-repo/private cases that `GITHUB_TOKEN` cannot cover |
| Docker Hub | Docker access token via `docker/login-action` | No OIDC default for ordinary Docker Hub push; use least-scoped token |

## §2 Auth Model Classes

| Class | Examples | Rule |
|---|---|---|
| Registry-native trusted publishing | npm, PyPI, RubyGems, crates.io | Prefer OIDC/trusted publishing before long-lived tokens |
| Cloud IAM federation | AWS ECR, Google Artifact Registry, Azure Container Registry | OIDC authenticates to cloud IAM; registry push uses cloud-issued temporary credentials |
| Repository-scoped CI token | GHCR through `GITHUB_TOKEN` | Prefer built-in short-lived CI token when it has enough scope |
| VCS tag release | Go modules | Verify tags and module paths, not registry credentials |
| Long-lived registry token | Docker Hub, unsupported fallback cases | Require explicit justification, least scope, and rotation owner |

## §3 npm Trusted Publishing

Default for public npm packages released from GitHub Actions:

```yaml
name: publish
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm publish --provenance
```

Rules:

- State in prose that npm Trusted Publishing requires Node 22.14+ and npm
  11.5.1+.
- Use GitHub-hosted runners unless the current npm docs support the alternate
  runner.
- Do not ask for `NPM_TOKEN` until trusted publishing is unsupported or rejected.
- For private dependency install inside Docker builds, use BuildKit secrets;
  that is not the same as public package publishing.

## §4 PyPI Trusted Publisher

Default for PyPI release from GitHub Actions:

```yaml
name: publish
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: pypi
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.13'
      - run: python -m build
      - uses: pypa/gh-action-pypi-publish@release/v1
```

Rules:

- Do not pass username/password/API token in the trusted-publisher job.
- Prefer a GitHub Environment for publish approval and PyPI publisher binding.
- If using `uv publish` inside a trusted publisher environment, credentials do
  not need to be set; token auth is a non-trusted fallback.

## §5 Bun-to-npm

Use Bun for project-native install, test, and build:

```yaml
- uses: oven-sh/setup-bun@v2
- run: bun install --frozen-lockfile
- run: bun test
- run: bun run build
```

For public npm registry publishing with OIDC, switch to Node/npm for the publish
step unless current Bun docs prove equivalent trusted-publishing support:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '22'
    registry-url: https://registry.npmjs.org
- run: npm publish --provenance
```

`bun publish` is acceptable only for dry-run/package inspection or for an
explicit token fallback path after documenting why npm Trusted Publishing is not
used.

## §6 Downstream and Container Channels

| Channel | Guidance |
|---|---|
| Homebrew | Downstream distribution after canonical artifact exists; read `homebrew.md` for Formula/Cask detail |
| GHCR | Use `GITHUB_TOKEN` with `packages: write` for same-repo packages |
| Docker Hub | Use Docker access token; rotate and scope it because ordinary Docker Hub push is token-first |
| ECR/GAR/ACR | Treat as cloud IAM federation, not registry-native trusted publishing |

## §7 Release Proof Bundle

Every package-release answer should collect:

- registry and artifact type;
- chosen auth model and fallback reason if a token is used;
- release runtime version and compatibility matrix distinction;
- provenance/SBOM/signing evidence or explicit reason it does not apply;
- install smoke command for published package or packed artifact;
- downstream channel alignment when Homebrew, containers, or tags are involved.
