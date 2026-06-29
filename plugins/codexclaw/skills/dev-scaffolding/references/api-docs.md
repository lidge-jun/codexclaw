# API Documentation Generation

## 1. OpenAPI 3.1 Generation

Two approaches — pick one per project and enforce consistently:

| Approach | When to Use | Tools |
|----------|-------------|-------|
| **Code-first** | API already exists, types are the source of truth | `@nestjs/swagger` 8.x, `drf-spectacular` 0.28+, `FastAPI` (built-in), `tsoa` 6.x |
| **Spec-first** | API contract must be agreed before implementation | `openapi-generator-cli` 7.x, Stoplight Studio, Redocly CLI |

```typescript
// Code-first example: NestJS + @nestjs/swagger
@ApiTags('users')
@Controller('users')
export class UsersController {
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, type: UserDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return this.usersService.findOne(id);
  }
}
```

```python
# Code-first example: drf-spectacular
@extend_schema(
    responses={200: UserSerializer, 404: ErrorSerializer},
    tags=["users"],
)
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
```

**Version pinning**: OpenAPI spec version MUST be `3.1.0`. Pin generator CLI versions in `package.json` or CI config — never use `@latest`.

## 2. Developer Portal Structure

```
docs/api/
├── index.html          # Redoc or Scalar UI entry
├── openapi.yaml        # Generated spec (single source of truth)
├── guides/
│   ├── authentication.md
│   ├── pagination.md
│   ├── error-handling.md
│   └── rate-limiting.md
├── examples/
│   ├── curl/           # Copy-pasteable curl commands
│   └── sdk/            # Language-specific snippets
└── changelog.md        # API-level changelog (not app changelog)
```

| Portal Tool | License | Best For |
|-------------|---------|----------|
| **Scalar** 1.x | MIT | Modern UI, try-it-out, OpenAPI 3.1 native |
| **Redoc** 2.x | MIT | Clean reference docs, wide adoption |
| **Stoplight Elements** | Apache-2.0 | Embedded component, design-system friendly |

MUST include: authentication guide, error code table, rate limit documentation, pagination pattern.

## 3. CI Doc Drift Detection

Spec and implementation MUST stay in sync. Detect drift in CI:

```yaml
# GitHub Actions example
- name: Check OpenAPI spec drift
  run: |
    # Generate fresh spec from code
    bun run generate:openapi -- --output /tmp/fresh-spec.yaml

    # Compare against committed spec
    npx oasdiff diff docs/api/openapi.yaml /tmp/fresh-spec.yaml \
      --fail-on ERR \
      --format text

    # Check for breaking changes
    npx oasdiff breaking docs/api/openapi.yaml /tmp/fresh-spec.yaml \
      --fail-on ERR
```

| Tool | Purpose | Version |
|------|---------|---------|
| `oasdiff` 1.x | Diff + breaking change detection | Pin in CI |
| `spectral` 6.x | OpenAPI linting rules | Pin in CI |
| `vacuum` 0.14+ | Fast OpenAPI linting (Go, faster than spectral) | Pin in CI |

```bash
# Spectral linting in CI
npx spectral lint docs/api/openapi.yaml --ruleset .spectral.yaml --fail-severity warn
```

Breaking change policy: removing an endpoint, removing a required response field, or changing a field type is a **breaking change** — requires major version bump and 90-day deprecation notice.

## 4. SDK Generation

Generate typed clients from the OpenAPI spec — never hand-write API clients:

| Language | Generator | Output |
|----------|-----------|--------|
| TypeScript | `openapi-typescript` 7.x + `openapi-fetch` 0.13+ | Zero-runtime types + fetch client |
| TypeScript (React Query) | `orval` 7.x | React Query hooks + Zod validation |
| Python | `openapi-python-client` 0.22+ | Pydantic models + httpx client |
| Go | `oapi-codegen` 2.x | Typed structs + chi/echo handlers |

```bash
# openapi-typescript: generate types from spec
npx openapi-typescript docs/api/openapi.yaml -o src/api/schema.d.ts

# orval: generate React Query hooks
npx orval --config orval.config.ts
```

SDK generation runs in CI after spec validation passes. Commit generated files — do not generate at runtime.

## 5. Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| Hand-written API clients | Drift from spec, type mismatches | Generate from OpenAPI spec (§4) |
| Spec committed but never validated in CI | Spec rots silently | Add oasdiff + spectral to CI (§3) |
| `@latest` for generator CLIs | Non-reproducible builds | Pin exact version in package.json / CI |
| API docs on wiki/Notion only | Docs drift from code within days | Co-locate in repo, generate from code/spec |
| Missing error response schemas | Clients cannot handle errors properly | Document every 4xx/5xx with response schema |

## Pre-flight

- [ ] OpenAPI spec is version `3.1.0` and validates with spectral/vacuum
- [ ] CI pipeline includes spec drift detection (oasdiff or equivalent)
- [ ] Breaking change policy is documented and enforced in CI
- [ ] SDK generation is automated from spec, not hand-written
- [ ] Developer portal includes auth guide, error codes, pagination, rate limits
- [ ] Generator CLI versions are pinned (no `@latest`)

## 6. Cross-References

- **API design patterns**: `dev-backend/references/core/api-design.md`
- **API lifecycle & deprecation**: `dev-backend/references/core/api-lifecycle.md` (Wave 1)
- **Health checks**: `dev-backend/references/core/health-checks.md`
- **CI/CD pipeline integration**: `dev-devops` (Wave 2)
