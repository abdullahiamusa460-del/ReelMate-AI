"""Job handler registration. Imported once by the worker."""

from __future__ import annotations

from app.services.replies import run_auto_reply
from app.services.reel_analysis import run_reel_analysis
from app.services.webhook_processor import process_webhook_event
from app.workers.worker import register_handler


async def handle_analyze_reel(payload: dict) -> dict:
    return await run_reel_analysis(
        payload["reel_id"], force=bool(payload.get("force", False))
    )


async def handle_auto_reply(payload: dict) -> dict:
    return await run_auto_reply(payload["conversation_id"], payload["inbound_message_id"])


async def handle_webhook(payload: dict) -> dict:
    return await process_webhook_event(payload["webhook_event_id"])


register_handler("analyze_reel", handle_analyze_reel)
register_handler("auto_reply", handle_auto_reply)
register_handler("process_webhook", handle_webhook)
