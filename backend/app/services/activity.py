from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActivityLog
from app.services.time import utc_now


def add_activity(
    session: AsyncSession,
    *,
    user_id: str,
    kind: str,
    status: str,
    title: str,
    detail: str = "",
    username: str = "",
    conversation_id: str | None = None,
    reel_id: str | None = None,
    is_demo: bool = True,
    meta: dict | None = None,
) -> ActivityLog:
    item = ActivityLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        kind=kind,
        status=status,
        title=title,
        detail=detail,
        username=username,
        conversation_id=conversation_id,
        reel_id=reel_id,
        is_demo=is_demo,
        meta=meta or {},
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    session.add(item)
    return item
