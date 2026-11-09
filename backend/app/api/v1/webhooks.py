from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import general_rate_limit
from app.core.config import settings
from app.core.database import get_session
from app.core.logging import AppError
from app.core.security import hash_payload, verify_meta_signature
from app.models import WebhookEvent
from app.workers.queue import enqueue_job

logger = logging.getLogger("reelmate.api.webhooks")

router = APIRouter(tags=["webhooks"], prefix="/webhooks")


@router.get(
    "/instagram",
    response_class=PlainTextResponse,
    summary="Meta webhook verification challenge",
    dependencies=[Depends(general_rate_limit)],
)
async def verify_instagram_webhook(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> PlainTextResponse:
    expected = settings.ig_webhook_verify_token
    if not expected:
        raise AppError(
            "webhook_not_configured",
            "IG_WEBHOOK_VERIFY_TOKEN is not configured on the backend.",
            status_code=503,
        )
    if hub_mode != "subscribe":
        raise AppError("invalid_webhook_mode", "Unsupported webhook mode.", status_code=400)
    if hub_verify_token != expected:
        logger.warning("rejected Instagram webhook verification with a bad token")
        raise AppError("invalid_webhook_token", "Webhook verify token mismatch.", status_code=403)
    return PlainTextResponse(hub_challenge or "")


@router.post(
    "/instagram",
    summary="Receive Meta Instagram webhook events",
    dependencies=[Depends(general_rate_limit)],
)
async def receive_instagram_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict:
    raw_body = await request.body()
    if len(raw_body) > 2_000_000:
        raise AppError("payload_too_large", "Webhook payload is too large.", status_code=413)
    if not verify_meta_signature(raw_body, request.headers.get("x-hub-signature-256")):
        logger.warning("rejected Instagram webhook with an invalid signature")
        raise AppError(
            "invalid_signature",
            "The webhook signature could not be verified.",
            status_code=401,
        )

    try:
        payload = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise AppError("invalid_json", "Webhook body is not valid JSON.", status_code=400) from exc
    if not isinstance(payload, dict):
        raise AppError("invalid_payload", "Webhook body must be a JSON object.", status_code=400)

    event_hash = hash_payload(raw_body)
    existing = (
        await session.execute(
            select(WebhookEvent).where(WebhookEvent.event_hash == event_hash)
        )
    ).scalar_one_or_none()
    if existing is not None:
        return {"received": True, "duplicate": True, "eventId": existing.id}

    event = WebhookEvent(
        id=str(uuid.uuid4()),
        event_hash=event_hash,
        object_type=str(payload.get("object") or "unknown")[:48],
        payload=payload,
        status="queued",
    )
    session.add(event)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        return {"received": True, "duplicate": True}

    await enqueue_job(
        session, kind="process_webhook", payload={"webhook_event_id": event.id}
    )
    logger.info("webhook event queued", extra={"webhook_event_id": event.id})
    return {"received": True, "duplicate": False, "eventId": event.id}
