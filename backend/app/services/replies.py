from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.logging import AppError
from app.models import AISettings, Conversation, Integration, Message, Reel
from app.services.activity import add_activity
from app.services.ai import get_ai_provider
from app.services.ai.base import AIError, ReplyContext
from app.services.ai.template import template_reply
from app.services.instagram import InstagramAPIError, client_for_integration
from app.services.reel_analysis import latest_analysis
from app.services.serializers import build_context_preview, message_to_schema
from app.services.time import utc_now
from app.services.workspace import is_live, require_live_delivery

logger = logging.getLogger("reelmate.replies")

SENSITIVE_KEYWORDS = {
    "suicide",
    "self harm",
    "self-harm",
    "kill myself",
    "abuse",
    "assault",
    "diagnosis",
    "medication",
    "lawsuit",
    "bank account",
    "refund",
    "invoice",
    "crypto investment",
}


@dataclass
class Draft:
    text: str
    source: str
    model: str | None
    warning: str | None = None


@dataclass
class Eligibility:
    eligible: bool
    note: str
    hold_for_review: bool = False


def _settings_auto(settings_row: AISettings) -> dict:
    value = settings_row.auto_reply or {}
    return {
        "sendMode": value.get("sendMode", "automatic"),
        "onlyWithReels": bool(value.get("onlyWithReels", False)),
        "skipMessageRequests": bool(value.get("skipMessageRequests", True)),
        "skipGroupChats": bool(value.get("skipGroupChats", True)),
        "pauseForSensitiveTopics": bool(value.get("pauseForSensitiveTopics", True)),
        "replyDelaySec": int(value.get("replyDelaySec", 20)),
        "maxPerHour": int(value.get("maxPerHour", 30)),
        "quietHours": value.get("quietHours", {"enabled": False, "start": "23:00", "end": "07:00"}),
        "excludeKeywords": str(value.get("excludeKeywords", "")),
    }


def _in_quiet_hours(quiet: dict) -> bool:
    if not quiet.get("enabled"):
        return False
    try:
        start_h, start_m = [int(part) for part in str(quiet.get("start", "23:00")).split(":")]
        end_h, end_m = [int(part) for part in str(quiet.get("end", "07:00")).split(":")]
    except (ValueError, TypeError):
        return False
    try:
        zone = ZoneInfo(settings.app_timezone)
    except ZoneInfoNotFoundError:
        zone = timezone.utc
    now = datetime.now(zone)
    current = now.hour * 60 + now.minute
    start = start_h * 60 + start_m
    end = end_h * 60 + end_m
    if start == end:
        return True
    if start < end:
        return start <= current < end
    return current >= start or current < end


def _keyword_hit(text: str, keywords: set[str]) -> str | None:
    lowered = text.lower()
    for keyword in keywords:
        if keyword and keyword in lowered:
            return keyword
    return None


async def count_recent_ai_replies(session: AsyncSession, user_id: str) -> int:
    since = utc_now().timestamp() - 3600
    since_dt = datetime.fromtimestamp(since, tz=timezone.utc)
    result = await session.execute(
        select(func.count(Message.id)).where(
            Message.user_id == user_id,
            Message.author == "ai",
            Message.delivered.is_(True),
            Message.created_at >= since_dt,
        )
    )
    return int(result.scalar_one())


