from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, workspace_context
from app.core.auth import sensitive_rate_limit
from app.core.config import settings
from app.core.database import get_session
from app.schemas import (
    ConnectUrlResponse,
    IntegrationActionResponse,
    IntegrationResponse,
)
from app.services.integration import (
    build_connect_url,
    complete_oauth,
    disconnect,
    frontend_redirect,
    missing_instagram_config,
    subscribe_webhooks,
    verify_integration,
)
from app.services.workspace import (
    assistant_status,
    connection_state,
    get_workspace,
    integration_detail,
)

logger = logging.getLogger("reelmate.api.integration")

router = APIRouter(tags=["integration"], prefix="/integration")
public_router = APIRouter(tags=["integration"])


@router.get("", response_model=IntegrationResponse, summary="Instagram integration state")
async def get_integration(
    ctx: WorkspaceContext = Depends(workspace_context),
) -> IntegrationResponse:
    configured = bool(settings.ig_app_id and settings.ig_app_secret)
    return IntegrationResponse(
        connection=connection_state(ctx.integration),
        detail=integration_detail(ctx.integration, configured=configured),
        status=assistant_status(ctx.settings, ctx.integration),
    )


@router.get(
    "/connect-url",
    response_model=ConnectUrlResponse,
    summary="Build the official Instagram OAuth URL",
    dependencies=[Depends(sensitive_rate_limit)],
)
async def connect_url(ctx: WorkspaceContext = Depends(workspace_context)) -> ConnectUrlResponse:
    missing = missing_instagram_config()
    if missing:
        return ConnectUrlResponse(
            configured=False,
            message=(
                "Instagram OAuth is not configured on the backend. Set the missing "
                "environment variables, then restart the service."
            ),
            missing=missing,
        )
    return ConnectUrlResponse(
        configured=True,
        url=build_connect_url(ctx.user.id),
        message="Open this URL to authorize an Instagram Business or Creator account.",
    )


@router.post(
    "/verify",
    response_model=IntegrationActionResponse,
    summary="Re-check the connected account with the official API",
    dependencies=[Depends(sensitive_rate_limit)],
)
async def verify(ctx: WorkspaceContext = Depends(workspace_context)) -> IntegrationActionResponse:
    ok, message = await verify_integration(ctx.session, ctx.user.id)
    await ctx.session.refresh(ctx.integration)
    return IntegrationActionResponse(
        status=connection_state(ctx.integration),
        message=message,
        demo=assistant_status(ctx.settings, ctx.integration).demo,
    )


@router.post(
    "/subscribe-webhooks",
    response_model=IntegrationActionResponse,
    summary="Subscribe the connected account to messaging webhooks",
    dependencies=[Depends(sensitive_rate_limit)],
)
async def subscribe(ctx: WorkspaceContext = Depends(workspace_context)) -> IntegrationActionResponse:
    ok, message = await subscribe_webhooks(ctx.session, ctx.user.id)
    await ctx.session.refresh(ctx.integration)
    return IntegrationActionResponse(
        status=connection_state(ctx.integration),
        message=message,
        demo=assistant_status(ctx.settings, ctx.integration).demo,
    )


@router.post(
    "/disconnect",
    response_model=IntegrationActionResponse,
    summary="Remove stored Instagram credentials",
    dependencies=[Depends(sensitive_rate_limit)],
)
async def disconnect_account(
    ctx: WorkspaceContext = Depends(workspace_context),
) -> IntegrationActionResponse:
    await disconnect(ctx.session, ctx.user.id)
    await ctx.session.refresh(ctx.integration)
    return IntegrationActionResponse(
        status=connection_state(ctx.integration),
        message="Stored Instagram credentials were removed. Demo data is unchanged.",
        demo=True,
    )


@public_router.get(
    "/integration/oauth/callback",
    summary="Instagram OAuth callback (public, state-verified)",
)
async def oauth_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> RedirectResponse:
    """Finish OAuth and redirect to the frontend with an explicit outcome.

    Only a verified professional account receives a stored token. The redirect
    always explains the result; it never claims a personal account connected.
    """
    if error:
        detail = error_description or error
        return RedirectResponse(frontend_redirect("error", detail), status_code=303)
    if not code or not state:
        return RedirectResponse(
            frontend_redirect("error", "Instagram did not return an authorization code."),
            status_code=303,
        )

    user, _, _ = await get_workspace(session)
    try:
        outcome, detail = await complete_oauth(
            session, user_id=user.id, code=code, state=state
        )
    except Exception as exc:  # noqa: BLE001 - the redirect must still explain failure
        logger.exception("OAuth callback failed")
        return RedirectResponse(
            frontend_redirect("error", f"The connection could not be completed: {exc}"),
            status_code=303,
        )
    return RedirectResponse(frontend_redirect(outcome, detail), status_code=303)
