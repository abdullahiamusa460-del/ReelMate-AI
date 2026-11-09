# analysis_status: pending | queued | analyzing | analyzed | failed | unavailable
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import TimestampMixin, utcnow


class Reel(TimestampMixin, Base):
    __tablename__ = "reels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id", ondelete="CASCADE"), index=True, nullable=False
    )

    ig_media_id: Mapped[str | None] = mapped_column(String(200), index=True, nullable=True)
    shared_by: Mapped[str] = mapped_column(String(120), nullable=False)
    creator: Mapped[str] = mapped_column(String(160), default="@unknown", nullable=False)
    caption: Mapped[str] = mapped_column(Text, default="", nullable=False)
    permalink: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Signed CDN URL supplied by Meta. Never treated as a summary source by itself.
    media_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    duration_sec: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    views: Mapped[int | None] = mapped_column(Integer, nullable=True)
    likes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio: Mapped[str | None] = mapped_column(String(255), nullable=True)

    accessible: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    inaccessible_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    analysis_status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False)

    hues: Mapped[list[int]] = mapped_column(JSON, default=lambda: [265, 220], nullable=False)
    # Pre-written sample analysis for the demo workspace. It is only turned into
    # a ReelAnalysis when the user runs demo analysis, and is labelled as such.
    demo_analysis: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True, nullable=False
    )

    analyses: Mapped[list["ReelAnalysis"]] = relationship(
        back_populates="reel",
        cascade="all, delete-orphan",
        order_by="ReelAnalysis.created_at",
    )


class ReelAnalysis(TimestampMixin, Base):
    __tablename__ = "reel_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    reel_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("reels.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    source: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str | None] = mapped_column(String(160), nullable=True)
    media_accessed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    frames_analyzed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    summary: Mapped[str] = mapped_column(Text, nullable=False)
    topics: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    sentiment: Mapped[str] = mapped_column(String(80), default="Neutral", nullable=False)
    suggested_replies: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, default=list, nullable=False
    )
    limitations: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    reel: Mapped[Reel] = relationship(back_populates="analyses")
