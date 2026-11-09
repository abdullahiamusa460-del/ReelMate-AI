"""Worker / job queue processing tests.

Covers the job lifecycle: enqueue -> claim -> succeed/fail/dead transitions,
plus a full round-trip through the analyze_reel handler on demo data.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SessionLocal
from app.models import Job, Reel
from app.workers.queue import enqueue_job, job_to_public, next_retry_at
from app.services.time import utc_now
from app.workers.worker import claim_job, handlers, process_job

import app.workers.handlers  # noqa: F401  registers job handlers on import

pytestmark = pytest.mark.anyio


@asynccontextmanager
async def fresh_session() -> AsyncSession:
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    async with fresh_session() as session:
        yield session


async def test_enqueue_job_persists_queued(session: AsyncSession) -> None:
    job = await enqueue_job(
        session,
        kind="analyze_reel",
        payload={"reel_id": "r1", "force": False},
    )
    await session.commit()

    # Verify through a fresh session to avoid stale identity-map reads.
    async with fresh_session() as verify:
        row = (await verify.execute(select(Job).where(Job.id == job.id))).scalar_one()
    assert row.kind == "analyze_reel"
    assert row.status == "queued"
    assert row.attempts == 0
    assert job_to_public(job)["status"] == "queued"


async def test_next_retry_at_backoff_bounded() -> None:
    first = next_retry_at(1)
    second = next_retry_at(2)
    third = next_retry_at(10)
    assert second > first
    # Backoff is capped at 300 seconds.
    assert (third - utc_now()).total_seconds() <= 300


async def test_claim_job_transitions_queued_to_running(session: AsyncSession) -> None:
    await session.execute(delete(Job))
    await session.commit()

    job = await enqueue_job(
        session,
        kind="auto_reply",
        payload={"conversation_id": "c1", "inbound_message_id": "m1"},
    )
    await session.commit()

    claimed = await claim_job()
    assert claimed is not None
    assert claimed.id == job.id
    assert claimed.status == "running"
    assert claimed.attempts == 1

    async with fresh_session() as verify:
        row = (await verify.execute(select(Job).where(Job.id == job.id))).scalar_one()
    assert row.status == "running"


async def test_claim_job_returns_none_when_no_queued_jobs(session: AsyncSession) -> None:
    await session.execute(delete(Job))
    await session.commit()
    assert await claim_job() is None


async def test_process_job_no_handler_marks_dead(session: AsyncSession) -> None:
    await session.execute(delete(Job))
    await session.commit()

    job = await enqueue_job(session, kind="nonexistent_kind", payload={})
    await session.commit()

    await claim_job()  # transitions queued -> running
    await process_job(job.id)

    async with fresh_session() as verify:
        row = (await verify.execute(select(Job).where(Job.id == job.id))).scalar_one()
    assert row.status == "dead"
    assert "No handler registered" in (row.last_error or "")


async def test_process_job_analyze_reel_on_demo_reel(session: AsyncSession) -> None:
    async with fresh_session() as check:
        reel = (
            await check.execute(select(Reel).where(Reel.id == "r1"))
        ).scalar_one_or_none()
    assert reel is not None, "demo seed must provide reel r1"

    await session.execute(delete(Job))
    await session.commit()

    job = await enqueue_job(
        session,
        kind="analyze_reel",
        payload={"reel_id": "r1", "force": True},
    )
    await session.commit()

    await claim_job()  # transitions queued -> running
    await process_job(job.id)

    async with fresh_session() as verify:
        row = (await verify.execute(select(Job).where(Job.id == job.id))).scalar_one()
    # No AI provider is configured in tests, so media analysis permanently fails.
    assert row.status == "failed"
    assert row.last_error is not None


async def test_job_to_public_shape(session: AsyncSession) -> None:
    job = await enqueue_job(
        session,
        kind="process_webhook",
        payload={"webhook_event_id": "evt-1"},
        delay_seconds=5,
    )
    await session.commit()

    public = job_to_public(job)
    assert set(public) == {
        "id",
        "kind",
        "status",
        "attempts",
        "lastError",
        "result",
        "createdAt",
        "updatedAt",
    }
    assert public["kind"] == "process_webhook"
    assert public["status"] == "queued"
    assert public["lastError"] is None


async def test_handlers_registry_contains_expected_kinds() -> None:
    registered = handlers()
    assert "analyze_reel" in registered
    assert "auto_reply" in registered
    assert "process_webhook" in registered
