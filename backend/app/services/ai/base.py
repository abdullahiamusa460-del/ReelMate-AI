"""AI provider contracts and shared data types."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


class AIError(Exception):
    """Base class for AI/provider failures safe to surface to the dashboard."""

    code = "ai_error"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class AINotConfigured(AIError):
    code = "ai_not_configured"


class AIRequestFailed(AIError):
    code = "ai_request_failed"


class AIResponseInvalid(AIError):
    code = "ai_response_invalid"


class MediaUnavailable(AIError):
    code = "media_unavailable"


class MediaProcessingUnavailable(AIError):
    code = "media_processing_unavailable"


@dataclass
class MediaBundle:
    """Actual bytes made available to the model. Never a URL-only placeholder."""

    source: str
    frames: list[bytes] = field(default_factory=list)
    frame_mime: str = "image/jpeg"
    video_bytes: bytes | None = None
    video_mime: str | None = None
    duration_sec: int = 0
    caption: str = ""
    audio_label: str | None = None
    limitations: list[str] = field(default_factory=list)

    @property
    def has_visual_content(self) -> bool:
        return bool(self.frames or self.video_bytes)

    @property
    def media_accessed(self) -> bool:
        return self.has_visual_content


@dataclass
class ReelContext:
    caption: str
    creator: str
    shared_by: str
    duration_sec: int
    audio: str | None
    conversation_preview: str = ""


@dataclass
class ReplyContext:
    conversation_preview: str
    sender_name: str
    reel_summary: str | None
    reel_topics: list[str]
    personality: str
    tone: str
    language: str
    length: str
    include_emoji: bool
    custom_instructions: str
    has_reel: bool


@dataclass
class AnalysisPayload:
    summary: str
    topics: list[str]
    sentiment: str
    suggested_replies: list[dict[str, str]]
    model: str
    frames_analyzed: int
    limitations: list[str] = field(default_factory=list)


class AIProvider(Protocol):
    name: str
    model: str
    supports_direct_video: bool

    async def analyze_reel(self, media: MediaBundle, context: ReelContext) -> AnalysisPayload: ...

    async def generate_reply(self, context: ReplyContext) -> str: ...
