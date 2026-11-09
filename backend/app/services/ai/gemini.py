from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.services.ai.base import (
    AIRequestFailed,
    AIResponseInvalid,
    AnalysisPayload,
    MediaBundle,
    ReplyContext,
    ReelContext,
)
from app.services.ai.openai_compatible import clean_reply, normalise_analysis, parse_json_object
from app.services.ai.prompts import ANALYSIS_SYSTEM, REPLY_SYSTEM, analysis_user_prompt, reply_user_prompt

logger = logging.getLogger("reelmate.ai.gemini")

# Inline request bodies are capped by Google; keep a conservative limit.
_MAX_INLINE_VIDEO_BYTES = 18 * 1024 * 1024


class GeminiProvider:
    name = "gemini"
    supports_direct_video = True

    def __init__(self, *, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key or settings.ai_api_key
        self.model = model or settings.ai_model
        self.video_model = settings.ai_video_model or self.model

    async def _generate(self, *, model: str, parts: list[dict[str, Any]], json_mode: bool) -> str:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent"
        )
        payload: dict[str, Any] = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "temperature": 0.5,
                "maxOutputTokens": settings.ai_max_output_tokens,
            },
        }
        if json_mode:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        try:
            async with httpx.AsyncClient(timeout=settings.ai_timeout_sec) as client:
                response = await client.post(
                    url,
                    headers={
                        "x-goog-api-key": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                body = response.json()
        except httpx.HTTPStatusError as exc:
            logger.warning("Gemini HTTP %s", exc.response.status_code)
            raise AIRequestFailed(
                "The Gemini API rejected the request.",
                details={"provider": self.name, "status": exc.response.status_code},
            ) from exc
        except httpx.HTTPError as exc:
            logger.warning("Gemini network error: %s", exc.__class__.__name__)
            raise AIRequestFailed(
                "The Gemini API could not be reached.", details={"provider": self.name}
            ) from exc

        try:
            chunks = body["candidates"][0]["content"]["parts"]
            return "".join(part.get("text", "") for part in chunks)
        except (KeyError, IndexError, TypeError) as exc:
            raise AIResponseInvalid("Gemini returned an unexpected response.") from exc

    async def analyze_reel(self, media: MediaBundle, context: ReelContext) -> AnalysisPayload:
        parts: list[dict[str, Any]] = [
            {
                "text": ANALYSIS_SYSTEM
                + "\n\n"
                + analysis_user_prompt(
                    context, len(media.frames), media.video_bytes is not None
                ),
            }
        ]

        used_video = False
        if (
            media.video_bytes
            and len(media.video_bytes) <= _MAX_INLINE_VIDEO_BYTES
            and media.video_mime
        ):
            parts.append(
                {
                    "inline_data": {
                        "mime_type": media.video_mime,
                        "data": base64.b64encode(media.video_bytes).decode(),
                    }
                }
            )
            used_video = True

        if not used_video:
            for frame in media.frames:
                parts.append(
                    {
                        "inline_data": {
                            "mime_type": media.frame_mime,
                            "data": base64.b64encode(frame).decode(),
                        }
                    }
                )

        if len(parts) == 1:
            raise AIResponseInvalid("No actual media was available to send to Gemini.")

        model = self.video_model if used_video else self.model
        text = await self._generate(model=model, parts=parts, json_mode=True)
        payload = normalise_analysis(
            parse_json_object(text), model, 0 if used_video else len(media.frames)
        )
        if used_video:
            payload.limitations.append(
                "Provider received the original video file; audio was not transcribed."
            )
        return payload

    async def generate_reply(self, context: ReplyContext) -> str:
        text = await self._generate(
            model=self.model,
            parts=[
                {
                    "text": REPLY_SYSTEM
                    + "\n\n"
                    + reply_user_prompt(context)
                }
            ],
            json_mode=False,
        )
        return clean_reply(text)
