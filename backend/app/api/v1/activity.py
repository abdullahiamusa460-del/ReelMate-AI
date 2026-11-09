from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.api.deps import WorkspaceContext, workspace_context
from app.models import ActivityLog
from app.schemas import ActivityListResponse
from app.services.serializers import activity_to_schema
from app.services.time import utc_now

router = APIRouter(tags=["activity"])

_KINDS = {"message", "reel", "reply", "integration", "system"}
_STATUSES = {"completed", "skipped", "failed"}


@router.get("/activity", response_model=ActivityListResponse, summary="List workspace activity")
async def list_activity(
    ctx: WorkspaceContext = Depends(workspace_context),
    kind: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> ActivityListResponse:
    stmt = select(ActivityLog).where(ActivityLog.user_id == ctx.user.id)
    if kind and kind in _KINDS:
        stmt = stmt.where(ActivityLog.kind == kind)
    if status and status in _STATUSES:
        stmt = stmt.where(ActivityLog.status == status)

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
                stmt.order_by(ActivityLog.created_at.desc()).limit(limit).offset(offset)
            )
        ).scalars()
    )
    now = utc_now()
    return ActivityListResponse(
        activity=[activity_to_schema(item, now) for item in rows],
        total=total,
    )
