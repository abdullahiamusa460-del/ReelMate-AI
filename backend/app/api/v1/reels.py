from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import WorkspaceContext, workspace_context
from app.core.auth import sensitive_rate_limit
from app.core.config import settings
from app.core.logging import AppError
from app.models import Reel
from app.schemas import AnalyzeRequest, AnalyzeResponse, Reel as ReelSchema, ReelListResponse
from app.services.activity import add_activity
from app.services.reel_analysis import analyze_now_or_queue, load_reel
from app.services.serializers import reel_to_schema
from app.services.time import utc_now

router = APIRouter(tags=["reels"])

_ALLOWED_VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm"}
_ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}


async def _get_reel(ctx: WorkspaceContext, reel_id: str) -> Reel:
    reel = await load_reel(ctx.session, reel_id, ctx.user.id)
    if reel is None:
        raise AppError("not_found", "Reel not found.", status_code=404)
    return reel


@router.get("/reels", response_model=ReelListResponse, summary="List shared Reels")
async def list_reels(
    ctx: WorkspaceContext = Depends(workspace_context),
    filter: str = Query(default="all", pattern="^(all|analyzed|awaiting|analyzing|unavailable)$"),
    query: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> ReelListResponse:
    reels = list(
        (
            await ctx.session.execute(
                select(Reel)
                .where(Reel.user_id == ctx.user.id)
                .options(selectinload(Reel.analyses))
                .order_by(Reel.received_at.desc())
            )
        ).scalars()
    )
    now = utc_now()
    payload = [reel_to_schema(reel, now) for reel in reels]
    if filter == "analyzed":
        payload = [item for item in payload if item.analysis_status == "analyzed"]
    elif filter == "awaiting":
        payload = [item for item in payload if item.analysis_status in {"pending", "queued"}]
    elif filter == "analyzing":
        payload = [item for item in payload if item.analysis_status == "analyzing"]
    elif filter == "unavailable":
        payload = [item for item in payload if item.analysis_status == "unavailable"]
    if query:
        needle = query.strip().lower()
        payload = [
            item
            for item in payload
            if needle
            in " ".join(
                [item.caption, item.creator, item.shared_by, *item.topics]
            ).lower()
        ]
    total = len(payload)
    return ReelListResponse(reels=payload[offset : offset + limit], total=total)


@router.get("/reels/{reel_id}", response_model=ReelSchema, summary="Get a Reel")
async def get_reel(
    reel_id: str, ctx: WorkspaceContext = Depends(workspace_context)
) -> ReelSchema:
    return reel_to_schema(await _get_reel(ctx, reel_id))


@router.post(
    "/reels/{reel_id}/analyze",
    response_model=AnalyzeResponse,
    summary="Analyze a Reel only when actual media is available",
    dependencies=[Depends(sensitive_rate_limit)],
)
async def analyze_reel(
    reel_id: str,
    payload: AnalyzeRequest | None = None,
    ctx: WorkspaceContext = Depends(workspace_context),
) -> AnalyzeResponse:
    reel = await _get_reel(ctx, reel_id)
    result = await analyze_now_or_queue(
        ctx.session, reel, force=bool(payload.force if payload else False)
    )
    return AnalyzeResponse(**result)


def _detect_media_kind(content: bytes, content_type: str, suffix: str) -> str:
    mime = (content_type or "").split(";")[0].strip().lower()
    if content.startswith(b"\xff\xd8\xff"):
        return "image"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image"
    if len(content) > 12 and content[4:8] == b"ftyp":
        return "video"
    if content.startswith(b"\x1a\x45\xdf\xa3"):
        return "video"
    if mime.startswith("image/") and suffix in _ALLOWED_IMAGE_EXT:
        return "image"
    if mime.startswith("video/") and suffix in _ALLOWED_VIDEO_EXT:
        return "video"
    raise AppError(
        "unsupported_media",
        "Upload an MP4/MOV/WebM video (or a JPEG/PNG/WebP image).",
        status_code=415,
    )


@router.post(
    "/reels/{reel_id}/upload",
    response_model=ReelSchema,
    summary="Upload the actual Reel video when Instagram media access is unavailable",
    dependencies=[Depends(sensitive_rate_limit)],
)
async def upload_reel_video(
    reel_id: str,
    file: UploadFile = File(...),
    ctx: WorkspaceContext = Depends(workspace_context),
) -> ReelSchema:
    reel = await _get_reel(ctx, reel_id)
    content = await file.read(settings.max_upload_bytes + 1)
    if not content:
        raise AppError("empty_upload", "The uploaded file is empty.", status_code=400)
    if len(content) > settings.max_upload_bytes:
        raise AppError(
            "upload_too_large",
            f"The upload exceeds the {settings.max_upload_bytes // (1024 * 1024)} MB limit.",
            status_code=413,
        )

    suffix = Path(file.filename or "").suffix.lower()
    kind = _detect_media_kind(content, file.content_type or "", suffix)
    if kind == "video" and suffix not in _ALLOWED_VIDEO_EXT:
        suffix = ".mp4"
    elif kind == "image" and suffix not in _ALLOWED_IMAGE_EXT:
        suffix = ".jpg"

    settings.upload_path.mkdir(parents=True, exist_ok=True)
    destination = settings.upload_path / f"{uuid.uuid4().hex}{suffix}"
    destination.write_bytes(content)

    # Remove a previously uploaded file if the user replaces it.
    if reel.uploaded_path:
        previous = Path(reel.uploaded_path)
        try:
            if previous.exists() and previous.resolve().parent == settings.upload_path:
                previous.unlink()
        except OSError:
            pass

    reel.uploaded_path = str(destination)
    reel.accessible = True
    reel.inaccessible_reason = None
    reel.analysis_status = "pending"
    reel.updated_at = utc_now()
    add_activity(
        ctx.session,
        user_id=ctx.user.id,
        kind="reel",
        status="completed",
        title="Reel video uploaded",
        detail=(
            f"Uploaded {file.filename or destination.name} for legitimate analysis. "
            "Run analysis to process the actual media."
        ),
        username=reel.shared_by,
        conversation_id=reel.conversation_id,
        reel_id=reel.id,
        is_demo=reel.is_demo,
    )
    return reel_to_schema(reel)
