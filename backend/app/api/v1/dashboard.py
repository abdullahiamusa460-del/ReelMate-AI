from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import WorkspaceContext, workspace_context
from app.schemas import AssistantStatus, DashboardResponse
from app.services.dashboard import build_dashboard
from app.services.workspace import assistant_status

router = APIRouter(tags=["dashboard"])


@router.get("/status", response_model=AssistantStatus, summary="AI activation and integration status")
async def get_status(ctx: WorkspaceContext = Depends(workspace_context)) -> AssistantStatus:
    return assistant_status(ctx.settings, ctx.integration)


@router.get("/dashboard", response_model=DashboardResponse, summary="Dashboard summary")
async def get_dashboard(ctx: WorkspaceContext = Depends(workspace_context)) -> DashboardResponse:
    return await build_dashboard(ctx.session, ctx.user.id, ctx.settings, ctx.integration)
