"""Idempotent demo workspace seed.

The same fictional conversations, Reels and events the frontend previously held
in `src/data` are inserted here. Every row is marked `is_demo=True`, analyses are
marked `demo_seed`, and no delivery is recorded as real.
"""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import session_scope
from app.models import (
    ActivityLog,
    Conversation,
    Integration,
    Message,
    Reel,
    ReelAnalysis,
)
from app.services.time import utc_now
from app.services.workspace import get_workspace

logger = logging.getLogger("reelmate.seed")

DEMO_ANALYSES_READY = {
    "r1": {
        "summary": "A designer walks through three upcoming interface trends: layered glassmorphism cards, soft gradient meshes used as backgrounds, and motion-led micro-interactions. Each trend is shown with a quick before/after example.",
        "topics": ["Web design", "UI trends", "Glassmorphism", "Micro-interactions"],
        "sentiment": "Inspirational",
        "suggestedReplies": [
            {"tone": "Casual", "text": "Ooh the gradient mesh bit is so good. Are you going to use it on the portfolio?"},
            {"tone": "Enthusiastic", "text": "Yes!! This would look amazing on your site ✨ Show me when it's live!"},
            {"tone": "Balanced", "text": "Nice find. The glassmorphism cards seem like the best fit for a portfolio."},
        ],
    },
    "r2": {
        "summary": "A quick recipe for lemon garlic shrimp linguine. Steps: sear shrimp, build a sauce with butter, garlic and lemon, toss with pasta water. Total cook time is about 15 minutes.",
        "topics": ["Cooking", "Pasta", "Quick recipes", "Dinner ideas"],
        "sentiment": "Playful",
        "suggestedReplies": [
            {"tone": "Casual", "text": "Okay yes, that's dinner. 15 minutes is totally doable. Your place or mine?"},
            {"tone": "Enthusiastic", "text": "That looks SO good 🤤 I'm in for Saturday!"},
            {"tone": "Balanced", "text": "Sounds good. It's quick enough that we could cook it together."},
        ],
    },
    "r3": {
        "summary": "A traveler breaks down a five-day Lisbon trip. Mentions that shoulder season has lower prices, tram 28 is crowded so walking is better, and local tascas offer cheap set lunches.",
        "topics": ["Travel", "Lisbon", "Budget travel", "Food"],
        "sentiment": "Informative",
        "suggestedReplies": [
            {"tone": "Casual", "text": "The set lunch tip alone sells me. Let's go!"},
            {"tone": "Balanced", "text": "Good tips here. Shoulder season looks like the best value."},
        ],
    },
}

DEMO_ANALYSES_PENDING = {
    "r4": {
        "summary": "A short build-in-public update at week 12: the creator shows a landing page redesign, shares signup numbers, and explains one pricing experiment that did not work. The tone is candid and lesson-focused.",
        "topics": ["Building in public", "Indie hacking", "SaaS", "Pricing"],
        "sentiment": "Reflective",
        "suggestedReplies": [
            {"tone": "Casual", "text": "The failed pricing test is the most useful part honestly. Thanks for sharing the numbers!"},
            {"tone": "Curious", "text": "Interesting update — what made you change the pricing back?"},
        ],
    },
    "r5": {
        "summary": "A ten-minute, no-equipment full-body circuit. Three rounds of squats, push-ups, reverse lunges and a plank hold, with 20 seconds rest between exercises. The creator suggests doing it before breakfast.",
        "topics": ["Fitness", "Home workouts", "Morning routine", "No equipment"],
        "sentiment": "Energetic",
        "suggestedReplies": [
            {"tone": "Enthusiastic", "text": "I'm in! Ten minutes before breakfast is actually doable 💪"},
            {"tone": "Casual", "text": "Tomorrow morning works. If I'm late, start without me 😅"},
            {"tone": "Balanced", "text": "That circuit looks doable. Let's try it tomorrow morning and see how it feels."},
        ],
    },
}

