# Supply Chain Security: SBOM, Signing & Dependency Integrity

Last reviewed: 2026-06-16
Applies to: npm, PyPI, container images, CI/CD pipelines
When to read: Dependency auditing, release integrity, SBOM generation
Canonical owner: dev-security

Cross-ref: `dev-devops` docker.md §1.3 (container image scanning), `dev-security` §7 (Static Analysis Integration)
Package release auth defaults live in `dev-devops/references/package-release.md`.
For public package publishing, prefer registry-native trusted publishing/OIDC
where supported; long-lived publish tokens require an explicit fallback reason.

## 1. SBOM Generation

A Software Bill of Materials (SBOM) is a machine-readable inventory of every component in a build artifact.

| Tool | Format | Use When |
|------|--------|----------|
| Syft (Anchore) | CycloneDX, SPDX | Container images, language packages — broadest format support |
| Trivy (Aqua) | CycloneDX, SPDX | Combined SBOM + vulnerability scan in one pass |
| `npm sbom` | CycloneDX, SPDX | Node.js projects — built into npm 10+ |
| CycloneDX CLI | CycloneDX | When you need CycloneDX specifically for compliance |

```bash
# Generate SBOM from container image
syft myapp:v1.2.3 -o cyclonedx-json > sbom.cdx.json

# Generate SBOM from npm project
npm sbom --sbom-format cyclonedx

# Combined scan + SBOM
trivy image myapp:v1.2.3 --format cyclonedx --output sbom.cdx.json
```

Rules:
- Generate SBOM for every release artifact (container image, package, binary).
- Store SBOMs alongside release artifacts — they are part of the release, not documentation.
- Use CycloneDX 1.5+ for best tooling support; SPDX 2.3 when required by compliance.
- Regenerate SBOM on every build — do not cache across dependency changes.

## 2. Artifact Signing & Provenance

Sign artifacts to prove they came from your CI pipeline, not a compromised mirror:

| Tool | Signs | Verification |
|------|-------|-------------|
| Cosign (Sigstore) | Container images, blobs | `cosign verify --key cosign.pub <image>` |
| npm provenance | npm packages | `npm publish --provenance` (requires OIDC-capable CI) |
| SLSA (Supply-chain Levels for Software Artifacts) | Build provenance attestation | Verifiable build metadata: who built, from what source, with what builder |

```bash
# Sign container image with keyless Cosign (Sigstore)
cosign sign --yes ghcr.io/org/myapp:v1.2.3

# Verify signature
cosign verify ghcr.io/org/myapp:v1.2.3 \
  --certificate-identity="https://github.com/org/myapp/.github/workflows/release.yml@refs/tags/v1.2.3" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com"

# npm publish with provenance
npm publish --provenance
```

| SLSA Level | Requirement | Practical Meaning |
|------------|------------|-------------------|
| Level 1 | Build process documented | CI config exists and is version-controlled |
| Level 2 | Hosted build, signed provenance | CI generates and signs provenance attestation |
| Level 3 | Hardened build platform | Isolated, ephemeral builders with tamper-evident logs |

Rules:
- Sign all container images pushed to production registries.
- Use keyless signing (Sigstore OIDC) in CI — no long-lived signing keys.
- npm packages from CI should use `--provenance` for transparent build attestation.
- Verify signatures in deployment pipelines before pulling images.
- Target SLSA Level 2 minimum for production artifacts.

### Public Package Trusted Publishing

For public package release from CI, default to registry-native trusted
publishing/OIDC where the registry supports it:

| Registry | Default | Token fallback only when |
|---|---|---|
| npm | npm Trusted Publishing/OIDC with provenance | Trusted Publishing is unsupported, rejected, or not configured |
| PyPI | PyPI Trusted Publisher/OIDC | Trusted Publisher is unsupported, rejected, or not configured |
| RubyGems | RubyGems Trusted Publishing/OIDC | Trusted Publishing is unsupported, rejected, or not configured |
| crates.io | crates.io Trusted Publishing/OIDC when configured | Trusted Publishing is unavailable for the crate/CI |

Do not ask for `NPM_TOKEN`, `PYPI_TOKEN`, `RUBYGEMS_API_KEY`, or a crates.io API
token before checking whether a trusted publishing path exists. Token fallback
must be named in the release proof bundle so reviewers know why OIDC was not
used.

## 3. Dependency Pin & Audit CI

| Practice | Required | Tool |
|----------|----------|------|
| Lockfile committed | Yes | `package-lock.json`, `bun.lock`, `poetry.lock`, `go.sum` |
| `--frozen-lockfile` in CI | Yes | `npm ci`, `bun install --frozen-lockfile`, `poetry install --no-update` |
| Dependency audit in CI | Yes | `npm audit`, `pip-audit`, `trivy fs .`, `osv-scanner` |
| Automated update PRs | Recommended | Renovate (preferred) or Dependabot with auto-merge for patch/minor |
| License compliance | When required | `license-checker`, `pip-licenses`, Trivy license scan |

```yaml
# CI dependency audit step (GitHub Actions example)
- name: Dependency audit
  run: |
    npm audit --audit-level=high
    # or: trivy fs . --severity HIGH,CRITICAL --exit-code 1
```

Rules:
- CI must fail on HIGH/CRITICAL vulnerability findings.
- Pin exact versions in lockfile — range specifiers (`^`, `~`) in `package.json` are fine if lockfile is committed and CI uses frozen install.
- Review lockfile diffs in PRs — unexpected resolution changes may indicate supply chain attack.
- Update dependencies at least monthly; security patches within 48 hours of advisory.
- New dependencies require justification — check bundle size, maintenance status, and security history.

## 4. Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| No lockfile in repo | Non-reproducible builds, phantom dependency updates | Commit lockfile, CI uses `--frozen-lockfile` |
| `npm install` in CI instead of `npm ci` | Lockfile ignored, dependencies can drift | Use `npm ci` / `bun install --frozen-lockfile` |
| Ignoring `npm audit` output | Known vulnerabilities ship to production | CI fails on HIGH+ findings; track exceptions with expiry |
| Unsigned container images | No provenance verification possible | Sign with Cosign in CI (§2) |
| SBOM generated once, never updated | Stale inventory, false compliance | Regenerate on every release build (§1) |
| Long-lived signing keys | Key compromise = all artifacts compromised | Use keyless signing (Sigstore OIDC) |

## Pre-flight

- [ ] SBOM generated for every release artifact in CycloneDX or SPDX format (§1)
- [ ] Container images signed with Cosign/Sigstore in CI (§2)
- [ ] npm packages published with `--provenance` from CI (§2)
- [ ] Lockfile committed and CI uses frozen install (§3)
- [ ] `npm audit` / `trivy fs` runs in CI with HIGH+ failure threshold (§3)
- [ ] Dependency update automation configured (Renovate/Dependabot) (§3)
