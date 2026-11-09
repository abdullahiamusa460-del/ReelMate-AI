from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.api.deps import WorkspaceContext, workspace_context
from app.core.logging import AppError
from app.models import Job
from app.schemas import JobListResponse, JobResponse
from app.workers.queue import job_to_public

router = APIRouter(tags=["jobs"], prefix="/jobs")

_JOB_STATUSES = {"queued", "running", "succeeded", "failed", "dead"}


@router.get("", response_model=JobListResponse, summary="List background jobs")
async def list_jobs(
    ctx: WorkspaceContext = Depends(workspace_context),
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> JobListResponse:
    # Jobs are global in this single-workspace build; ownership is enforced by
    # the API token / proxy, not per-row user ids.
    stmt = select(Job)
    if status and status in _JOB_STATUSES:
        stmt = stmt.where(Job.status == status)
    total = int(
        (
            await ctx.session.execute(
                select(func.count()).select_from(stmt.subquery())
            )
        ).scalar_one()
    )
    rows = list(
        (
            await ctx.session.execute(
                stmt.order_by(Job.created_at.desc()).limit(limit).offset(offset)
            )
        ).scalars()
    )
    return JobListResponse(
        jobs=[JobResponse.model_validate(job_to_public(job)) for job in rows],
        total=total,
    )


@router.get("/{job_id}", response_model=JobResponse, summary="Get a background job")
async def get_job(job_id: str, ctx: WorkspaceContext = Depends(workspace_context)) -> JobResponse:
    job = await ctx.session.get(Job, job_id)
    if job is None:
        raise AppError("not_found", "Job not found.", status_code=404)
    return JobResponse.model_validate(job_to_public(job))
