from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
import pytest_asyncio

TEST_DB = Path("/tmp/opencode/reelmate-test.db")
TEST_DB.parent.mkdir(parents=True, exist_ok=True)
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ.update(
    {
        "APP_ENV": "test",
        "DATABASE_URL": f"sqlite+aiosqlite:///{TEST_DB}",
        "SECRET_KEY": "test-secret-key-that-is-long-enough-for-tests",
        "ENCRYPTION_KEY": "",
        "API_ACCESS_TOKEN": "test-token",
        "SEED_DEMO_DATA": "true",
        "ENABLE_WORKER": "false",
        "AUTO_CREATE_TABLES": "false",
        "AI_PROVIDER": "demo",
        "AI_API_KEY": "",
        "IG_WEBHOOK_VERIFY_TOKEN": "test-webhook-token",
        "IG_APP_SECRET": "test-app-secret",
        "IG_REDIRECT_URI": "",
        "UPLOAD_DIR": "/tmp/opencode/reelmate-test-uploads",
        "FRONTEND_URL": "http://localhost:3000",
        "LOG_LEVEL": "WARNING",
    }
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import Base, dispose_engine, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services.seed import seed_demo_workspace  # noqa: E402


@pytest_asyncio.fixture(scope="session", autouse=True)
async def prepared_database():
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    await seed_demo_workspace()
    yield
    await dispose_engine()
    if TEST_DB.exists():
        TEST_DB.unlink()


@pytest_asyncio.fixture
async def client():
    from httpx import ASGITransport, AsyncClient

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as http:
        yield http


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test-token"}


def pytest_configure(config):
    config.addinivalue_line("markers", "anyio: anyio marker")
