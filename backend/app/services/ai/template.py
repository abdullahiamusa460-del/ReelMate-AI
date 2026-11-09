"""Deterministic template fallback used when no AI provider is configured.

This is deliberately not called an AI model. Responses are generated from the
owner's settings and the verified context only. Every caller records
source="template" and delivered=false until a real send succeeds.
"""

from __future__ import annotations

from app.services.ai.base import ReplyContext


def template_reply(context: ReplyContext) -> str:
    if context.reel_summary:
        opening = {
            "friendly": "Love this one",
            "professional": "Thanks for sharing this",
            "witty": "Okay, this is genuinely good",
            "supportive": "This is such a great find",
            "curious": "This is really interesting",
        }.get(context.personality, "Thanks for sharing this")
        topic = context.reel_topics[0].lower() if context.reel_topics else "this"
        body = f"{opening} — the {topic} angle is great."
    else:
        body = {
            "friendly": "Hey! Good to hear from you.",
            "professional": "Thanks for the message.",
            "witty": "Well, hello there.",
            "supportive": "Thanks for reaching out — happy to chat.",
            "curious": "Interesting — tell me a bit more?",
        }.get(context.personality, "Thanks for the message.")

    if context.length == "medium":
        body += " Want to compare notes?"
    elif context.length == "detailed":
        body += (
            " I'd be up for digging into it together — want to pick a time and go from there?"
        )

    if context.include_emoji and not body.endswith("?"):
        body += " ✨"

    # Keep the tone instruction meaningful even without a model, without pretending
    # to be one.
    if context.tone == "formal":
        body = body.replace("Hey!", "Hello.").replace("✨", "")
    elif context.tone == "enthusiastic":
        body = body.rstrip(".") + "!"
    return body[:1000]
