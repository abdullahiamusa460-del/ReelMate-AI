from __future__ import annotations

from typing import Any

from sqlalchemy import Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.user import TimestampMixin


DEFAULT_AUTO_REPLY: dict[str, Any] = {
    "sendMode": "automatic",
    "onlyWithReels": False,
    "skipMessageRequests": True,
    "skipGroupChats": True,
    "pauseForSensitiveTopics": True,
    "replyDelaySec": 20,
    "maxPerHour": 30,
    "quietHours": {"enabled": False, "start": "23:00", "end": "07:00"},
    "excludeKeywords": "",
}


class AISettings(TimestampMixin, Base):
    __tablename__ = "ai_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    ai_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    personality: Mapped[str] = mapped_column(String(32), default="friendly", nullable=False)
    tone: Mapped[str] = mapped_column(String(32), default="casual", nullable=False)
    language: Mapped[str] = mapped_column(
        String(80), default="Match sender's language", nullable=False
    )
    length: Mapped[str] = mapped_column(String(24), default="short", nullable=False)
    include_emoji: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    custom_instructions: Mapped[str] = mapped_column(Text, default="", nullable=False)
    auto_reply: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=lambda: dict(DEFAULT_AUTO_REPLY), nullable=False
    )