CONVERSATIONS = [
    {
        "id": "c1", "username": "maya.codes", "display_name": "Maya Chen", "hue": 275,
        "unread": 2, "reply_status": "auto_replied", "is_message_request": False,
        "eligible": True, "note": "Mutual follower, 1:1 chat, Reel accessible.",
        "messages": [
            ("m1", "them", "ok you NEED to see this", 14, None),
            ("m2", "them", "", 14, "r1"),
            ("m3", "them", "thinking of trying this for the portfolio site", 13, None),
            ("m4", "ai", "Love this one! The glassmorphism cards with soft gradients would look great on a portfolio. Want me to sketch a layout idea? ✨", 12, None),
        ],
    },
    {
        "id": "c2", "username": "leo.eats", "display_name": "Leo Martins", "hue": 25,
        "unread": 1, "reply_status": "needs_review", "is_message_request": False,
        "eligible": True, "note": "Reply drafted. Your settings require review before sending.",
        "messages": [
            ("m1", "them", "saturday dinner idea??", 47, None),
            ("m2", "them", "", 47, "r2"),
        ],
    },
    {
        "id": "c3", "username": "sofia.travels", "display_name": "Sofía Alvarez", "hue": 190,
        "unread": 0, "reply_status": "auto_replied", "is_message_request": False,
        "eligible": True, "note": "Mutual follower, 1:1 chat, Reel accessible.",
        "messages": [
            ("m1", "them", "Lisbon in October?? look at the prices", 190, None),
            ("m2", "them", "", 190, "r3"),
            ("m3", "ai", "That's a great shout — the Reel says shoulder season keeps flights and stays cheaper and the weather is still mild. Want to compare dates?", 188, None),
            ("m4", "them", "yes!! the 12th to 19th?", 170, None),
            ("m5", "ai", "Works on my end. I'd check flight prices for those dates first, since they tend to move quickly.", 169, None),
        ],
    },
    {
        "id": "c4", "username": "dev.arjun", "display_name": "Arjun Patel", "hue": 220,
        "unread": 0, "reply_status": "skipped", "is_message_request": True,
        "eligible": False, "note": "Skipped: message request from an account you don't follow.",
        "messages": [
            ("m1", "them", "Hey! Loved your last post. Quick collab idea — check this out", 380, None),
            ("m2", "them", "", 380, "r4"),
        ],
    },
    {
        "id": "c5", "username": "nina.fit", "display_name": "Nina Okafor", "hue": 330,
        "unread": 3, "reply_status": "pending", "is_message_request": False,
        "eligible": True, "note": "Queued: the Reel is still being analyzed.",
        "messages": [
            ("m1", "them", "this 10 min routine is actually doable", 6, None),
            ("m2", "them", "", 6, "r5"),
            ("m3", "them", "wanna do it together tomorrow morning?", 5, None),
        ],
    },
    {
        "id": "c6", "username": "theo.beats", "display_name": "Theo Brandt", "hue": 150,
        "unread": 0, "reply_status": "skipped", "is_message_request": False,
        "eligible": False, "note": "Skipped: Reel is from a private account and not accessible.",
        "messages": [
            ("m1", "them", "this beat flip is insane", 1560, None),
            ("m2", "them", "", 1560, "r6"),
        ],
    },
    {
        "id": "c7", "username": "priya.reads", "display_name": "Priya Nair", "hue": 45,
        "unread": 0, "reply_status": "auto_replied", "is_message_request": False,
        "eligible": True, "note": "Mutual follower, 1:1 chat. No Reel in this conversation.",
        "messages": [
            ("m1", "them", "did you finish the book yet?", 2890, None),
            ("m2", "ai", "Almost! The last three chapters are next. No spoilers please 😄", 2888, None),
        ],
    },
]

REELS = [
    ("r1", "c1", "maya.codes", "@pixel.studio", "3 UI trends that will define 2026 🎨 #webdesign #uiux", 42, 184000, 21400, "Original audio — pixel.studio", 14, True, None, [275, 235]),
    ("r2", "c2", "leo.eats", "@fireandfork", "15-minute lemon garlic shrimp pasta 🍝🍋", 58, 920000, 88100, "Trending audio — Kitchen Groove", 47, True, None, [28, 345]),
    ("r3", "c3", "sofia.travels", "@wanderwithjo", "Lisbon on a budget: what I spent in 5 days 🇵🇹", 67, 412000, 45200, "Original audio — wanderwithjo", 190, True, None, [190, 160]),
    ("r4", "c4", "dev.arjun", "@dev.arjun", "Building in public: week 12 update 🚀", 31, 5200, 640, "Original audio — dev.arjun", 380, True, None, [220, 250]),
    ("r5", "c5", "nina.fit", "@move.daily", "10-minute full body routine, no equipment 💪", 49, 1300000, 142000, "Trending audio — Run It Up", 6, True, None, [330, 290]),
    ("r6", "c6", "theo.beats", "@private.account", "Unavailable", 0, None, None, None, 1560, False, "The Reel belongs to a private account, so its content can't be analyzed.", [150, 180]),
]

ACTIVITY = [
    ("a1", "reply", "completed", "Demo reply displayed — not sent", "“Love this one! The glassmorphism cards with soft gradients would look great…”", "maya.codes", 12, "c1", "r1"),
    ("a2", "reel", "completed", "Reel analyzed (demo sample)", "3 UI trends that will define 2026 — topics: Web design, UI trends", "maya.codes", 13, "c1", "r1"),
    ("a3", "message", "completed", "Message received (sample)", "“ok you NEED to see this” + shared Reel", "maya.codes", 14, "c1", "r1"),
    ("a4", "reel", "completed", "Reel analyzed (demo sample)", "15-minute lemon garlic shrimp pasta — draft held for review", "leo.eats", 46, "c2", "r2"),
    ("a5", "reply", "completed", "Demo reply displayed — not sent", "“Works on my end. I'd check flight prices for those dates first…”", "sofia.travels", 169, "c3", "r3"),
    ("a6", "message", "completed", "Message received (sample)", "“yes!! the 12th to 19th?”", "sofia.travels", 170, "c3", "r3"),
    ("a7", "reel", "completed", "Reel analyzed (demo sample)", "Lisbon on a budget — topics: Travel, Budget travel", "sofia.travels", 189, "c3", "r3"),
    ("a8", "message", "skipped", "Message skipped", "Message request from an account you don't follow", "dev.arjun", 380, "c4", "r4"),
    ("a9", "reel", "failed", "Reel could not be analyzed", "Reel belongs to a private account — upload is required", "theo.beats", 1558, "c6", "r6"),
    ("a10", "reply", "completed", "Demo reply displayed — not sent", "“Almost! The last three chapters are next. No spoilers please 😄”", "priya.reads", 2888, "c7", None),
    ("a11", "message", "completed", "Message received (sample)", "“did you finish the book yet?”", "priya.reads", 2890, "c7", None),
]


