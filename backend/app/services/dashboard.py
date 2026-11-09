from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActivityLog, Conversation, Message, Reel, ReelAnalysis
from app.schemas import DashboardStats, DashboardResponse
from app.services.serializers import activity_to_schema, conversation_to_schema
from app.services.time import utc_now
from app.services.workspace import assistant_status


async def _messages_for_conversations(
    session: AsyncSession, conversation_ids: list[str]
) -> dict[str, list[Message]]:
    if not conversation_ids:
        return {}
    rows = list(
        (
            await session.execute(
                select(Message)
                .where(Message.conversation_id.in_(conversation_ids))
                .order_by(Message.created_at.asc())
            )
        ).scalars()
    )
    grouped: dict[str, list[Message]] = {cid: [] for cid in conversation_ids}
    for message in rows:
        grouped.setdefault(message.conversation_id, []).append(message)
    return grouped


async def conversation_payloads(
    session: AsyncSession, conversations: list[Conversation]
) -> list:
    now = utc_now()
    grouped = await _messages_for_conversations(
        session, [conversation.id for conversation in conversations]
    )
    return [
        conversation_to_schema(conversation, grouped.get(conversation.id, []), now)
        for conversation in conversations
    ]


def _pct_delta(current: int, previous: int) -> float:
    if previous <= 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 1)


async def _average_response_seconds(session: AsyncSession, user_id: str) -> int:
    rows = list(
        (
            await session.execute(
                select(Message)
                .where(Message.user_id == user_id)
                .order_by(Message.conversation_id, Message.created_at)
            )
        ).scalars()
    )
    last_inbound: dict[str, object] = {}
    deltas: list[float] = []
    for message in rows:
        if message.direction == "inbound":
            last_inbound[message.conversation_id] = message.created_at
        elif (
            message.direction == "outbound"
            and message.delivered
            and message.conversation_id in last_inbound
        ):
            inbound_at = last_inbound.pop(message.conversation_id)
            try:
                deltas.append((message.created_at - inbound_at).total_seconds())  # type: ignore[operator]
            except TypeError:
                pass
    if not deltas:
        return 0
    return max(1, int(sum(deltas) / len(deltas)))


async def build_dashboard(session: AsyncSession, user_id: str, settings, integration) -> DashboardResponse:
    now = utc_now()
    week_start = now - timedelta(days=7)
    prior_start = now - timedelta(days=14)

    total_messages = int(
        (
            await session.execute(
                select(func.count(Message.id)).where(
                    Message.user_id == user_id, Message.direction == "inbound"
                )
            )
        ).scalar_one()
    )
    reels_processed = int(
        (
            await session.execute(
                select(func.count(func.distinct(ReelAnalysis.reel_id))).where(
                    ReelAnalysis.user_id == user_id
                )
            )
        ).scalar_one()
    )
    auto_replies = int(
        (
            await session.execute(
                select(func.count(Message.id)).where(
                    Message.user_id == user_id,
                    Message.author == "ai",
                    Message.delivered.is_(True),
                )
            )
        ).scalar_one()
    )

    inbound_rows = list(
        (
            await session.execute(
                select(Message.created_at).where(
                    Message.user_id == user_id,
                    Message.direction == "inbound",
                    Message.created_at >= prior_start,
                )
            )
        ).scalars()
    )
    weekly = [0] * 7
    previous_week = 0
    for created_at in inbound_rows:
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=now.tzinfo)
        if created_at >= week_start:
            index = min(6, max(0, (created_at.date() - week_start.date()).days))
            weekly[index] += 1
        else:
            previous_week += 1
    current_week = sum(weekly)

    replies_current = int(
        (
            await session.execute(
                select(func.count(Message.id)).where(
                    Message.user_id == user_id,
                    Message.author == "ai",
                    Message.delivered.is_(True),
                    Message.created_at >= week_start,
                )
            )
        ).scalar_one()
    )
    replies_previous = int(
        (
            await session.execute(
                select(func.count(Message.id)).where(
                    Message.user_id == user_id,
                    Message.author == "ai",
                    Message.delivered.is_(True),
                    Message.created_at >= prior_start,
                    Message.created_at < week_start,
                )
            )
        ).scalar_one()
    )
    reels_current = int(
        (
            await session.execute(
                select(func.count(ReelAnalysis.id)).where(
                    ReelAnalysis.user_id == user_id, ReelAnalysis.created_at >= week_start
                )
            )
        ).scalar_one()
    )
    reels_previous = int(
        (
            await session.execute(
                select(func.count(ReelAnalysis.id)).where(
                    ReelAnalysis.user_id == user_id,
                    ReelAnalysis.created_at >= prior_start,
                    ReelAnalysis.created_at < week_start,
                )
            )
        ).scalar_one()
    )

    stats = DashboardStats(
        total_messages=total_messages,
        reels_processed=reels_processed,
        auto_replies=auto_replies,
        avg_response_sec=await _average_response_seconds(session, user_id),
        weekly=weekly,
        deltas={
            "messages": _pct_delta(current_week, previous_week),
            "reels": _pct_delta(reels_current, reels_previous),
            "replies": _pct_delta(replies_current, replies_previous),
        },
    )

    recent = list(
        (
            await session.execute(
                select(ActivityLog)
                .where(ActivityLog.user_id == user_id)
                .order_by(ActivityLog.created_at.desc())
                .limit(6)
            )
        ).scalars()
    )
    attention_rows = list(
        (
            await session.execute(
                select(Conversation)
                .where(
                    Conversation.user_id == user_id,
                    Conversation.reply_status.in_(["needs_review", "pending"]),
                )
                .order_by(Conversation.last_message_at.desc())
                .limit(6)
            )
        ).scalars()
    )

    return DashboardResponse(
        stats=stats,
        recent_activity=[activity_to_schema(item, now) for item in recent],
        attention=await conversation_payloads(session, attention_rows),
        connection=assistant_status(settings, integration).connection,
        status=assistant_status(settings, integration),
        generated_at=now,
    )
