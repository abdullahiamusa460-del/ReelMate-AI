"""Workspace bootstrap and state resolution.

ReelMate AI is a single-workspace dashboard. Multi-user tables are in place so
the model can grow into a hosted product without a schema rewrite, but this
build deliberately does not expose public signup.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import AISettings, Integration, User
from app.schemas import AIStatus, AssistantStatus, ConnectionState, IntegrationDetail
from app.services.time import ago_label, ensure_utc


async def get_workspace(session: AsyncSession) -> tuple[User, AISettings, Integration]:
    email = settings.default_workspace_email
    user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            display_name="Alex",
            timezone=settings.app_timezone,
        )
        session.add(user)
        await session.flush()

    ai_settings = (
        await session.execute(select(AISettings).where(AISettings.user_id == user.id))
    ).scalar_one_or_none()
    if ai_settings is None:
        ai_settings = AISettings(id=str(uuid.uuid4()), user_id=user.id)
        session.add(ai_settings)
        await session.flush()

    integration = (
        await session.execute(
            select(Integration).where(
                Integration.user_id == user.id, Integration.provider == "instagram"
            )
        )
    ).scalar_one_or_none()
    if integration is None:
        integration = Integration(id=str(uuid.uuid4()), user_id=user.id)
        session.add(integration)
        await session.flush()

    return user, ai_settings, integration


def is_live(integration: Integration) -> bool:
    return bool(
        integration.status == "connected"
        and integration.access_token_encrypted
        and integration.account_id
    )


def connection_state(integration: Integration) -> ConnectionState:
    checked = ensure_utc(integration.last_checked_at)
    if integration.status == "connected":
        label = f"Checked {ago_label(checked)}" if checked else "Connected — not checked yet"
    elif integration.status == "unsupported_personal_account":
        label = "Personal accounts are not supported by the official API"
    elif integration.status == "error":
        label = "Last connection check failed"
    elif integration.status == "pending":
        label = "Authorization in progress"
    else:
        label = "Never — no eligible account connected"

    return ConnectionState(
        status=integration.status,  # type: ignore[arg-type]
        account_handle=f"@{integration.username}" if integration.username else None,
        account_type=integration.account_type,
        last_checked_label=label,
        last_checked_at=checked,
        messaging_permitted=bool(integration.messaging_permitted),
        webhooks_subscribed=bool(integration.webhooks_subscribed),
        unsupported_reason=integration.unsupported_reason,
        error=integration.last_error,
    )


def integration_detail(integration: Integration, configured: bool | None = None) -> IntegrationDetail:
    connection = connection_state(integration)
    if configured is None:
        configured = bool(settings.ig_app_id and settings.ig_app_secret)
    return IntegrationDetail(
        **connection.model_dump(),
        provider=integration.provider,
        scopes=[scope for scope in integration.scopes.split(",") if scope],
        token_expires_at=ensure_utc(integration.token_expires_at),
        connected_at=ensure_utc(integration.connected_at),
        demo=not is_live(integration),
        configured=configured,
    )


def ai_status(ai_settings: AISettings) -> AIStatus:
    provider = settings.ai_provider.strip().lower()
    configured = settings.ai_configured
    return AIStatus(
        enabled=bool(ai_settings.ai_enabled),
        provider=provider if configured else "demo",
        model=settings.ai_model if configured else None,
        configured=configured,
        multimodal=configured,
        video_capable=settings.ai_video_capable,
        template_fallback=True,
    )


def assistant_status(ai_settings: AISettings, integration: Integration) -> AssistantStatus:
    live = is_live(integration)
    delivery = live and bool(integration.messaging_permitted)
    receive = live and bool(integration.webhooks_subscribed) and bool(integration.messaging_permitted)
    ai = ai_status(ai_settings)

    limitations: list[str] = []
    if not live:
        limitations.append(
            "Demo mode: sample conversations are served from the database and no "
            "Instagram message is received or sent."
        )
    if integration.status == "unsupported_personal_account":
        limitations.append(
            "Personal Instagram accounts are not supported by Meta's official "
            "Instagram messaging API. Use a Business or Creator account."
        )
    if live and not integration.messaging_permitted:
        limitations.append(
            "Messaging permission has not been confirmed for this account. "
            "Replies will be held as drafts."
        )
    if live and not integration.webhooks_subscribed:
        limitations.append(
            "The messaging webhook subscription has not been confirmed. Incoming "
            "messages will not be processed until it is."
        )
    if not ai.configured:
        limitations.append(
            "No multimodal AI provider is configured. Replies use a clearly labelled "
            "template and Reel video analysis is unavailable."
        )
    elif not ai.video_capable:
        limitations.append(
            "The AI provider receives sampled video frames rather than the original "
            "audio/video stream. Analysis never claims to have heard audio."
        )
    limitations.append(
        "A Reel is only analysed after its actual media is downloaded (or you upload "
        "it). A URL or caption alone is never summarised."
    )

    capabilities = {
        "receive_messages": receive,
        "send_messages": delivery,
        "analyze_reels_with_model": ai.configured,
        "upload_video_for_analysis": ai.configured,
        "demo_sample_conversations": True,
        "personal_account": False,
    }

    return AssistantStatus(
        mode="live" if live else "demo",
        demo=not live,
        ai_enabled=bool(ai_settings.ai_enabled),
        delivery_enabled=delivery,
        receive_enabled=receive,
        reel_analysis_available=ai.configured,
        upload_analysis_available=ai.configured,
        personal_account_supported=False,
        connection=connection_state(integration),
        ai=ai,
        capabilities=capabilities,
        limitations=limitations,
    )


def require_live_delivery(integration: Integration) -> None:
    from app.core.logging import AppError

    if not is_live(integration):
        raise AppError(
            "demo_mode_no_delivery",
            "This workspace is in demo mode. No Instagram account is connected, so "
            "the reply was not sent.",
            status_code=409,
            details={
                "mode": "demo",
                "requires": "An eligible Business or Creator Instagram account connected "
                "through the official OAuth flow.",
            },
        )
    if not integration.messaging_permitted:
        raise AppError(
            "messaging_not_permitted",
            "The connected account has not confirmed Instagram messaging permission. "
            "The reply was not sent.",
            status_code=409,
            details={"mode": "live", "requires": settings.ig_messaging_scope},
        )


def integration_public_dict(integration: Integration) -> dict[str, Any]:
    """Never include token material here."""
    return {
        "provider": integration.provider,
        "status": integration.status,
        "accountId": integration.account_id,
        "username": integration.username,
        "accountType": integration.account_type,
        "scopes": [scope for scope in integration.scopes.split(",") if scope],
        "messagingPermitted": integration.messaging_permitted,
        "webhooksSubscribed": integration.webhooks_subscribed,
        "tokenExpiresAt": ensure_utc(integration.token_expires_at),
        "connectedAt": ensure_utc(integration.connected_at),
        "lastCheckedAt": ensure_utc(integration.last_checked_at),
        "unsupportedReason": integration.unsupported_reason,
        "lastError": integration.last_error,
        "demo": not is_live(integration),
    }


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
