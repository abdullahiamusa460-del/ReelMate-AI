from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import delete

from app.api.deps import WorkspaceContext, workspace_context
from app.core.auth import sensitive_rate_limit
from app.core.logging import AppError
from app.models import (
    ActivityLog,
    Conversation,
    DEFAULT_AUTO_REPLY,
    Message,
    Reel,
    ReelAnalysis,
)
from app.services.activity import add_activity
from app.services.seed import _seed
from app.services.time import utc_now
from app.services.workspace import is_live

router = APIRouter(tags=["demo"], prefix="/demo")


@router.post(
    "/reset",
    summary="Reset the demo workspace (never available in live mode)",
    dependencies=[Depends(sensitive_rate_limit)],
)
async def reset_demo(ctx: WorkspaceContext = Depends(workspace_context)) -> dict:
    if is_live(ctx.integration):
        raise AppError(
            "live_workspace",
            "Demo reset is disabled while a live Instagram account is connected. "
            "Disconnect Instagram first.",
            status_code=409,
        )

    # Remove only the current workspace's rows. Live integration rows are never
    # deleted here, and the guard above prevents this while live.
    await ctx.session.execute(
        delete(ActivityLog).where(ActivityLog.user_id == ctx.user.id)
    )
    await ctx.session.execute(
        delete(ReelAnalysis).where(ReelAnalysis.user_id == ctx.user.id)
    )
    await ctx.session.execute(delete(Message).where(Message.user_id == ctx.user.id))
    await ctx.session.execute(delete(Reel).where(Reel.user_id == ctx.user.id))
    await ctx.session.execute(
        delete(Conversation).where(Conversation.user_id == ctx.user.id)
    )

    ctx.settings.ai_enabled = False
    ctx.settings.personality = "friendly"
    ctx.settings.tone = "casual"
    ctx.settings.language = "Match sender's language"
    ctx.settings.length = "short"
    ctx.settings.include_emoji = True
    ctx.settings.custom_instructions = ""
    ctx.settings.auto_reply = {
        **DEFAULT_AUTO_REPLY,
        "quietHours": dict(DEFAULT_AUTO_REPLY["quietHours"]),
    }
    ctx.settings.updated_at = utc_now()

    ctx.integration.status = "not_connected"
    ctx.integration.messaging_permitted = False
    ctx.integration.webhooks_subscribed = False
    ctx.integration.unsupported_reason = (
        "Demo mode uses sample conversations. A personal Instagram account cannot be "
        "connected through the official messaging API; a verified Business or Creator "
        "account is required for live mode."
    )
    ctx.integration.last_checked_at = utc_now()

    await _seed(ctx.session, ctx.user.id, ctx.integration)
    add_activity(
        ctx.session,
        user_id=ctx.user.id,
        kind="system",
        status="completed",
        title="Demo workspace reset",
        detail=(
            "Sample conversations, Reels and activity were restored. No Instagram "
            "credentials or live data were touched."
        ),
        is_demo=True,
        meta={"resetAt": utc_now().isoformat()},
    )
    return {
        "ok": True,
        "mode": "demo",
        "message": "Demo data restored. No Instagram request was made.",
        "resetAt": utc_now(),
    }