async def assess_eligibility(
    session: AsyncSession,
    *,
    conversation: Conversation,
    settings_row: AISettings,
    integration: Integration,
    message_text: str,
    has_reel: bool,
) -> Eligibility:
    auto = _settings_auto(settings_row)
    live = is_live(integration)

    if not settings_row.ai_enabled:
        return Eligibility(False, "Skipped: the assistant is paused.")
    if not live:
        return Eligibility(
            True,
            "Demo mode: a draft can be generated, but delivery is impossible without "
            "an eligible connected account.",
        )
    if auto["skipMessageRequests"] and conversation.is_message_request:
        return Eligibility(False, "Skipped: message request from an account you don't follow.")
    if auto["skipGroupChats"] and conversation.is_group:
        return Eligibility(False, "Skipped: group chats are disabled in settings.")
    if auto["onlyWithReels"] and not has_reel:
        return Eligibility(False, "Skipped: settings require a shared Reel.")
    if _in_quiet_hours(auto["quietHours"]):
        return Eligibility(False, "Skipped: quiet hours are active.")

    excluded = {
        item.strip().lower()
        for item in auto["excludeKeywords"].split(",")
        if item.strip()
    }
    if excluded:
        hit = _keyword_hit(message_text, excluded)
        if hit:
            return Eligibility(False, f"Skipped: excluded keyword “{hit}” was present.")

    if auto["pauseForSensitiveTopics"]:
        hit = _keyword_hit(message_text, SENSITIVE_KEYWORDS)
        if hit:
            return Eligibility(
                True,
                f"Held for review: sensitive topic “{hit}” detected.",
                hold_for_review=True,
            )

    recent = await count_recent_ai_replies(session, settings_row.user_id)
    if recent >= auto["maxPerHour"]:
        return Eligibility(
            False,
            f"Skipped: hourly limit of {auto['maxPerHour']} automatic replies reached.",
        )

    if auto["sendMode"] == "review":
        return Eligibility(True, "Draft held for review by your send-mode setting.", hold_for_review=True)

    if not integration.messaging_permitted:
        return Eligibility(
            True,
            "Draft held: messaging permission has not been confirmed for this account.",
            hold_for_review=True,
        )

    return Eligibility(True, "Eligible for automatic handling.")


