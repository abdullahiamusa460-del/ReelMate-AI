# Conversation reply_status values:
#   auto_replied, needs_review, pending, skipped, replied
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.user import TimestampMixin, utcnow


class Conversation(TimestampMixin, Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    ig_thread_id: Mapped[str | None] = mapped_column(String(160), unique=True, nullable=True)
    ig_user_id: Mapped[str | None] = mapped_column(String(160), index=True, nullable=True)

    username: Mapped[str] = mapped_column(String(120), nullable=False)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    hue: Mapped[int] = mapped_column(Integer, default=265, nullable=False)

    is_message_request: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_group: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    unread_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    reply_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    eligible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    eligibility_note: Mapped[str] = mapped_column(
        Text, default="Awaiting eligibility check.", nullable=False
    )
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True, nullable=False
    )
