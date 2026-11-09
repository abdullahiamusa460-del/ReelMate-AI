from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import AISettings, Conversation, Integration, Message, Reel, WebhookEvent
from app.services.activity import add_activity
from app.services.time import utc_now
from app.services.workspace import is_live
from app.workers.queue import enqueue_job

logger = logging.getLogger("reelmate.webhook")

_REEL_TYPES = {"ig_reel", "reel", "reels", "share", "reel_video", "video"}


def _attachment_url(attachment: dict[str, Any]) -> str | None:
    payload = attachment.get("payload") or {}
    for key in ("url", "reel_url", "media_url", "source_url", "video_url"):
        value = payload.get(key)
        if isinstance(value, str) and value.startswith(("http://", "https://")):
            return value
    value = attachment.get("url")
    return value if isinstance(value, str) and value.startswith(("http://", "https://")) else None


def _allowed_media_host(url: str | None) -> bool:
    if not url:
        return False
    from urllib.parse import urlparse

    host = (urlparse(url).hostname or "").lower()
    return any(
        host == allowed or host.endswith(f".{allowed}")
        for allowed in settings.allowed_media_hosts
    )


def _hue_for(value: str) -> int:
    digest = hashlib.sha256(value.encode()).digest()
    return digest[0] * 360 // 255


