from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Job
from app.services.time import utc_now


class PermanentJobError(Exception):
    """A job that should not be retried (e.g. media is permanently unavailable)."""


async def enqueue_job(
    session: AsyncSession,
    *,
    kind: str,
    payload: dict,
    delay_seconds: int = 0,
    max_attempts: int | None = None,
) -> Job:
    now = utc_now()
    job = Job(
        id=str(uuid.uuid4()),
        kind=kind,
        payload=payload,
        status="queued",
        attempts=0,
        max_attempts=max_attempts or settings.job_max_attempts,
        run_at=now + timedelta(seconds=max(0, delay_seconds)),
        created_at=now,
        updated_at=now,
    )
    session.add(job)
    await session.flush()
    return job


def job_to_public(job: Job) -> dict:
    return {
        "id": job.id,
        "kind": job.kind,
        "status": job.status,
        "attempts": job.attempts,
        "lastError": job.last_error,
        "result": job.result,
        "createdAt": job.created_at,
        "updatedAt": job.updated_at,
    }


def next_retry_at(attempts: int) -> datetime:
    backoff = min(300, 5 * (2 ** max(0, attempts - 1)))
    return utc_now() + timedelta(seconds=backoff)
