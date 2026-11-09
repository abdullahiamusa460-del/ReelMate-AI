"""ReelMate AI backend entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router, public_router
from app.core.auth import general_rate_limit, require_api_token
from app.core.config import settings
from app.core.database import Base, check_database, dispose_engine, engine, session_scope
from app.core.logging import (
    RequestContextMiddleware,
    configure_logging,
    install_exception_handlers,
)
from app.schemas import HealthResponse
from app.services.integration import bootstrap_manual_token
from app.services.seed import seed_demo_workspace
from app.services.time import utc_now
from app.services.workspace import get_workspace, is_live
from app.workers.worker import worker

logger = logging.getLogger("reelmate.main")

VERSION = "0.1.0"


async def _bootstrap() -> None:
    settings.upload_path.mkdir(parents=True, exist_ok=True)

    problems = settings.validate_production_secrets()
    if problems:
        raise RuntimeError("Invalid production configuration: " + "; ".join(problems))

    if settings.auto_create_tables:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        logger.warning("AUTO_CREATE_TABLES is enabled; use Alembic migrations in production")

    if not await check_database():
        raise RuntimeError(
            "Database is not reachable. Check DATABASE_URL and that PostgreSQL is running."
        )

    async with session_scope() as session:
        user, _, integration = await get_workspace(session)
        if await bootstrap_manual_token(session, user.id):
            logger.info("imported a manually configured Instagram token as pending verification")
        if is_live(integration):
            logger.info("workspace is in live mode for @%s", integration.username)

    if settings.seed_demo_data:
        seeded = await seed_demo_workspace()
        if seeded:
            logger.info("demo workspace seeded with clearly labelled sample data")


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info("starting %s (env=%s)", settings.app_name, settings.app_env)
    await _bootstrap()
    if settings.enable_worker:
        await worker.start()
    try:
        yield
    finally:
        if worker.running:
            await worker.stop()
        await dispose_engine()
        logger.info("shutdown complete")


app = FastAPI(
    title=settings.app_name,
    version=VERSION,
    description=(
        "Backend for ReelMate AI. Demo and live modes are explicitly separated. "
        "Live messaging uses only Meta's official Instagram Platform APIs."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)

install_exception_handlers(app)


@app.get("/health", response_model=HealthResponse, tags=["system"], summary="Health check")
@app.get(
    "/api/v1/health",
    response_model=HealthResponse,
    tags=["system"],
    summary="Health check (versioned)",
)
async def health() -> HealthResponse:
    database_ok = await check_database()
    async with session_scope() as session:
        _, _, integration = await get_workspace(session)
        mode = "live" if is_live(integration) else "demo"
    return HealthResponse(
        status="ok" if database_ok else "degraded",
        version=VERSION,
        database=database_ok,
        mode=mode,
        ai_provider=settings.ai_provider,
        ai_configured=settings.ai_configured,
        worker_enabled=bool(settings.enable_worker and worker.running),
        timestamp=utc_now(),
    )


app.include_router(
    api_router,
    prefix="/api/v1",
    dependencies=[Depends(require_api_token), Depends(general_rate_limit)],
)
app.include_router(public_router, prefix="/api/v1")


@app.get("/", include_in_schema=False)
async def root() -> JSONResponse:
    return JSONResponse(
        {
            "name": settings.app_name,
            "version": VERSION,
            "docs": "/docs",
            "health": "/health",
            "api": "/api/v1",
        }
    )
