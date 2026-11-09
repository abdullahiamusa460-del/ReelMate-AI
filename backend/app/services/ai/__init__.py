from __future__ import annotations

from app.core.config import settings
from app.services.ai.base import AIProvider
from app.services.ai.gemini import GeminiProvider
from app.services.ai.openai_compatible import OpenAICompatibleProvider


def get_ai_provider() -> AIProvider | None:
    """Return a configured multimodal provider, or None when only templates exist."""
    provider = settings.ai_provider.strip().lower()
    if not settings.ai_configured:
        return None
    if provider == "gemini":
        return GeminiProvider()
    if provider in {"openai", "openai_compatible"}:
        return OpenAICompatibleProvider()
    return None