async def seed_demo_workspace() -> bool:
    async with session_scope() as session:
        user, _ai_settings, integration = await get_workspace(session)
        existing = (
            await session.execute(
                select(func.count(Conversation.id)).where(Conversation.user_id == user.id)
            )
        ).scalar_one()
        if existing:
            return False
        await _seed(session, user.id, integration)
        logger.info("demo workspace seeded")
        return True


async def _seed(session: AsyncSession, user_id: str, integration: Integration) -> None:
    now = utc_now()

    for item in CONVERSATIONS:
        conversation = Conversation(
            id=item["id"],
            user_id=user_id,
            ig_thread_id=None,
            ig_user_id=None,
            username=item["username"],
            display_name=item["display_name"],
            hue=item["hue"],
            is_message_request=item["is_message_request"],
            is_group=False,
            unread_count=item["unread"],
            reply_status=item["reply_status"],
            eligible=item["eligible"],
            eligibility_note=item["note"],
            is_demo=True,
            last_message_at=now - timedelta(minutes=item["messages"][-1][3]),
            created_at=now - timedelta(minutes=item["messages"][0][3]),
            updated_at=now,
        )
        session.add(conversation)
        await session.flush()

        for msg_id, author, text, minutes, reel_id in item["messages"]:
            session.add(
                Message(
                    id=f"{item['id']}-{msg_id}",
                    user_id=user_id,
                    conversation_id=item["id"],
                    ig_message_id=None,
                    direction="inbound" if author == "them" else "outbound",
                    author=author,
                    text=text,
                    reel_id=reel_id,
                    delivery_status="received" if author == "them" else "simulated",
                    delivered=False,
                    is_demo=True,
                    created_at=now - timedelta(minutes=minutes),
                    updated_at=now,
                )
            )

    for (
        reel_id, conversation_id, shared_by, creator, caption, duration, views, likes,
        audio, minutes, accessible, reason, hues,
    ) in REELS:
        analysis = DEMO_ANALYSES_READY.get(reel_id)
        pending = DEMO_ANALYSES_PENDING.get(reel_id)
        reel = Reel(
            id=reel_id,
            user_id=user_id,
            conversation_id=conversation_id,
            ig_media_id=None,
            shared_by=shared_by,
            creator=creator,
            caption=caption,
            permalink=None,
            media_url=None,
            thumbnail_url=None,
            uploaded_path=None,
            duration_sec=duration,
            views=views,
            likes=likes,
            audio=audio,
            accessible=accessible,
            inaccessible_reason=reason,
            analysis_status="analyzed" if analysis else "pending",
            hues=hues,
            demo_analysis=pending,
            is_demo=True,
            received_at=now - timedelta(minutes=minutes),
            created_at=now - timedelta(minutes=minutes),
            updated_at=now,
        )
        session.add(reel)
        await session.flush()
        if analysis:
            session.add(
                ReelAnalysis(
                    id=str(uuid.uuid4()),
                    reel_id=reel_id,
                    user_id=user_id,
                    source="demo_seed",
                    model=None,
                    media_accessed=False,
                    frames_analyzed=0,
                    summary=analysis["summary"],
                    topics=analysis["topics"],
                    sentiment=analysis["sentiment"],
                    suggested_replies=analysis["suggestedReplies"],
                    limitations=[
                        "Pre-written sample analysis for the demo workspace. No video was "
                        "downloaded, watched, or sent to an AI model."
                    ],
                    created_at=now - timedelta(minutes=max(0, minutes - 1)),
                    updated_at=now,
                )
            )

    for (
        activity_id, kind, status, title, detail, username, minutes, conversation_id, reel_id,
    ) in ACTIVITY:
        session.add(
            ActivityLog(
                id=f"sample-{activity_id}",
                user_id=user_id,
                kind=kind,
                status=status,
                title=title,
                detail=detail,
                username=username,
                conversation_id=conversation_id,
                reel_id=reel_id,
                is_demo=True,
                meta={"delivered": False},
                created_at=now - timedelta(minutes=minutes),
                updated_at=now,
            )
        )

    integration.status = "not_connected"
    integration.messaging_permitted = False
    integration.webhooks_subscribed = False
    integration.unsupported_reason = (
        "Demo mode uses sample conversations. A personal Instagram account cannot be "
        "connected through the official messaging API; a verified Business or Creator "
        "account is required for live mode."
    )
    await session.flush()
