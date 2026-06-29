# Backend Testing Patterns

> Deep reference for `dev-testing` §2 Backend & API Testing.

## 1. Vitest Service Layer Pattern

```typescript
import { describe, it, expect, vi } from 'vitest';
import { InvoiceService } from '../src/services/invoice.service';

describe('InvoiceService.finalize', () => {
  it('marks invoice paid and emits a domain event', async () => {
    const repo = {
      getById: vi.fn().mockResolvedValue({ id: 'inv_1', status: 'draft', amount: 5000 }),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const service = new InvoiceService({ repo, events });

    const result = await service.finalize('inv_1');

    expect(result.status).toBe('paid');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid' }));
    expect(events.publish).toHaveBeenCalledWith('invoice.paid', expect.any(Object));
  });
});
```

## 2. pytest Fixture Pattern

```python
import pytest
from unittest.mock import AsyncMock
from app.services.invoice_service import InvoiceService

@pytest.fixture
def repo():
    fake = AsyncMock()
    fake.get_by_id.return_value = {"id": "inv_1", "status": "draft", "amount": 5000}
    return fake

@pytest.fixture
def events():
    return AsyncMock()

@pytest.mark.asyncio
async def test_finalize_marks_invoice_paid(repo, events):
    service = InvoiceService(repo=repo, events=events)

    result = await service.finalize("inv_1")

    assert result["status"] == "paid"
    repo.save.assert_awaited_once()
    events.publish.assert_awaited_once()
```

## 3. Database Testing with Testcontainers

### TypeScript

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let pg: Awaited<ReturnType<PostgreSqlContainer['start']>>;

beforeAll(async () => {
  pg = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env.DATABASE_URL = pg.getConnectionUri();
  await runMigrations(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await pg.stop();
});
```

### Python

```python
import pytest
from testcontainers.postgres import PostgresContainer

@pytest.fixture(scope="session")
def pg_url():
    with PostgresContainer("postgres:16-alpine") as container:
        yield container.get_connection_url()

@pytest.fixture(scope="session", autouse=True)
async def migrated_db(pg_url):
    await run_migrations(pg_url)
```

Use a real DB for migrations, transactions, unique constraints, foreign keys, ORM query translation, and pagination semantics.

## 4. API Harness Examples

### Supertest

```typescript
import request from 'supertest';

it('returns the shared error envelope', async () => {
  const response = await request(app).post('/api/login').send({ email: 'bad' });
  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({
    success: false,
    error: { code: 'VALIDATION_ERROR' },
    meta: expect.any(Object),
  });
});
```

### httpx

```python
@pytest.mark.asyncio
async def test_login_returns_shared_error_envelope(client):
    response = await client.post('/api/login', json={"email": "bad"})
    body = response.json()
    assert response.status_code == 400
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["meta"]
```

## 5. Mock vs Real Decision Matrix

| Dependency | Preferred Choice | Why | Acceptable Fallback |
|------------|------------------|-----|---------------------|
| Pure domain helper | real | fast and deterministic | none needed |
| Repository during service test | fake / stub | isolate orchestration | framework mock |
| Real SQL behavior | Testcontainers DB | catches schema drift | in-memory DB only if semantics match |
| External HTTP API | recorded response / fake server | deterministic and cheap | mock adapter |
| Queue / pubsub boundary | fake adapter + retry assertions | verify interaction and payload | framework mock |
| Clock / UUID | fake clock / injected generator | stable determinism | monkeypatch |

## 6. Practical Rules

- Prefer factories over long inline objects.
- Keep fixtures local unless many tests truly share them.
- Roll back DB state between tests when possible.
- Assert machine-readable error codes, not only text messages.
- Pair backend API tests with contract verification when frontend depends on payload shape.
