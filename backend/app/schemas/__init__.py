"""Pydantic API schemas.

Frontend-facing payloads use camelCase (matching the existing TypeScript types).
Internal request bodies accept both snake_case and camelCase.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

Personality = Literal["friendly", "professional", "witty", "supportive", "curious"]
Tone = Literal["casual", "balanced", "formal", "enthusiastic"]
ResponseLength = Literal["short", "medium", "detailed"]
SendMode = Literal["automatic", "review"]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ── Settings ────────────────────────────────────────────────────────────────
class QuietHours(CamelModel):
    enabled: bool = False
    start: str = "23:00"
    end: str = "07:00"

    @field_validator("start", "end")
    @classmethod
    def _valid_time(cls, value: str) -> str:
        parts = value.split(":")
        if len(parts) != 2 or not all(part.isdigit() for part in parts):
            raise ValueError("Time must use HH:MM format")
        hour, minute = int(parts[0]), int(parts[1])
        if not 0 <= hour <= 23 or not 0 <= minute <= 59:
            raise ValueError("Time must be a valid 24-hour time")
        return f"{hour:02d}:{minute:02d}"


class AutoReplySettings(CamelModel):
    send_mode: SendMode = "automatic"
    only_with_reels: bool = False
    skip_message_requests: bool = True
    skip_group_chats: bool = True
    pause_for_sensitive_topics: bool = True
    reply_delay_sec: int = Field(default=20, ge=5, le=120)
    max_per_hour: int = Field(default=30, ge=5, le=60)
    quiet_hours: QuietHours = Field(default_factory=QuietHours)
    exclude_keywords: str = Field(default="", max_length=1000)


class AssistantSettings(CamelModel):
    personality: Personality = "friendly"
    tone: Tone = "casual"
    language: str = Field(default="Match sender's language", max_length=80)
    length: ResponseLength = "short"
    include_emoji: bool = True
    custom_instructions: str = Field(default="", max_length=400)
    auto_reply: AutoReplySettings = Field(default_factory=AutoReplySettings)


class AssistantSettingsResponse(AssistantSettings):
    updated_at: datetime | None = None
    source: str = "database"


class ActivationRequest(BaseModel):
    enabled: bool


# ── Conversations / messages ────────────────────────────────────────────────
class ChatMessage(CamelModel):
    id: str
    from_: Literal["them", "ai"] = Field(alias="from")
    text: str
    minutes_ago: int
    reel_id: str | None = None


class Conversation(CamelModel):
    id: str
    username: str
    display_name: str
    hue: int
    unread: int
    messages: list[ChatMessage]
    reply_status: Literal["auto_replied", "needs_review", "pending", "skipped"]
    is_message_request: bool
    eligible: bool
    eligibility_note: str
    is_demo: bool = True
    last_message_at: datetime | None = None


class ConversationListResponse(CamelModel):
    conversations: list[Conversation]
    total: int
    unread_total: int


class MessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class DraftRequest(BaseModel):
    instruction: str | None = Field(default=None, max_length=500)


class DraftResponse(CamelModel):
    text: str
    source: Literal["model", "template", "cached"]
    model: str | None = None
    delivered: bool = False
    warning: str | None = None


class SendMessageResponse(CamelModel):
    message: ChatMessage
    delivered: bool
    mode: Literal["demo", "live"]
    external_id: str | None = None
    warning: str | None = None


# ── Reels ───────────────────────────────────────────────────────────────────
class SuggestedReply(CamelModel):
    tone: str
    text: str


class Reel(CamelModel):
    id: str
    conversation_id: str
    shared_by: str
    creator: str
    caption: str
    duration_sec: int
    views: int | None
    likes: int | None
    audio: str | None
    received_minutes_ago: int
    accessible: bool
    inaccessible_reason: str | None = None
    summary: str | None
    topics: list[str]
    sentiment: str | None
    suggested_replies: list[SuggestedReply]
    hues: list[int]
    is_demo: bool = True
    analysis_status: str = "pending"
    analysis_source: str | None = None
    analysis_model: str | None = None
    media_accessed: bool = False
    limitations: list[str] = Field(default_factory=list)
    upload_available: bool = True
    upload_required: bool = False


class ReelListResponse(CamelModel):
    reels: list[Reel]
    total: int


class ReelAnalysisResult(CamelModel):
    summary: str
    topics: list[str]
    sentiment: str
    suggested_replies: list[SuggestedReply]
    source: str
    model: str | None = None
    media_accessed: bool = False
    frames_analyzed: int = 0
    limitations: list[str] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    force: bool = False


class AnalyzeResponse(CamelModel):
    status: Literal["queued", "analyzed", "unavailable", "failed"]
    job_id: str | None = None
    analysis: ReelAnalysisResult | None = None
    message: str
    upload_required: bool = False


class JobResponse(CamelModel):
    id: str
    kind: str
    status: Literal["queued", "running", "succeeded", "failed", "dead"]
    attempts: int
    last_error: str | None = None
    result: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


# ── Activity / dashboard ────────────────────────────────────────────────────
class ActivityItem(CamelModel):
    id: str
    kind: Literal["message", "reel", "reply", "integration", "system"]
    status: Literal["completed", "skipped", "failed"]
    title: str
    detail: str
    username: str
    minutes_ago: int
    conversation_id: str | None = None
    is_demo: bool = True
    created_at: datetime | None = None


class DashboardStats(CamelModel):
    total_messages: int
    reels_processed: int
    auto_replies: int
    avg_response_sec: int
    weekly: list[int]
    deltas: dict[str, float]


class ConnectionState(CamelModel):
    status: Literal["not_connected", "connected", "error", "unsupported_personal_account", "pending"]
    account_handle: str | None
    account_type: str | None = None
    last_checked_label: str
    last_checked_at: datetime | None = None
    messaging_permitted: bool = False
    webhooks_subscribed: bool = False
    unsupported_reason: str | None = None
    error: str | None = None


class AIStatus(CamelModel):
    enabled: bool
    provider: str
    model: str | None
    configured: bool
    multimodal: bool
    video_capable: bool
    template_fallback: bool = True


class AssistantStatus(CamelModel):
    mode: Literal["demo", "live"]
    demo: bool
    ai_enabled: bool
    delivery_enabled: bool
    receive_enabled: bool
    reel_analysis_available: bool
    upload_analysis_available: bool
    personal_account_supported: bool = False
    connection: ConnectionState
    ai: AIStatus
    capabilities: dict[str, bool]
    limitations: list[str]


class DashboardResponse(CamelModel):
    stats: DashboardStats
    recent_activity: list[ActivityItem]
    attention: list[Conversation]
    connection: ConnectionState
    status: AssistantStatus
    generated_at: datetime


# ── Integration ─────────────────────────────────────────────────────────────
class ConnectUrlResponse(CamelModel):
    configured: bool
    url: str | None = None
    message: str
    missing: list[str] = Field(default_factory=list)


class IntegrationActionResponse(CamelModel):
    status: ConnectionState
    message: str
    demo: bool


class IntegrationDetail(ConnectionState):
    provider: str = "instagram"
    scopes: list[str] = Field(default_factory=list)
    token_expires_at: datetime | None = None
    connected_at: datetime | None = None
    demo: bool = True
    configured: bool = False


class IntegrationResponse(CamelModel):
    connection: ConnectionState
    detail: IntegrationDetail
    status: AssistantStatus


class JobListResponse(CamelModel):
    jobs: list[JobResponse]
    total: int


class HealthResponse(CamelModel):
    status: Literal["ok", "degraded"]
    version: str
    database: bool
    mode: Literal["demo", "live"]
    ai_provider: str
    ai_configured: bool
    worker_enabled: bool
    timestamp: datetime


class ActivityListResponse(CamelModel):
    activity: list[ActivityItem]
    total: int
