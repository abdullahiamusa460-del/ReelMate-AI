from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_oauth_state, decrypt_secret, encrypt_secret, verify_oauth_state
from app.models import Integration
from app.services.activity import add_activity
from app.services.instagram import InstagramAPIError, InstagramClient, client_for_integration
from app.services.time import utc_now

logger = logging.getLogger("reelmate.integration")


def missing_instagram_config() -> list[str]:
    missing: list[str] = []
    if not settings.ig_app_id:
        missing.append("IG_APP_ID")
    if not settings.ig_app_secret:
        missing.append("IG_APP_SECRET")
    if not settings.ig_redirect_uri:
        missing.append("IG_REDIRECT_URI")
    return missing


def build_connect_url(user_id: str) -> str:
    state = create_oauth_state(user_id)
    return InstagramClient().authorization_url(state)


async def complete_oauth(
    session: AsyncSession,
    *,
    user_id: str,
    code: str,
    state: str,
) -> tuple[str, str]:
    """Complete OAuth, storing a token only for a verified professional account.

    Returns (outcome, detail) where outcome is connected|unsupported|error.
    """
    integration = await _get_integration(session, user_id)
    if not verify_oauth_state(state, user_id):
        return "error", "Invalid or expired OAuth state. Start the connection again."

    try:
        token = await InstagramClient().exchange_code(code)
    except InstagramAPIError as exc:
        integration.status = "error"
        integration.last_error = exc.message
        integration.last_checked_at = utc_now()
        add_activity(
            session,
            user_id=user_id,
            kind="integration",
            status="failed",
            title="Instagram authorization failed",
            detail=exc.message,
            is_demo=False,
        )
        return "error", exc.message

    client = InstagramClient(access_token=token.access_token, account_id=token.user_id)
    try:
        profile = await client.get_profile()
    except InstagramAPIError as exc:
        # Without a verified profile we do not keep a token or claim a connection.
        integration.status = "error"
        integration.last_error = exc.message
        integration.last_checked_at = utc_now()
        add_activity(
            session,
            user_id=user_id,
            kind="integration",
            status="failed",
            title="Instagram account could not be verified",
            detail=exc.message,
            is_demo=False,
        )
        return "error", exc.message

    account_type = (profile.account_type or "").upper() or None
    if not profile.is_professional:
        integration.status = "unsupported_personal_account"
        integration.account_id = profile.user_id or token.user_id
        integration.username = profile.username
        integration.account_type = account_type or "PERSONAL"
        integration.access_token_encrypted = None
        integration.token_expires_at = None
        integration.messaging_permitted = False
        integration.webhooks_subscribed = False
        integration.connected_at = None
        integration.disconnected_at = utc_now()
        integration.last_checked_at = utc_now()
        integration.unsupported_reason = (
            "Meta's official Instagram messaging API only supports professional "
            "accounts (Business or Creator). A personal account cannot be connected, "
            "so no token was stored and no messages will be sent."
        )
        integration.last_error = None
        add_activity(
            session,
            user_id=user_id,
            kind="integration",
            status="skipped",
            title="Personal Instagram account is not supported",
            detail=integration.unsupported_reason,
            username=profile.username or "",
            is_demo=False,
        )
        return "unsupported", integration.unsupported_reason

    integration.status = "connected"
    integration.account_id = profile.user_id or token.user_id
    integration.username = profile.username
    integration.account_type = account_type
    integration.scopes = ",".join(settings.oauth_scopes)
    integration.access_token_encrypted = encrypt_secret(token.access_token)
    if token.expires_in:
        integration.token_expires_at = utc_now() + timedelta(seconds=int(token.expires_in))
    integration.messaging_permitted = settings.ig_messaging_scope in settings.oauth_scopes
    integration.unsupported_reason = None
    integration.last_error = None
    integration.last_checked_at = utc_now()
    integration.connected_at = utc_now()
    integration.disconnected_at = None
    add_activity(
        session,
        user_id=user_id,
        kind="integration",
        status="completed",
        title="Instagram professional account connected",
        detail=(
            f"@{profile.username} authorized through official OAuth. "
            "Confirm the messaging webhook subscription before expecting live messages."
        ),
        username=profile.username or "",
        is_demo=False,
    )
    return "connected", f"@{profile.username} connected through official OAuth."


