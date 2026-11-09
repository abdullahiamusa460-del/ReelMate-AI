from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select

from app.api.deps import WorkspaceContext, workspace_context
from app.core.auth import sensitive_rate_limit
from app.core.logging import AppError
from app.models import Conversation, Message
from app.schemas import (
    ChatMessage,
    Conversation as ConversationSchema,
    ConversationListResponse,
    DraftRequest,
    DraftResponse,
    MessageCreate,
    SendMessageResponse,
)
from app.services.replies import manual_demo_send, manual_draft, manual_send
from app.services.serializers import conversation_to_schema, message_to_schema
from app.services.time import utc_now
from app.services.workspace import is_live

router = APIRouter(tags=["inbox"])


async def _get_conversation(ctx: WorkspaceContext, conversation_id: str) -> Conversation:
    conversation = await ctx.session.get(Conversation, conversation_id)
    if conversation is None or conversation.user_id != ctx.user.id:
        raise AppError("not_found", "Conversation not found.", status_code=404)
    return conversation


async def _messages(ctx: WorkspaceContext, conversation_id: str) -> list[Message]:
    return list(
        (
            await ctx.session.execute(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.created_at.asc())
            )
        ).scalars()
    )


@router.get("/inbox", response_model=ConversationListResponse, summary="List inbox conversations")
async def list_inbox(
    ctx: WorkspaceContext = Depends(workspace_context),
    query: str | None = Query(default=None, max_length=120),
    filter: str = Query(default="all", pattern="^(all|unread|reels)$"),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> ConversationListResponse:
    stmt = select(Conversation).where(Conversation.user_id == ctx.user.id)
    if filter == "unread":
        stmt = stmt.where(Conversation.unread_count > 0)
    elif filter == "reels":
        stmt = stmt.where(
            Conversation.id.in_(
                select(Message.conversation_id).where(Message.reel_id.is_not(None))
            )
        )
    if query:
        needle = f"%{query.lower()}%"
        matching_conversations = select(Message.conversation_id).where(
            func.lower(Message.text).like(needle)
        )
        stmt = stmt.where(
            or_(
                func.lower(Conversation.username).like(needle),
                func.lower(Conversation.display_name).like(needle),
                Conversation.id.in_(matching_conversations),
            )
        )
    total = int(
        (
            await ctx.session.execute(
                select(func.count()).select_from(stmt.subquery())
            )
        ).scalar_one()
    )
    conversations = list(
        (
            await ctx.session.execute(
                stmt.order_by(Conversation.last_message_at.desc()).limit(limit).offset(offset)
            )
        ).scalars()
    )
    unread_total = sum(conversation.unread_count for conversation in conversations)
    now = utc_now()
    payloads = []
    for conversation in conversations:
        payloads.append(
            conversation_to_schema(conversation, await _messages(ctx, conversation.id), now)
        )
    return ConversationListResponse(
        conversations=payloads, total=total, unread_total=unread_total
    )


@router.get("/conversations", response_model=ConversationListResponse, summary="List conversations")
async def list_conversations(
    ctx: WorkspaceContext = Depends(workspace_context),
) -> ConversationListResponse:
    return await list_inbox(ctx=ctx)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationSchema,
    summary="Get a conversation with messages",
)
async def get_conversation(
    conversation_id: str, ctx: WorkspaceContext = Depends(workspace_context)
) -> ConversationSchema:
    conversation = await _get_conversation(ctx, conversation_id)
    return conversation_to_schema(conversation, await _messages(ctx, conversation_id))


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[ChatMessage],
    summary="List messages in a conversation",
)
async def list_messages(
    conversation_id: str, ctx: WorkspaceContext = Depends(workspace_context)
) -> list[ChatMessage]:
    await _get_conversation(ctx, conversation_id)
    now = utc_now()
    return [message_to_schema(item, now) for item in await _messages(ctx, conversation_id)]


@router.post(
    "/conversations/{conversation_id}/read",
    summary="Mark a conversation as read",
)
async def mark_read(
    conversation_id: str, ctx: WorkspaceContext = Depends(workspace_context)
) -> dict:
    conversation = await _get_conversation(ctx, conversation_id)
    conversation.unread_count = 0
    return {"ok": True, "unread": 0}


@router.post(
    "/conversations/{conversation_id}/draft",
    response_model=DraftResponse,
    summary="Generate a reply draft without sending it",
    dependencies=[Depends(sensitive_rate_limit)],
)
async def create_draft(
    conversation_id: str,
    payload: DraftRequest,
    ctx: WorkspaceContext = Depends(workspace_context),
) -> DraftResponse:
    conversation = await _get_conversation(ctx, conversation_id)
    draft = await manual_draft(conversation, instruction=payload.instruction)
    return DraftResponse(
        text=draft.text,
        source=draft.source,  # type: ignore[arg-type]
        model=draft.model,
        delivered=False,
        warning=draft.warning,
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=SendMessageResponse,
    summary="Send a reply through the official Instagram API",
    dependencies=[Depends(sensitive_rate_limit)],
)
async def send_message(
    conversation_id: str,
    payload: MessageCreate,
    ctx: WorkspaceContext = Depends(workspace_context),
) -> SendMessageResponse:
    if not is_live(ctx.integration):
        message = await manual_demo_send(
            conversation_id, ctx.user.id, payload.text.strip()
        )
        return SendMessageResponse(
            message=message_to_schema(message),
            delivered=False,
            mode="demo",
            external_id=None,
            warning=(
                "Demo mode: the reply was stored as a sample message only. It was not "
                "transmitted to Instagram, and no delivery is claimed."
            ),
        )

    message = await manual_send(conversation_id, ctx.user.id, payload.text.strip())
    return SendMessageResponse(
        message=message_to_schema(message),
        delivered=True,
        mode="live",
        external_id=message.ig_message_id,
        warning=None,
    )
