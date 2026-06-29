# Docker — Container Build & Security Patterns

Last reviewed: 2026-06-16
Applies to: Docker 27+, BuildKit, OCI images
When to read: Container build/deploy tasks
Canonical owner: dev-devops §1

Cross-ref: read `platform-engineering.md` for provider routing and release
capability framing; read `package-release.md` for package-registry auth.

---

## §1 Multi-Stage Build Templates

### Node.js (Bun)

```dockerfile
# syntax=docker/dockerfile:1
FROM oven/bun:1.2 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM gcr.io/distroless/nodejs22-debian12
COPY --from=build /app/dist /app
USER nonroot:nonroot
CMD ["app/server.js"]
```

### Node.js (npm)

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs22-debian12
COPY --from=build /app/dist /app
USER nonroot:nonroot
CMD ["app/server.js"]
```

### Python

```dockerfile
FROM python:3.13-slim AS build
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen
COPY . .

FROM python:3.13-slim
COPY --from=build /app /app
RUN adduser --system --no-create-home app
USER app
CMD ["python", "-m", "app"]
```

### Go

```dockerfile
FROM golang:1.25 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/app .

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/app /app
USER nonroot:nonroot
ENTRYPOINT ["/app"]
```

---

## §2 Docker Compose Development Patterns

```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_healthy }
    environment:
      DATABASE_URL: postgres://app:secret@db:5432/app_dev

  db:
    image: postgres:17
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: app_dev
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "app"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5

volumes:
  pgdata:
```

| Rule | Detail |
|------|--------|
| Health conditions | `depends_on: { condition: service_healthy }` — never bare `depends_on` |
| Volumes | Bind mount for source, named volume for DB data |
| Networks | `internal` for DB, `default` for app (optional explicit separation) |

---

## §3 Image Optimization

### Base Image Selection Tree

| Binary Type | Base Image | Size |
|-------------|-----------|------|
| Static binary (Go, Rust) | `scratch` or `distroless/static` | ~2MB |
| Node.js | `distroless/nodejs22-debian12` | ~130MB |
| Python | `python:3.13-slim` | ~150MB |
| General C/C++ | `distroless/cc-debian12` | ~20MB |

### .dockerignore Required Entries

```
.git
node_modules
dist/
coverage/
.env*
*.log
__pycache__/
.pytest_cache/
.mypy_cache/
*.pyc
.DS_Store
docker-compose*.yml
Dockerfile*
README*
```

### Layer Caching Order

1. Copy dependency manifests (`package.json`, `go.mod`, `pyproject.toml`)
2. Install dependencies (cached unless manifests change)
3. Copy source code
4. Build

---

## §4 Security Scanning CI Pipeline

### Trivy

```bash
# Scan image — fail on CRITICAL/HIGH
trivy image --severity CRITICAL,HIGH --exit-code 1 myapp:sha-123

# Generate SBOM
trivy image --format spdx-json --output sbom.spdx.json myapp:sha-123

# Scan with VEX filter (suppress known false positives)
trivy image --vex policy.vex.json myapp:sha-123
```

### Docker Scout

```bash
docker scout cves myapp:sha-123 --exit-code --only-severity critical,high
docker scout recommendations myapp:sha-123
```

### SBOM + Signing

```bash
# Generate SBOM with Syft
syft myapp:sha-123 -o spdx-json > sbom.spdx.json

# Sign image with Cosign
cosign sign --key cosign.key myapp@sha256:abc123...

# Attest SBOM
cosign attest --predicate sbom.spdx.json --type spdxjson myapp@sha256:abc123...

# Verify
cosign verify --key cosign.pub myapp@sha256:abc123...
```

---

## §5 BuildKit Secrets

BuildKit secrets are for private dependency install during image builds. Do
not reuse this pattern as the default for public package publishing. For npm,
PyPI, Bun-to-npm, Homebrew, and registry publish decisions, read
`references/package-release.md` first.

```dockerfile
# Mount secret at build time — never exposed in image layers
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) npm install
```

Build command:

```bash
docker build --secret id=npm_token,src=.npmrc .
```

| Banned | Fix |
|--------|-----|
| `ARG NPM_TOKEN=xxx` | `--mount=type=secret` |
| `COPY .env .` | Inject at runtime via env vars |
| `ENV SECRET=xxx` in Dockerfile | Runtime `--env` or secrets mount |

---

## §6 Anti-Patterns (Detailed)

| Banned | Why | Fix |
|--------|-----|-----|
| `FROM node:latest` | Irreproducible; breaks on major updates | Pin: `node:22-slim@sha256:...` |
| `USER root` in final image | Full host-equivalent privileges if container escapes | `USER nonroot:nonroot` or dedicated user |
| `COPY . .` before dependency install | Every source change invalidates dependency cache | Copy manifests first, install, then copy source |
| `apt-get install` without cleanup | 100MB+ wasted on package cache | `--no-install-recommends && rm -rf /var/lib/apt/lists/*` |
| No image scan in CI | Ship known CVEs to production | Trivy/Scout gate with `--exit-code 1` |
| `docker push` without signing | No supply chain verification | Cosign sign + attest |
| Multi-purpose single stage | Build tools in production image | Multi-stage: build → runtime |
