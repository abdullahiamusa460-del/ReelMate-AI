from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models import Conversation, Message, Reel, ReelAnalysis
from app.services.activity import add_activity
from app.services.ai import get_ai_provider
from app.services.ai.base import AIError, MediaUnavailable, ReelContext
from app.services.serializers import analysis_to_schema, build_context_preview
from app.services.time import utc_now
from app.workers.queue import PermanentJobError

logger = logging.getLogger("reelmate.reel_analysis")

DEMO_ANALYSIS_LIMITATION = (
    "Pre-written sample analysis for the demo workspace. No video was downloaded, "
    "watched, or sent to an AI model."
)


async def load_reel(session: AsyncSession, reel_id: str, user_id: str) -> Reel | None:
    result = await session.execute(
        select(Reel)
        .where(Reel.id == reel_id, Reel.user_id == user_id)
        .options(selectinload(Reel.analyses))
    )
    return result.scalar_one_or_none()


def latest_analysis(reel: Reel) -> ReelAnalysis | None:
    if not reel.analyses:
        return None
    return max(reel.analyses, key=lambda item: item.created_at)


async def create_demo_analysis(session: AsyncSession, reel: Reel) -> ReelAnalysis | None:
    if not reel.demo_analysis:
        return None
    existing = latest_analysis(reel)
    if existing is not None:
        return existing
    payload = reel.demo_analysis
    analysis = ReelAnalysis(
        id=str(uuid.uuid4()),
        reel_id=reel.id,
        user_id=reel.user_id,
        source="demo_seed",
        model=None,
        media_accessed=False,
        frames_analyzed=0,
        summary=str(payload.get("summary", "")),
        topics=list(payload.get("topics", [])),
        sentiment=str(payload.get("sentiment", "Neutral")),
        suggested_replies=list(payload.get("suggestedReplies") or payload.get("suggested_replies") or []),
        limitations=[DEMO_ANALYSIS_LIMITATION],
    )
    session.add(analysis)
    reel.analysis_status = "analyzed"
    await session.flush()
    add_activity(
        session,
        user_id=reel.user_id,
        kind="reel",
        status="completed",
        title="Demo Reel analysis loaded",
        detail=(
            f"{reel.caption[:90]} — pre-written sample. No video was watched and no "
            "AI model was called."
        ),
        username=reel.shared_by,
        conversation_id=reel.conversation_id,
        reel_id=reel.id,
        is_demo=True,
    )
    return analysis