async def verify_integration(session: AsyncSession, user_id: str) -> tuple[bool, str]:
    integration = await _get_integration(session, user_id)
    if not integration.access_token_encrypted:
        if integration.status == "unsupported_personal_account":
            return False, integration.unsupported_reason or "Personal account is unsupported."
        return False, "No Instagram account is connected."

    try:
        profile = await client_for_integration(integration).get_profile()
    except InstagramAPIError as exc:
        integration.status = "error"
        integration.last_error = exc.message
        integration.last_checked_at = utc_now()
        return False, exc.message

    integration.last_checked_at = utc_now()
    if not profile.is_professional:
        integration.status = "unsupported_personal_account"
        integration.account_type = (profile.account_type or "PERSONAL").upper()
        integration.access_token_encrypted = None
        integration.messaging_permitted = False
        integration.webhooks_subscribed = False
        integration.unsupported_reason = (
            "Instagram reports this account as personal. Official messaging APIs are "
            "only available to Business or Creator accounts."
        )
        return False, integration.unsupported_reason

    integration.status = "connected"
    integration.username = profile.username or integration.username
    integration.account_id = profile.user_id or integration.account_id
    integration.account_type = (profile.account_type or "").upper() or integration.account_type
    integration.last_error = None
    return True, "Instagram reports the connected professional account as valid."


async def subscribe_webhooks(session: AsyncSession, user_id: str) -> tuple[bool, str]:
    integration = await _get_integration(session, user_id)
    if not integration.access_token_encrypted or integration.status != "connected":
        return False, "Connect an eligible professional account first."
    try:
        await client_for_integration(integration).subscribe_messaging_webhooks()
    except InstagramAPIError as exc:
        integration.webhooks_subscribed = False
        integration.last_error = exc.message
        return False, exc.message
    integration.webhooks_subscribed = True
    integration.last_error = None
    integration.last_checked_at = utc_now()
    add_activity(
        session,
        user_id=user_id,
        kind="integration",
        status="completed",
        title="Messaging webhook subscription confirmed",
        detail="Instagram accepted the messaging subscribed_apps request.",
        username=integration.username or "",
        is_demo=False,
    )
    return True, "Instagram accepted the messaging webhook subscription."


async def disconnect(session: AsyncSession, user_id: str) -> None:
    integration = await _get_integration(session, user_id)
    integration.status = "not_connected"
    integration.access_token_encrypted = None
    integration.token_expires_at = None
    integration.account_id = None
    integration.username = None
    integration.account_type = None
    integration.scopes = ""
    integration.messaging_permitted = False
    integration.webhooks_subscribed = False
    integration.unsupported_reason = None
    integration.last_error = None
    integration.connected_at = None
    integration.disconnected_at = utc_now()
    integration.last_checked_at = utc_now()
    add_activity(
        session,
        user_id=user_id,
        kind="integration",
        status="completed",
        title="Instagram account disconnected",
        detail="Stored OAuth token material was removed from the database.",
        is_demo=False,
    )


async def bootstrap_manual_token(session: AsyncSession, user_id: str) -> bool:
    """Load an explicitly configured token as *pending*, never as connected.

    The account type must still be verified by the official API before any
    messaging capability is reported.
    """
    integration = await _get_integration(session, user_id)
    if integration.access_token_encrypted or not settings.ig_access_token or not settings.ig_account_id:
        return False
    integration.status = "pending"
    integration.account_id = settings.ig_account_id
    integration.access_token_encrypted = encrypt_secret(settings.ig_access_token)
    integration.messaging_permitted = False
    integration.webhooks_subscribed = False
    integration.last_error = None
    integration.last_checked_at = None
    return True


async def _get_integration(session: AsyncSession, user_id: str) -> Integration:
    from sqlalchemy import select

    result = await session.execute(
        select(Integration).where(
            Integration.user_id == user_id, Integration.provider == "instagram"
        )
    )
    integration = result.scalar_one_or_none()
    if integration is None:
        import uuid

        integration = Integration(id=str(uuid.uuid4()), user_id=user_id)
        session.add(integration)
        await session.flush()
    return integration


def frontend_redirect(outcome: str, detail: str) -> str:
    params = urlencode({"instagram": outcome, "reason": detail[:500]})
    return f"{settings.frontend_url.rstrip('/')}/connection?{params}"


def token_is_expired(integration: Integration) -> bool:
    if not integration.token_expires_at:
        return False
    expires = integration.token_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return expires <= datetime.now(timezone.utc)


def token_status(integration: Integration) -> str:
    if not integration.access_token_encrypted:
        return "missing"
    if token_is_expired(integration):
        return "expired"
    return "present"


def decrypted_token_preview(integration: Integration) -> str | None:
    if not integration.access_token_encrypted:
        return None
    return decrypt_secret(integration.access_token_encrypted)
