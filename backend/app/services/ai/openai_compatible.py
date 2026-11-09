from __future__ import annotations

import base64
import json
import logging
import re
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
from app.services.ai.prompts import ANALYSIS_SYSTEM, REPLY_SYSTEM, analysis_user_prompt, reply_user_prompt

logger = logging.getLogger("reelmate.ai.openai")


def parse_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise AIResponseInvalid("The AI provider did not return a JSON object.")
        try:
            value = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError as exc:
            raise AIResponseInvalid("The AI provider returned malformed JSON.") from exc
    if not isinstance(value, dict):
        raise AIResponseInvalid("The AI provider returned an unexpected JSON shape.")
    return value


def normalise_analysis(data: dict[str, Any], model: str, frames: int) -> AnalysisPayload:
    summary = str(data.get("summary", "")).strip()
    if len(summary) < 10:
        raise AIResponseInvalid("The AI provider returned an empty Reel summary.")

    topics = [
        str(topic).strip()[:60]
        for topic in (data.get("topics") or [])
        if str(topic).strip()
    ][:8]
    sentiment = str(data.get("sentiment") or "Neutral").strip()[:80]

    suggestions: list[dict[str, str]] = []
    for item in (data.get("suggested_replies") or [])[:4]:
        if isinstance(item, dict):
            text = str(item.get("text", "")).strip()
            tone = str(item.get("tone", "Casual")).strip()[:32] or "Casual"
        else:
            text = str(item).strip()
            tone = "Casual"
        if text:
            suggestions.append({"tone": tone, "text": text[:500]})

    limitations = [
        str(item).strip()[:240]
        for item in (data.get("limitations") or [])
        if str(item).strip()
    ][:6]

    return AnalysisPayload(
        summary=summary[:2000],
        topics=topics,
        sentiment=sentiment,
        suggested_replies=suggestions,
        model=model,
        frames_analyzed=frames,
        limitations=limitations,
    )


class OpenAICompatibleProvider:
    """Works with OpenAI and agents/compatible vision chat-completion APIs."""

    name = "openai_compatible"
    supports_direct_video = False

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
    ) -> None:
        self.api_key = api_key or settings.ai_api_key
        self.base_url = (base_url or settings.ai_base_url).rstrip("/")
        self.model = model or settings.ai_model

    async def _chat(self, messages: list[dict[str, Any]], *, json_mode: bool) -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.5,
            "max_tokens": settings.ai_max_output_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        url = f"{self.base_url}/chat/completions"
        try:
            async with httpx.AsyncClient(timeout=settings.ai_timeout_sec) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 400 and json_mode:
                    # Some compatible providers reject response_format.
                    payload.pop("response_format", None)
                    response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                body = response.json()
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            logger.warning("AI provider HTTP %s", status)
            raise AIRequestFailed(
                "The AI provider rejected the request.",
                details={"provider": self.name, "status": status},
            ) from exc
        except httpx.HTTPError as exc:
            logger.warning("AI provider network error: %s", exc.__class__.__name__)
            raise AIRequestFailed(
                "The AI provider could not be reached.",
                details={"provider": self.name},
            ) from exc

        try:
            return body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AIResponseInvalid("The AI provider returned an unexpected response.") from exc

    async def analyze_reel(self, media: MediaBundle, context: ReelContext) -> AnalysisPayload:
        if not media.frames:
            raise AIResponseInvalid(
                "No video frames were available to send to the vision model."
            )
        content: list[dict[str, Any]] = [
            {
                "type": "text",
                "text": analysis_user_prompt(context, len(media.frames), False),
            }
        ]
        for frame in media.frames:
            encoded = base64.b64encode(frame).decode()
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{media.frame_mime};base64,{encoded}"},
                }
            )
        text = await self._chat(
            [
                {"role": "system", "content": ANALYSIS_SYSTEM},
                {"role": "user", "content": content},
            ],
            json_mode=True,
        )
        return normalise_analysis(parse_json_object(text), self.model, len(media.frames))

    async def generate_reply(self, context: ReplyContext) -> str:
        text = await self._chat(
            [
                {"role": "system", "content": REPLY_SYSTEM},
                {"role": "user", "content": reply_user_prompt(context)},
            ],
            json_mode=False,
        )
        return clean_reply(text)


def clean_reply(text: str) -> str:
    cleaned = text.strip().strip('"').strip("'").strip()
    cleaned = re.sub(r"^(reply|message)\s*:\s*", "", cleaned, flags=re.IGNORECASE)
    if not cleaned:
        raise AIResponseInvalid("The AI provider returned an empty reply.")
    return cleaned[:1000]