async def run_reel_analysis(reel_id: str, *, force: bool = False) -> dict:
    """Background job body. Only returns success after actual media was analysed."""
    from app.core.database import session_scope

    async with session_scope() as session:
        result = await session.execute(
            select(Reel).where(Reel.id == reel_id).options(selectinload(Reel.analyses))
        )
        reel = result.scalar_one_or_none()
        if reel is None:
            raise PermanentJobError("The Reel no longer exists.")

        existing = latest_analysis(reel)
        if existing is not None and not force:
            return analysis_to_schema(existing).model_dump(by_alias=True)

        reel.analysis_status = "analyzing"
        await session.flush()

        provider = get_ai_provider()
        if provider is None:
            reel.analysis_status = "failed"
            add_activity(
                session,
                user_id=reel.user_id,
                kind="reel",
                status="failed",
                title="Reel analysis needs an AI provider",
                detail=(
                    "No multimodal AI provider is configured. Set AI_PROVIDER and "
                    "AI_API_KEY on the backend, then retry."
                ),
                username=reel.shared_by,
                conversation_id=reel.conversation_id,
                reel_id=reel.id,
                is_demo=False,
            )
            raise PermanentJobError(
                "No multimodal AI provider is configured. A template cannot analyse video."
            )

        try:
            bundle = await prepare_media(reel, provider.supports_direct_video)
            conversation = await session.get(Conversation, reel.conversation_id)
            messages = list(
                (
                    await session.execute(
                        select(Message)
                        .where(Message.conversation_id == reel.conversation_id)
                        .order_by(Message.created_at.asc())
                        .limit(20)
                    )
                ).scalars()
            )
            preview = (
                build_context_preview(conversation, messages) if conversation else ""
            )
            context = ReelContext(
                caption=reel.caption,
                creator=reel.creator,
                shared_by=reel.shared_by,
                duration_sec=reel.duration_sec,
                audio=reel.audio,
                conversation_preview=preview,
            )
            payload = await provider.analyze_reel(bundle, context)

            limitations = list(payload.limitations)
            limitations.extend(bundle.limitations)
            # De-duplicate while preserving order.
            limitations = list(dict.fromkeys(limitations))

            analysis = ReelAnalysis(
                id=str(uuid.uuid4()),
                reel_id=reel.id,
                user_id=reel.user_id,
                source="model",
                model=payload.model,
                media_accessed=True,
                frames_analyzed=payload.frames_analyzed,
                summary=payload.summary,
                topics=payload.topics,
                sentiment=payload.sentiment,
                suggested_replies=payload.suggested_replies,
                limitations=limitations,
            )
            session.add(analysis)
            reel.analysis_status = "analyzed"
            if bundle.duration_sec and not reel.duration_sec:
                reel.duration_sec = bundle.duration_sec
            await session.flush()
            add_activity(
                session,
                user_id=reel.user_id,
                kind="reel",
                status="completed",
                title="Reel analysed from actual media",
                detail=(
                    f"{reel.caption[:80]} — {payload.model}; "
                    f"{payload.frames_analyzed or 'direct video'} frame(s) processed."
                ),
                username=reel.shared_by,
                conversation_id=reel.conversation_id,
                reel_id=reel.id,
                is_demo=False,
            )
            return analysis_to_schema(analysis).model_dump(by_alias=True)
        except MediaUnavailable as exc:
            reel.analysis_status = "failed"
            add_activity(
                session,
                user_id=reel.user_id,
                kind="reel",
                status="failed",
                title="Reel media unavailable",
                detail=exc.message,
                username=reel.shared_by,
                conversation_id=reel.conversation_id,
                reel_id=reel.id,
                is_demo=reel.is_demo,
            )
            raise PermanentJobError(exc.message) from exc
        except AIError as exc:
            reel.analysis_status = "failed"
            add_activity(
                session,
                user_id=reel.user_id,
                kind="reel",
                status="failed",
                title="Reel analysis failed",
                detail=exc.message,
                username=reel.shared_by,
                conversation_id=reel.conversation_id,
                reel_id=reel.id,
                is_demo=False,
            )
            raise PermanentJobError(exc.message) from exc
        except Exception as exc:  # noqa: BLE001
            reel.analysis_status = "failed"
            logger.exception("reel analysis failed for %s", reel.id)
            raise


async def prepare_media(reel: Reel, direct_video: bool):
    from app.services.media import prepare_reel_media

    return await prepare_reel_media(reel, direct_video=direct_video)


async def analyze_now_or_queue(session: AsyncSession, reel: Reel, force: bool) -> dict:
    """Endpoint helper: demo sample returns immediately, everything else queues."""
    existing = latest_analysis(reel)
    if existing is not None and not force:
        return {
            "status": "analyzed",
            "analysis": analysis_to_schema(existing).model_dump(by_alias=True),
            "message": "Existing analysis returned.",
            "upload_required": False,
        }

    if reel.is_demo and reel.demo_analysis:
        analysis = await create_demo_analysis(session, reel)
        if analysis is not None:
            return {
                "status": "analyzed",
                "analysis": analysis_to_schema(analysis).model_dump(by_alias=True),
                "message": (
                    "Pre-written demo analysis loaded. No video was downloaded or watched."
                ),
                "upload_required": False,
            }

    accessible = bool(reel.accessible or reel.uploaded_path)
    if not accessible:
        return {
            "status": "unavailable",
            "analysis": None,
            "message": (
                "The authorized account could not access this Reel's media. A URL or "
                "caption alone is never summarised. Upload the video to continue."
            ),
            "upload_required": True,
        }

    if not settings.ai_configured:
        return {
            "status": "failed",
            "analysis": None,
            "message": (
                "Actual media is available, but no multimodal AI provider is configured. "
                "Set AI_PROVIDER and AI_API_KEY to analyse it."
            ),
            "upload_required": False,
        }

    from app.workers import enqueue_job

    job = await enqueue_job(
        session, kind="analyze_reel", payload={"reel_id": reel.id, "force": force}
    )
    reel.analysis_status = "queued"
    return {
        "status": "queued",
        "job_id": job.id,
        "analysis": None,
        "message": "Analysis queued. The worker will download the actual media and analyse it.",
        "upload_required": False,
    }
