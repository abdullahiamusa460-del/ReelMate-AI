from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import WorkspaceContext, workspace_context
from app.core.auth import sensitive_rate_limit
from app.models import DEFAULT_AUTO_REPLY
from app.schemas import (
    ActivationRequest,
    AssistantSettings,
    AssistantSettingsResponse,
    AutoReplySettings,
)
from app.services.activity import add_activity
from app.services.time import utc_now

router = APIRouter(tags=["settings"])


def settings_response(ctx: WorkspaceContext) -> AssistantSettingsResponse:
    auto_value = ctx.settings.auto_reply or {}
    auto = AutoReplySettings.model_validate(
        {
            **DEFAULT_AUTO_REPLY,
            **auto_value,
            "quietHours": {
                **DEFAULT_AUTO_REPLY["quietHours"],
                **(auto_value.get("quietHours") or {}),
            },
        }
    )
    return AssistantSettingsResponse(
        personality=ctx.settings.personality,
        tone=ctx.settings.tone,
        language=ctx.settings.language,
        length=ctx.settings.length,
        include_emoji=ctx.settings.include_emoji,
        custom_instructions=ctx.settings.custom_instructions,
        auto_reply=auto,
        updated_at=ctx.settings.updated_at,
        source="database",
    )


@router.get("/settings", response_model=AssistantSettingsResponse, summary="Get AI settings")
async def get_settings(ctx: WorkspaceContext = Depends(workspace_context)) -> AssistantSettingsResponse:
    return settings_response(ctx)


@router.put(
    "/settings",
    response_model=AssistantSettingsResponse,
    summary="Update AI settings",
    dependencies=[Depends(sensitive_rate_limit)],
)
async def update_settings(
    payload: AssistantSettings,
    ctx: WorkspaceContext = Depends(workspace_context),
) -> AssistantSettingsResponse:
    ctx.settings.personality = payload.personality
    ctx.settings.tone = payload.tone
    ctx.settings.language = payload.language
    ctx.settings.length = payload.length
    ctx.settings.include_emoji = payload.include_emoji
    ctx.settings.custom_instructions = payload.custom_instructions
    ctx.settings.auto_reply = payload.auto_reply.model_dump(by_alias=True)
    ctx.settings.updated_at = utc_now()
    add_activity(
        ctx.session,
        user_id=ctx.user.id,
        kind="system",
        status="completed",
        title="Assistant settings updated",
        detail="Personality, tone, language, length and auto-reply rules were saved.",
        is_demo=True,
    )
    return settings_response(ctx)


@router.post(
    "/settings/reset",
    response_model=AssistantSettingsResponse,
    summary="Reset AI settings to defaults",
)
async def reset_settings(ctx: WorkspaceContext = Depends(workspace_context)) -> AssistantSettingsResponse:
    ctx.settings.personality = "friendly"
    ctx.settings.tone = "casual"
    ctx.settings.language = "Match sender's language"
    ctx.settings.length = "short"
    ctx.settings.include_emoji = True
    ctx.settings.custom_instructions = ""
    ctx.settings.auto_reply = dict(DEFAULT_AUTO_REPLY)
    ctx.settings.updated_at = utc_now()
    add_activity(
        ctx.session,
        user_id=ctx.user.id,
        kind="system",
        status="completed",
        title="Assistant settings reset",
        detail="Default personality and auto-reply rules restored.",
        is_demo=True,
    )
    return settings_response(ctx)


@router.post("/assistant/activation", summary="Enable or pause the assistant")
async def set_activation(
    payload: ActivationRequest,
    ctx: WorkspaceContext = Depends(workspace_context),
) -> dict:
    ctx.settings.ai_enabled = payload.enabled
    ctx.settings.updated_at = utc_now()
    add_activity(
        ctx.session,
        user_id=ctx.user.id,
        kind="system",
        status="completed",
        title="AI assistant enabled" if payload.enabled else "AI assistant paused",
        detail=(
            "The assistant is enabled. Live delivery still requires an eligible connected "
            "account and confirmed messaging permission."
            if payload.enabled
            else "No messages will be generated or sent while paused."
        ),
        is_demo=True,
    )
    return {
        "enabled": payload.enabled,
        "mode": "live" if ctx.integration.status == "connected" else "demo",
        "delivery_enabled": bool(
            ctx.integration.status == "connected"
            and ctx.integration.messaging_permitted
            and ctx.integration.access_token_encrypted
        ),
    }


@router.get("/settings/options", summary="Available settings options")
async def get_options() -> dict:
    return {
        "personalities": ["friendly", "professional", "witty", "supportive", "curious"],
        "tones": ["casual", "balanced", "formal", "enthusiastic"],
        "lengths": ["short", "medium", "detailed"],
        "sendModes": ["automatic", "review"],
        "languages": [
            "Match sender's language",
            "English",
            "Spanish",
            "French",
            "German",
            "Portuguese",
            "Italian",
            "Hindi",
            "Japanese",
            "Arabic",
        ],
    }
