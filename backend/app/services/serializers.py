from __future__ import annotations

from datetime import datetime

from app.models import ActivityLog, Conversation, Message, Reel, ReelAnalysis
from app.schemas import (
    ActivityItem,
    ChatMessage,
    Conversation as ConversationSchema,
    Reel as ReelSchema,
    ReelAnalysisResult,
    SuggestedReply,
)
from app.services.time import minutes_ago, utc_now


def _latest_analysis(reel: Reel) -> ReelAnalysis | None:
    if not reel.analyses:
        return None
    return max(reel.analyses, key=lambda item: item.created_at)


def analysis_to_schema(analysis: ReelAnalysis) -> ReelAnalysisResult:
    return ReelAnalysisResult(
        summary=analysis.summary,
        topics=list(analysis.topics or []),
        sentiment=analysis.sentiment,
        suggested_replies=[
            SuggestedReply(**item) for item in (analysis.suggested_replies or [])
        ],
        source=analysis.source,
        model=analysis.model,
        media_accessed=analysis.media_accessed,
        frames_analyzed=analysis.frames_analyzed,
        limitations=list(analysis.limitations or []),
    )


def message_to_schema(message: Message, now: datetime | None = None) -> ChatMessage:
    return ChatMessage(
        id=message.id,
        **{"from": "ai" if message.author == "ai" else "them"},
        text=message.text,
        minutes_ago=minutes_ago(message.created_at, now),
        reel_id=message.reel_id,
    )


def conversation_to_schema(
    conversation: Conversation,
    messages: list[Message],
    now: datetime | None = None,
) -> ConversationSchema:
    return ConversationSchema(
        id=conversation.id,
        username=conversation.username,
        display_name=conversation.display_name,
        hue=conversation.hue,
        unread=conversation.unread_count,
        messages=[message_to_schema(message, now) for message in messages],
        reply_status=conversation.reply_status,  # type: ignore[arg-type]
        is_message_request=conversation.is_message_request,
        eligible=conversation.eligible,
        eligibility_note=conversation.eligibility_note,
        is_demo=conversation.is_demo,
        last_message_at=conversation.last_message_at,
    )


def reel_to_schema(reel: Reel, now: datetime | None = None) -> ReelSchema:
    analysis = _latest_analysis(reel)
    suggestions = [
        SuggestedReply(**item) for item in ((analysis.suggested_replies if analysis else []) or [])
    ]
    accessible = bool(reel.accessible or reel.uploaded_path)
    reason = reel.inaccessible_reason
    if not accessible and not reason:
        reason = (
            "The Reel's media could not be accessed through the authorized account. "
            "Upload the video to analyse its actual content."
        )
    status = reel.analysis_status
    if analysis and status not in {"analyzing", "queued"}:
        status = "analyzed"
    if not accessible and status not in {"analyzed"}:
        status = "unavailable"

    return ReelSchema(
        id=reel.id,
        conversation_id=reel.conversation_id,
        shared_by=reel.shared_by,
        creator=reel.creator,
        caption=reel.caption,
        duration_sec=reel.duration_sec,
        views=reel.views,
        likes=reel.likes,
        audio=reel.audio,
        received_minutes_ago=minutes_ago(reel.received_at, now),
        accessible=accessible,
        inaccessible_reason=reason,
        summary=analysis.summary if analysis else None,
        topics=list(analysis.topics or []) if analysis else [],
        sentiment=analysis.sentiment if analysis else None,
        suggested_replies=suggestions,
        hues=list(reel.hues or [265, 220]),
        is_demo=reel.is_demo,
        analysis_status=status,
        analysis_source=analysis.source if analysis else None,
        analysis_model=analysis.model if analysis else None,
        media_accessed=bool(analysis.media_accessed) if analysis else False,
        limitations=list(analysis.limitations or []) if analysis else [],
        upload_available=True,
        upload_required=not accessible,
    )


def activity_to_schema(item: ActivityLog, now: datetime | None = None) -> ActivityItem:
    return ActivityItem(
        id=item.id,
        kind=item.kind,  # type: ignore[arg-type]
        status=item.status,  # type: ignore[arg-type]
        title=item.title,
        detail=item.detail,
        username=item.username,
        minutes_ago=minutes_ago(item.created_at, now),
        conversation_id=item.conversation_id,
        is_demo=item.is_demo,
        created_at=item.created_at,
    )


def build_context_preview(conversation: Conversation, messages: list[Message]) -> str:
    lines: list[str] = []
    for message in messages[-10:]:
        who = "Me" if message.author in {"ai", "user"} else conversation.display_name
        text = message.text or "[shared a Reel]"
        lines.append(f"{who}: {text}")
    return "\n".join(lines)


def current_time() -> datetime:
    return utc_now()
