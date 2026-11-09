"""PostgreSQL-backed background worker.

Jobs are claimed with FOR UPDATE SKIP LOCKED on PostgreSQL, so multiple API
instances can share the queue safely. SQLite falls back to a single-process
claim for local development and tests.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable

from sqlalchemy import select

from app.core.database import SessionLocal, engine
from app.models import Job
from app.services.time import utc_now
from app.workers.queue import PermanentJobError, next_retry_at

logger = logging.getLogger("reelmate.worker")

JobHandler = Callable[[dict], Awaitable[dict | None]]
_HANDLERS: dict[str, JobHandler] = {}


def register_handler(kind: str, handler: JobHandler) -> None:
    _HANDLERS[kind] = handler


def handlers() -> dict[str, JobHandler]:
    # Import for side effects (registration).
    from app.workers import handlers as _handlers  # noqa: F401

    return _HANDLERS


async def claim_job() -> Job | None:
    async with SessionLocal() as session:
        stmt = (
            select(Job)
            .where(Job.status == "queued", Job.run_at <= utc_now())
            .order_by(Job.run_at.asc(), Job.created_at.asc())
            .limit(1)
        )
        if engine.dialect.name == "postgresql":
            stmt = stmt.with_for_update(skip_locked=True)
        job = (await session.execute(stmt)).scalar_one_or_none()
        if job is None:
            return None
        job.status = "running"
        job.locked_at = utc_now()
        job.attempts += 1
        job.updated_at = utc_now()
        await session.commit()
        # Detach a plain snapshot so the caller can read it outside the session.
        return job


async def process_job(job_id: str) -> None:
    async with SessionLocal() as session:
        job = await session.get(Job, job_id)
        if job is None or job.status != "running":
            return
        kind = job.kind
        payload = dict(job.payload or {})
        attempts = job.attempts
        max_attempts = job.max_attempts
        handler = handlers().get(kind)

    if handler is None:
        async with SessionLocal() as session:
            job = await session.get(Job, job_id)
            if job:
                job.status = "dead"
                job.last_error = f"No handler registered for job kind '{kind}'."
                job.updated_at = utc_now()
                await session.commit()
        logger.error("no handler for job kind %s", kind)
        return

    result: dict | None = None
    error: Exception | None = None
    try:
        result = await handler(payload)
    except PermanentJobError as exc:
        error = exc
        logger.warning("job %s permanently failed: %s", job_id, exc)
    except Exception as exc:  # noqa: BLE001 - retried and recorded
        error = exc
        logger.exception("job %s failed (attempt %s)", job_id, attempts)

    async with SessionLocal() as session:
        job = await session.get(Job, job_id)
        if job is None:
            return
        job.locked_at = None
        job.updated_at = utc_now()
        if error is None:
            job.status = "succeeded"
            job.result = result
            job.last_error = None
        elif isinstance(error, PermanentJobError):
            job.status = "failed"
            job.last_error = str(error)[:2000]
            job.result = {"error": str(error)[:2000]}
        elif attempts >= max_attempts:
            job.status = "dead"
            job.last_error = str(error)[:2000]
            job.result = {"error": str(error)[:2000]}
        else:
            job.status = "queued"
            job.run_at = next_retry_at(attempts)
            job.last_error = str(error)[:2000]
        await session.commit()


class Worker:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()
        self._idle = asyncio.Event()
        self._idle.set()

    async def start(self) -> None:
        if self._task is not None:
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run(), name="reelmate-worker")
        logger.info("background worker started")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None
        logger.info("background worker stopped")

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    async def _run(self) -> None:
        from app.core.config import settings

        while not self._stop.is_set():
            try:
                job = await claim_job()
                if job is None:
                    self._idle.set()
                    await asyncio.sleep(settings.worker_poll_interval_sec)
                    continue
                self._idle.clear()
                await process_job(job.id)
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("worker loop error")
                await asyncio.sleep(min(10, settings.worker_poll_interval_sec * 2))


worker = Worker()