async def _load_reply_context(
    session: AsyncSession,
    conversation: Conversation,
    *,
    instruction: str | None = None,
) -> tuple[AISettings, Integration, ReplyContext, Reel | None]:
    settings_row = (
        await session.execute(select(AISettings).where(AISettings.user_id == conversation.user_id))
    ).scalar_one()
    integration = (
        await session.execute(
            select(Integration).where(
                Integration.user_id == conversation.user_id,
                Integration.provider == "instagram",
            )
        )
    ).scalar_one()
    messages = list(
        (
            await session.execute(
                select(Message)
                .where(Message.conversation_id == conversation.id)
                .order_by(Message.created_at.asc())
                .limit(20)
            )
        ).scalars()
    )
    reel = (
        await session.execute(
            select(Reel)
            .where(Reel.conversation_id == conversation.id)
            .options(selectinload(Reel.analyses))
            .order_by(Reel.received_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    analysis = latest_analysis(reel) if reel else None

    preview = build_context_preview(conversation, messages)
    if instruction:
        preview += f"\nOwner note for this draft: {instruction}"

    context = ReplyContext(
        conversation_preview=preview,
        sender_name=conversation.display_name,
        reel_summary=analysis.summary if analysis else None,
        reel_topics=list(analysis.topics or []) if analysis else [],
        personality=settings_row.personality,
        tone=settings_row.tone,
        language=settings_row.language,
        length=settings_row.length,
        include_emoji=settings_row.include_emoji,
        custom_instructions=settings_row.custom_instructions,
        has_reel=reel is not None,
    )
    return settings_row, integration, context, reel


async def generate_reply(
    session: AsyncSession,
    conversation: Conversation,
    *,
    instruction: str | None = None,
) -> Draft:
    _, _, context, _ = await _load_reply_context(session, conversation, instruction=instruction)
    provider = get_ai_provider()
    if provider is not None:
        try:
            text = await provider.generate_reply(context)
            return Draft(text=text, source="model", model=provider.model)
        except AIError as exc:
            logger.warning("AI reply failed; using template fallback: %s", exc.message)
            return Draft(
                text=template_reply(context),
                source="template",
                model=None,
                warning=(
                    "The AI provider failed, so a template draft was created instead. "
                    "It was not sent automatically."
                ),
            )
    return Draft(
        text=template_reply(context),
        source="template",
        model=None,
        warning=(
            "No AI provider is configured. This is a template draft, not a model reply, "
            "and it is never sent automatically."
        ),
    )


def _new_message(
    *,
    conversation: Conversation,
    text: str,
    direction: str,
    author: str,
    delivery_status: str,
    delivered: bool = False,
    error: str | None = None,
    reel_id: str | None = None,
    is_demo: bool = True,
) -> Message:
    now = utc_now()
    return Message(
        id=str(uuid.uuid4()),
        user_id=conversation.user_id,
        conversation_id=conversation.id,
        direction=direction,
        author=author,
        text=text,
        reel_id=reel_id,
        delivery_status=delivery_status,
        delivered=delivered,
        error=error,
        is_demo=is_demo,
        created_at=now,
        updated_at=now,
        sent_at=now if delivered else None,
    )


async def deliver_message(
    session: AsyncSession,
    *,
    conversation: Conversation,
    integration: Integration,
    text: str,
) -> Message:
    require_live_delivery(integration)
    if not conversation.ig_user_id:
        raise AppError(
            "missing_recipient",
            "This conversation has no Instagram recipient id, so it cannot be sent.",
            status_code=409,
        )
    message = _new_message(
        conversation=conversation,
        text=text,
        direction="outbound",
        author="ai",
        delivery_status="queued",
        is_demo=False,
    )
    session.add(message)
    await session.flush()

    try:
        response = await client_for_integration(integration).send_message(
            conversation.ig_user_id, text
        )
    except InstagramAPIError as exc:
        message.delivery_status = "failed"
        message.delivered = False
        message.error = exc.message
        conversation.reply_status = "needs_review"
        add_activity(
            session,
            user_id=conversation.user_id,
            kind="reply",
            status="failed",
            title="Reply was not sent",
            detail=exc.message,
            username=conversation.username,
            conversation_id=conversation.id,
            is_demo=False,
            meta={"delivered": False},
        )
        raise AppError(
            "instagram_send_failed",
            exc.message,
            status_code=502,
            details={"delivered": False},
        ) from exc

    message.delivery_status = "sent"
    message.delivered = True
    message.sent_at = utc_now()
    message.ig_message_id = str(response.get("message_id") or "") or None
    conversation.reply_status = "auto_replied"
    conversation.last_message_at = utc_now()
    add_activity(
        session,
        user_id=conversation.user_id,
        kind="reply",
        status="completed",
        title="Reply sent via Instagram",
        detail=text[:160],
        username=conversation.username,
        conversation_id=conversation.id,
        is_demo=False,
        meta={"delivered": True, "messageId": message.ig_message_id},
    )
    return message


async def store_draft(
    session: AsyncSession,
    *,
    conversation: Conversation,
    draft: Draft,
    reason: str,
) -> Message:
    message = _new_message(
        conversation=conversation,
        text=draft.text,
        direction="outbound",
        author="ai",
        delivery_status="draft",
        delivered=False,
        is_demo=not is_live(
            (
                await session.execute(
                    select(Integration).where(
                        Integration.user_id == conversation.user_id,
                        Integration.provider == "instagram",
                    )
                )
            ).scalar_one()
        ),
    )
    session.add(message)
    conversation.reply_status = "needs_review"
    conversation.eligibility_note = reason
    await session.flush()
    add_activity(
        session,
        user_id=conversation.user_id,
        kind="reply",
        status="completed",
        title="Reply draft generated — not sent",
        detail=(
            f"{draft.text[:140]}"
            + (" (template fallback)" if draft.source == "template" else "")
        ),
        username=conversation.username,
        conversation_id=conversation.id,
        is_demo=message.is_demo,
        meta={"delivered": False, "source": draft.source, "reason": reason},
    )
    return message


async def run_auto_reply(conversation_id: str, inbound_message_id: str) -> dict:
    from app.core.database import session_scope

    async with session_scope() as session:
        conversation = await session.get(Conversation, conversation_id)
        inbound = await session.get(Message, inbound_message_id)
        if conversation is None or inbound is None:
            return {"status": "skipped", "reason": "conversation or message missing"}

        settings_row = (
            await session.execute(
                select(AISettings).where(AISettings.user_id == conversation.user_id)
            )
        ).scalar_one()
        integration = (
            await session.execute(
                select(Integration).where(
                    Integration.user_id == conversation.user_id,
                    Integration.provider == "instagram",
                )
            )
        ).scalar_one()

        reel_count = await session.execute(
            select(func.count(Reel.id)).where(Reel.conversation_id == conversation.id)
        )
        has_reel = int(reel_count.scalar_one()) > 0
        eligibility = await assess_eligibility(
            session,
            conversation=conversation,
            settings_row=settings_row,
            integration=integration,
            message_text=inbound.text,
            has_reel=has_reel,
        )
        conversation.eligible = eligibility.eligible
        conversation.eligibility_note = eligibility.note
        if not eligibility.eligible:
            conversation.reply_status = "skipped"
            add_activity(
                session,
                user_id=conversation.user_id,
                kind="message",
                status="skipped",
                title="Message skipped",
                detail=eligibility.note,
                username=conversation.username,
                conversation_id=conversation.id,
                is_demo=not is_live(integration),
            )
            return {"status": "skipped", "reason": eligibility.note}

        draft = await generate_reply(session, conversation)
        auto = _settings_auto(settings_row)

        if (
            not eligibility.hold_for_review
            and draft.source == "model"
            and is_live(integration)
            and integration.messaging_permitted
            and auto["sendMode"] == "automatic"
        ):
            message = await deliver_message(
                session, conversation=conversation, integration=integration, text=draft.text
            )
            return {
                "status": "sent",
                "delivered": True,
                "message_id": message.id,
                "source": draft.source,
            }

        reason = eligibility.note
        if not is_live(integration):
            reason = "Demo mode: draft generated, not sent."
        elif draft.source != "model":
            reason = "Draft held: no multimodal AI provider is configured."
        elif auto["sendMode"] == "review":
            reason = "Draft held for review by your send-mode setting."
        elif eligibility.hold_for_review:
            reason = eligibility.note
        message = await store_draft(
            session, conversation=conversation, draft=draft, reason=reason
        )
        return {
            "status": "draft",
            "delivered": False,
            "message_id": message.id,
            "source": draft.source,
            "warning": draft.warning,
        }


async def manual_draft(conversation: Conversation, instruction: str | None = None) -> Draft:
    from app.core.database import session_scope

    async with session_scope() as session:
        conversation = await session.get(Conversation, conversation.id)
        if conversation is None:
            raise AppError("not_found", "Conversation not found.", status_code=404)
        return await generate_reply(session, conversation, instruction=instruction)


async def manual_demo_send(conversation_id: str, user_id: str, text: str) -> Message:
    """Store an outbound message in the demo workspace without any delivery claim."""
    from app.core.database import session_scope

    async with session_scope() as session:
        conversation = await session.get(Conversation, conversation_id)
        if conversation is None or conversation.user_id != user_id:
            raise AppError("not_found", "Conversation not found.", status_code=404)
        if not conversation.is_demo:
            raise AppError(
                "demo_mode_no_delivery",
                "This conversation is not a demo conversation and cannot be simulated.",
                status_code=409,
            )
        message = _new_message(
            conversation=conversation,
            text=text,
            direction="outbound",
            author="ai",
            delivery_status="simulated",
            delivered=False,
            is_demo=True,
        )
        session.add(message)
        conversation.last_message_at = utc_now()
        await session.flush()
        add_activity(
            session,
            user_id=conversation.user_id,
            kind="reply",
            status="completed",
            title="Demo reply added — not sent",
            detail=text[:160],
            username=conversation.username,
            conversation_id=conversation.id,
            is_demo=True,
            meta={"delivered": False, "mode": "demo"},
        )
        return message


async def manual_send(conversation_id: str, user_id: str, text: str) -> Message:
    from app.core.database import session_scope

    async with session_scope() as session:
        conversation = await session.get(Conversation, conversation_id)
        if conversation is None or conversation.user_id != user_id:
            raise AppError("not_found", "Conversation not found.", status_code=404)
        integration = (
            await session.execute(
                select(Integration).where(
                    Integration.user_id == user_id, Integration.provider == "instagram"
                )
            )
        ).scalar_one()
        return await deliver_message(
            session, conversation=conversation, integration=integration, text=text.strip()
        )
