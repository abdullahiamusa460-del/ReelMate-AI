from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_api_token
from app.core.database import get_session
from app.models import AISettings, Integration, User
from app.services.workspace import get_workspace


@dataclass
class WorkspaceContext:
    session: AsyncSession
    user: User
    settings: AISettings
    integration: Integration


async def workspace_context(
    session: AsyncSession = Depends(get_session),
) -> WorkspaceContext:
    user, ai_settings, integration = await get_workspace(session)
    return WorkspaceContext(
        session=session,
        user=user,
        settings=ai_settings,
        integration=integration,
    )


__all__ = ["WorkspaceContext", "require_api_token", "workspace_context"]
