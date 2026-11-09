"""Legitimate media access, SSRF protection, and video frame extraction.

A Reel is analysed only after actual bytes are available. This module never
turns a URL into a summary.
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import mimetypes
import shutil
import socket
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.models import Reel
from app.services.ai.base import MediaBundle, MediaProcessingUnavailable, MediaUnavailable

logger = logging.getLogger("reelmate.media")

_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}
_VIDEO_MIMES = {"video/mp4", "video/quicktime", "video/webm", "video/x-m4v"}


def _check_host_allowed(host: str) -> bool:
    host = host.lower().strip(".")
    for allowed in settings.allowed_media_hosts:
        if host == allowed or host.endswith(f".{allowed}"):
            return True
    return False


async def validate_public_media_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise MediaUnavailable("The media URL is not a valid HTTP(S) URL.")
    if not _check_host_allowed(parsed.hostname):
        raise MediaUnavailable(
            "The media host is not on the allow-list for legitimate Instagram media.",
            details={"host": parsed.hostname},
        )

    def resolve() -> list[str]:
        return [item[4][0] for item in socket.getaddrinfo(parsed.hostname, None)]

    try:
        addresses = await asyncio.to_thread(resolve)
    except OSError as exc:
        raise MediaUnavailable("The media host could not be resolved.") from exc

    for address in addresses:
        ip = ipaddress.ip_address(address)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise MediaUnavailable("The media URL resolves to a non-public address.")


async def download_media(url: str) -> tuple[bytes, str]:
    """Download with redirect re-validation and a hard byte cap."""
    current = url
    for _ in range(4):
        await validate_public_media_url(current)
        timeout = httpx.Timeout(settings.media_download_timeout_sec)
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
                async with client.stream("GET", current) as response:
                    if response.status_code in {301, 302, 303, 307, 308}:
                        location = response.headers.get("location")
                        if not location:
                            raise MediaUnavailable("The media redirect had no destination.")
                        current = str(response.url.join(location))
                        continue
                    if response.status_code in {401, 403, 404}:
                        raise MediaUnavailable(
                            "The authorized account could not access this media. "
                            "Upload the video to analyse its actual content.",
                            details={"status": response.status_code},
                        )
                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "").split(";")[0].strip()
                    chunks: list[bytes] = []
                    total = 0
                    async for chunk in response.aiter_bytes(64 * 1024):
                        total += len(chunk)
                        if total > settings.max_media_download_bytes:
                            raise MediaUnavailable("The media file exceeds the configured size limit.")
                        chunks.append(chunk)
                    return b"".join(chunks), content_type
        except httpx.HTTPStatusError as exc:
            raise MediaUnavailable(
                "The media could not be downloaded from Instagram.",
                details={"status": exc.response.status_code},
            ) from exc
        except httpx.HTTPError as exc:
            raise MediaUnavailable("The media download failed.") from exc
    raise MediaUnavailable("Too many redirects while downloading the media.")


def _binary_available(name: str) -> bool:
    return shutil.which(name) is not None


async def _run(*args: str, timeout: int = 60) -> tuple[int, bytes, bytes]:
    process = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except TimeoutError as exc:
        process.kill()
        await process.wait()
        raise MediaProcessingUnavailable("Video processing timed out.") from exc
    return process.returncode or 0, stdout, stderr


async def probe_duration(path: Path) -> int:
    if not _binary_available("ffprobe"):
        return 0
    code, stdout, _ = await _run(
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
        timeout=30,
    )
    if code != 0:
        return 0
    try:
        return int(float(stdout.decode().strip()))
    except (ValueError, TypeError):
        return 0


async def extract_video_frames(video_path: Path, max_frames: int | None = None) -> list[bytes]:
    if not _binary_available("ffmpeg"):
        raise MediaProcessingUnavailable(
            "Video analysis requires ffmpeg on the server. Install ffmpeg and retry, "
            "or configure a provider that accepts direct video (Gemini)."
        )
    limit = max(1, min(max_frames or settings.ai_max_frames, 12))
    duration = await probe_duration(video_path)
    temp_dir = Path(tempfile.mkdtemp(prefix="frames-", dir=str(settings.upload_path)))
    try:
        output = temp_dir / "frame-%02d.jpg"
        # Roughly one frame every 4 seconds, capped. Scale down to keep requests
        # small while retaining enough detail for a visual summary.
        fps = "1/4" if duration >= 8 else "1/2"
        code, _, stderr = await _run(
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(video_path),
            "-vf",
            f"fps={fps},scale='min(720,iw)':-2",
            "-frames:v",
            str(limit),
            "-q:v",
            "3",
            str(output),
            timeout=120,
        )
        frames = sorted(temp_dir.glob("frame-*.jpg"))
        if code != 0 or not frames:
            logger.warning("ffmpeg produced no frames: %s", stderr.decode()[:300])
            raise MediaProcessingUnavailable(
                "The video could not be decoded into analysable frames."
            )
        return [frame.read_bytes() for frame in frames[:limit]]
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def _guess_mime(path: Path, provided: str | None = None) -> str:
    if provided and provided in (_IMAGE_MIMES | _VIDEO_MIMES):
        return provided
    guessed, _ = mimetypes.guess_type(path.name)
    if guessed:
        return guessed
    return "application/octet-stream"


def _safe_upload_path(value: str) -> Path:
    path = Path(value).resolve()
    upload_root = settings.upload_path
    try:
        path.relative_to(upload_root)
    except ValueError as exc:
        raise MediaUnavailable("The uploaded media path is outside the upload directory.") from exc
    if not path.exists():
        raise MediaUnavailable("The uploaded video file no longer exists. Upload it again.")
    return path


async def prepare_reel_media(reel: Reel, *, direct_video: bool = False) -> MediaBundle:
    """Load actual media bytes for a Reel, or explain why they are unavailable."""
    content: bytes
    mime: str
    source: str

    if reel.uploaded_path:
        path = _safe_upload_path(reel.uploaded_path)
        content = path.read_bytes()
        mime = _guess_mime(path)
        source = "upload"
    elif reel.media_url:
        content, mime = await download_media(reel.media_url)
        source = "instagram_media_url"
    else:
        raise MediaUnavailable(
            "No actual Reel media is available to the backend. A caption or URL alone "
            "is not enough to summarise a video. Upload the video to analyse it.",
            details={"upload_required": True},
        )

    if mime not in (_IMAGE_MIMES | _VIDEO_MIMES):
        # Some CDNs return application/octet-stream; detect by magic bytes.
        if content.startswith(b"\xff\xd8\xff"):
            mime = "image/jpeg"
        elif content[4:12] in {b"ftypmp42", b"ftypisom", b"ftypM4V "}:
            mime = "video/mp4"

    limitations: list[str] = []
    if mime in _IMAGE_MIMES:
        bundle = MediaBundle(
            source=source,
            frames=[content],
            frame_mime=mime,
            caption=reel.caption,
            audio_label=reel.audio,
        )
        limitations.append("Only a still image was available, not the full video.")
    elif mime in _VIDEO_MIMES:
        temp_dir = Path(tempfile.mkdtemp(prefix="reel-", dir=str(settings.upload_path)))
        suffix = ".mp4" if mime == "video/mp4" else ".mov"
        video_path = temp_dir / f"source{suffix}"
        try:
            video_path.write_bytes(content)
            duration = await probe_duration(video_path)
            frames = await extract_video_frames(video_path)
            bundle = MediaBundle(
                source=source,
                frames=frames,
                video_bytes=content if direct_video else None,
                video_mime=mime if direct_video else None,
                duration_sec=duration,
                caption=reel.caption,
                audio_label=reel.audio,
            )
            limitations.append(
                f"Analysed {len(frames)} sampled frame(s) from the actual video. "
                "Audio was not transcribed."
            )
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    else:
        raise MediaUnavailable(
            "The media format is not a supported image or video."
        )

    bundle.limitations = limitations
    return bundle
