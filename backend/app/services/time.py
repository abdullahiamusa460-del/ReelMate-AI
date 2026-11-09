from __future__ import annotations

from datetime import datetime, timezone


def ensure_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def minutes_ago(value: datetime | None, now: datetime | None = None) -> int:
    if value is None:
        return 0
    normalised = ensure_utc(value)
    reference = ensure_utc(now) or utc_now()
    delta = reference - normalised
    return max(0, int(delta.total_seconds() // 60))


def ago_label(value: datetime | None) -> str:
    if value is None:
        return "Never"
    mins = minutes_ago(value)
    if mins < 1:
        return "Just now"
    if mins < 60:
        return f"{mins}m ago"
    hours = mins // 60
    if hours < 24:
        return f"{hours}h ago"
    return f"{hours // 24}d ago"