def _as_epoch(value: Any) -> datetime:
    try:
        number = int(value)
        if number > 10_000_000_000:
            number //= 1000
        return datetime.fromtimestamp(number, tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return utc_now()


async def process_webhook_event(event_id: str) -> dict:
    from app.core.database import session_scope

    async with session_scope() as session:
        event = await session.get(WebhookEvent, event_id)
        if event is None:
            return {"status": "missing"}
        if event.status == "processed":
            return {"status": "already_processed"}
        try:
            result = await _process_payload(session, event.payload)
            event.status = "processed"
            event.processed_at = utc_now()
            event.last_error = None
            return result
        except Exception as exc:  # noqa: BLE001
            event.status = "failed"
            event.attempts += 1
            event.last_error = str(exc)[:2000]
            logger.exception("webhook event processing failed")
            raise


async def _process_payload(session: AsyncSession, payload: dict[str, Any]) -> dict:
    if payload.get("object") not in {"instagram", "instagram_business"}:
        return {"status": "ignored", "reason": "unsupported object"}

    processed = 0
    skipped = 0
    for entry in payload.get("entry") or []:
        entry_id = str(entry.get("id") or "")
        for event in entry.get("messaging") or []:
            result = await _process_messaging_event(session, entry_id, event)
            if result.get("status") == "processed":
                processed += 1
            else:
                skipped += 1
    return {"status": "processed", "messages": processed, "skipped": skipped}


async def _process_messaging_event(
    session: AsyncSession, entry_id: str, event: dict[str, Any]
) -> dict:
    message = event.get("message") or {}
    if message.get("is_echo"):
        return {"status": "skipped", "reason": "echo"}
    if message.get("is_deleted"):
        return {"status": "skipped", "reason": "deleted"}

    sender = event.get("sender") or {}
    recipient = event.get("recipient") or {}
    sender_id = str(sender.get("id") or "")
    account_id = str(entry_id or recipient.get("id") or "")
    if not sender_id or not account_id:
        return {"status": "skipped", "reason": "missing ids"}

    integration = (
        await session.execute(
            select(Integration).where(
                Integration.provider == "instagram", Integration.account_id == account_id
            )
        )
    ).scalar_one_or_none()
    if integration is None:
        logger.warning("webhook for unknown Instagram account %s", account_id[-4:])
        return {"status": "skipped", "reason": "unknown account"}
    if not is_live(integration):
        return {"status": "skipped", "reason": "integration not live"}

    mid = str(message.get("mid") or "")
    if mid:
        existing = (
            await session.execute(select(Message).where(Message.ig_message_id == mid))
        ).scalar_one_or_none()
        if existing is not None:
            return {"status": "skipped", "reason": "duplicate message"}

    conversation = (
        await session.execute(
            select(Conversation).where(
                Conversation.user_id == integration.user_id,
                Conversation.ig_user_id == sender_id,
            )
        )
    ).scalar_one_or_none()
    if conversation is None:
        username = (
            message.get("from", {}).get("username")
            if isinstance(message.get("from"), dict)
            else None
        ) or f"ig_{sender_id[-6:]}"
        conversation = Conversation(
            id=str(uuid.uuid4()),
            user_id=integration.user_id,
            ig_thread_id=str(event.get("thread_id") or "") or None,
            ig_user_id=sender_id,
            username=username,
            display_name=username,
            hue=_hue_for(sender_id),
            is_message_request=bool(message.get("is_message_request", False)),
            is_group=False,
            unread_count=0,
            reply_status="pending",
            eligible=True,
            eligibility_note="New message — eligibility is being checked.",
            is_demo=False,
            last_message_at=_as_epoch(event.get("timestamp")),
        )
        session.add(conversation)
        await session.flush()

    text = str(message.get("text") or "")[:10000]
    reel: Reel | None = None
    for attachment in message.get("attachments") or []:
        if str(attachment.get("type", "")).lower() not in _REEL_TYPES:
            continue
        url = _attachment_url(attachment)
        ig_media_id = str(
            (attachment.get("payload") or {}).get("id")
            or (attachment.get("payload") or {}).get("media_id")
            or ""
        ) or None
        staged = None
        if ig_media_id:
            staged = (
                await session.execute(
                    select(Reel).where(
                        Reel.conversation_id == conversation.id,
                        Reel.ig_media_id == ig_media_id,
                    )
                )
            ).scalar_one_or_none()
        if staged is None:
            accessible = _allowed_media_host(url)
            reason = None
            if not accessible:
                reason = (
                    "Meta did not include an accessible media URL for this shared Reel. "
                    "Upload the video to analyse its actual content."
                )
            reel = Reel(
                id=str(uuid.uuid4()),
                user_id=integration.user_id,
                conversation_id=conversation.id,
                ig_media_id=ig_media_id,
                shared_by=conversation.username,
                creator=str(
                    (attachment.get("payload") or {}).get("creator")
                    or (attachment.get("payload") or {}).get("owner_username")
                    or "@unknown"
                ),
                caption=str((attachment.get("payload") or {}).get("title") or "")[:5000],
                permalink=url,
                media_url=url if accessible else None,
                duration_sec=0,
                accessible=accessible,
                inaccessible_reason=reason,
                analysis_status="pending",
                hues=[_hue_for(conversation.id), (_hue_for(conversation.id) + 45) % 360],
                is_demo=False,
                received_at=_as_epoch(event.get("timestamp")),
            )
            session.add(reel)
            await session.flush()
            add_activity(
                session,
                user_id=integration.user_id,
                kind="reel",
                status="completed" if accessible else "skipped",
                title="Shared Reel received" if accessible else "Shared Reel media unavailable",
                detail=(
                    "Meta supplied an accessible media URL. Analysis is queued."
                    if accessible
                    else reason or "No accessible media URL."
                ),
                username=conversation.username,
                conversation_id=conversation.id,
                reel_id=reel.id,
                is_demo=False,
            )
        else:
            reel = staged

    inbound = Message(
        id=str(uuid.uuid4()),
        user_id=integration.user_id,
        conversation_id=conversation.id,
        ig_message_id=mid or None,
        direction="inbound",
        author="them",
        text=text,
        reel_id=reel.id if reel else None,
        delivery_status="received",
        delivered=False,
        is_demo=False,
        created_at=_as_epoch(event.get("timestamp")),
        updated_at=utc_now(),
    )
    session.add(inbound)
    conversation.unread_count += 1
    conversation.reply_status = "pending"
    conversation.last_message_at = _as_epoch(event.get("timestamp"))
    await session.flush()

    add_activity(
        session,
        user_id=integration.user_id,
        kind="message",
        status="completed",
        title="Message received",
        detail=(text[:140] if text else "Shared a Reel"),
        username=conversation.username,
        conversation_id=conversation.id,
        is_demo=False,
    )

    if reel is not None and reel.accessible and settings.ai_configured:
        await enqueue_job(
            session, kind="analyze_reel", payload={"reel_id": reel.id, "force": False}
        )
        reel.analysis_status = "queued"

    settings_row = (
        await session.execute(select(AISettings).where(AISettings.user_id == integration.user_id))
    ).scalar_one_or_none()
    delay = 0
    if settings_row and isinstance(settings_row.auto_reply, dict):
        if integration.messaging_permitted:
            delay = max(0, int(settings_row.auto_reply.get("replyDelaySec", 20)))
    await enqueue_job(
        session,
        kind="auto_reply",
        payload={"conversation_id": conversation.id, "inbound_message_id": inbound.id},
        delay_seconds=delay,
    )
    return {"status": "processed", "conversation_id": conversation.id, "message_id": inbound.id}
