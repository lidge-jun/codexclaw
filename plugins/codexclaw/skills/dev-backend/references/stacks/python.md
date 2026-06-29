# Python Backend

Stack-specific rules for Python backend projects.
Extends core rules with FastAPI/Django patterns, Pydantic validation, async patterns.

---

## Framework Selection

| Framework | Best For                      | Async   |
| --------- | ----------------------------- | ------- |
| FastAPI   | APIs, performance, modern     | Native  |
| Django    | Full-featured, admin, ORM     | Limited |
| Flask     | Lightweight, microservices    | Via ext |
| Litestar  | High performance, type-native | Native  |

Default: **FastAPI** for APIs, **Django** for full-stack web apps.

---

## Project Setup (FastAPI)

```bash
# Modern Python project
uv init my-api
cd my-api
uv add fastapi uvicorn pydantic sqlalchemy alembic
uv add --dev pytest httpx ruff mypy

# pyproject.toml
[tool.ruff]
line-length = 88
target-version = "py312"

[tool.mypy]
strict = true
```

**Mandatory**: Type hints on ALL function params and returns.

---

## Input Validation with Pydantic

```python
from pydantic import BaseModel, EmailStr, Field

class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
    age: int | None = Field(default=None, ge=1, le=150)

    model_config = {"extra": "forbid"}  # reject unknown fields

# In route
@app.post("/api/users", status_code=201)
async def create_user(data: CreateUserRequest) -> UserResponse:
    user = await user_service.create(data.model_dump())
    return UserResponse.model_validate(user)
```

---

## Error Handling Pattern

```python
from fastapi import HTTPException
from fastapi.responses import JSONResponse

class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: list | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details

@app.exception_handler(AppError)
async def app_error_handler(request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {"code": exc.code, "message": exc.message, "details": exc.details},
            "meta": {"requestId": request.state.request_id},
        },
    )
```

---

## Async Patterns

```python
# ✅ GOOD — concurrent I/O
import asyncio

async def get_dashboard(user_id: str):
    profile, orders, notifications = await asyncio.gather(
        user_service.get_profile(user_id),
        order_service.get_recent(user_id),
        notification_service.get_unread(user_id),
    )
    return {"profile": profile, "orders": orders, "notifications": notifications}

# ❌ BAD — blocking the event loop
import time
time.sleep(5)  # Use asyncio.sleep(5) instead

# ❌ BAD — sequential when parallel is possible
profile = await user_service.get_profile(user_id)
orders = await order_service.get_recent(user_id)  # waits for profile unnecessarily
```

---

## Database Access (SQLAlchemy 2.0+)

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(settings.DATABASE_URL)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# Repository pattern
class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def find_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
```

---

## Testing

```bash
# pytest + httpx for API testing
uv add --dev pytest-asyncio httpx

# Run
pytest -v
pytest --cov=src --cov-report=html
```

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_user(client: AsyncClient):
    response = await client.post("/api/users", json={"email": "test@example.com", "name": "Test"})
    assert response.status_code == 201
    assert response.json()["data"]["email"] == "test@example.com"
```

---

## Common Python Anti-Patterns

| Anti-Pattern              | Fix                                     |
| ------------------------- | --------------------------------------- |
| `print()` for logging     | Use `structlog` or `logging` with JSON  |
| `import *`                | Explicit imports only                   |
| Mutable default args      | Use `None` + `if arg is None: arg = []` |
| Bare `except:`            | Specify exception type                  |
| `os.system()` calls       | Use `subprocess.run()` with check=True  |
| Sync I/O in async context | Use `asyncio` variants                  |
