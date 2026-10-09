## 1. Test Strategy
### 1.1 Models
| Model | Best For | Emphasis |
|-------|----------|----------|
| Test Pyramid | monoliths, libraries | speed, isolation |
| **Testing Trophy** | modern web apps, REST backends | confidence-to-cost |
| Test Honeycomb | microservices, async systems | boundary verification |

### 1.2 Recommended Trophy Distribution
| Layer | Default Share | Typical Tools |
|-------|---------------|---------------|
| Static analysis | base layer | `tsc`, ESLint, mypy, Ruff |
| Unit | ~25% | Vitest, Jest, pytest |
| **Integration** | **~50%** | Supertest, httpx, Testcontainers |
| Contract | ~10% | Pact, OpenAPI validators, Schemathesis |
| E2E | ~10% | Playwright |
| Manual / exploratory | ~5% | human review |

### 1.5 General Rules
- Write tests for **new features, bug fixes, refactors, and behavior changes**.
- Prefer **one behavioral concern per test**.
- Use factories / builders for setup; avoid repeated inline blobs.
- A fast real dependency beats a mock. A mock beats an untested branch.
- If the failure is mysterious, **delegate methodology to `dev-debugging`**, then return here for the regression harness.
- **STRICT (TEST-ANTI-FLAKE-01):** A time-based flake is a bug. Do not use sleep-based synchronization, retry-as-fix, or green-on-retry acceptance without a deterministic cause and harness correction. Full policy: `ci-pipeline.md` §5 (`TEST-FLAKE-*`).
- Verification depth follows `dev` §3 `DEV-VERIFY-FLOOR-01`; CRUD per-operation negative coverage is owned by `core/crud-test-matrix.md`.
