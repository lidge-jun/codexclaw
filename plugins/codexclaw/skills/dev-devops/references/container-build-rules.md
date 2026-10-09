## §1 Container Builds

### §1.1 Dockerfile Rules (STRICT)

| Rule | Detail |
|------|--------|
| Multi-stage | Separate build and runtime stages; final image has no build tools |
| Base image | Pin version + SHA256 digest: `node:22-slim@sha256:abc...` |
| Distroless | Prefer `gcr.io/distroless/*` for runtime; no shell, no package manager |
| Non-root | `USER nonroot:nonroot` (distroless) or create dedicated user |
| Dependency-first copy | `COPY package.json bun.lock ./` → install → `COPY . .` for layer caching |
| BuildKit secrets | `RUN --mount=type=secret,id=token ...` — never use `ARG` for secrets |
| `.dockerignore` | `.git`, `node_modules`, `.env*`, `*.log`, `dist/`, `coverage/`, `__pycache__/` |

For canonical Dockerfile templates, read `docker.md` §1.

### §1.2 Image Security (STRICT)

CRITICAL/HIGH image findings block push under this image policy. General checklist
exception language does not waive this gate: changing it needs a separately approved,
predeclared security policy, never an exception invented in the failing release report. Read
`docker.md` §4 for scan/SBOM/sign command examples, and
`../../dev-security/references/supply-chain-sbom.md` for deeper SBOM/signing
policy.

### §1.3 Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| `FROM node:latest` | Irreproducible builds | Pinned version + digest |
| `USER root` in final stage | Attack surface | Non-root user |
| `COPY . .` as first instruction | Cache invalidation on every change | Dependency files first |
| `ARG SECRET=xxx` | Exposed in image history | BuildKit `--mount=type=secret` |
| No scan before push | Vulnerable images in prod | Trivy/Scout CI gate |
| `apt-get install` without cleanup | Bloated image | `--no-install-recommends && rm -rf /var/lib/apt/lists/*` |
