"""Versioned API routers.

`api_router` is protected by the workspace API token and a general rate limit.
`public_router` contains only endpoints that must be reachable by Meta (OAuth
callback and webhook verification) and still validate state/signatures.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import activity, dashboard, demo, inbox, integration, jobs, reels, settings, webhooks

api_router = APIRouter()
api_router.include_router(dashboard.router)
api_router.include_router(activity.router)
api_router.include_router(inbox.router)
api_router.include_router(reels.router)
api_router.include_router(settings.router)
api_router.include_router(integration.router)
api_router.include_router(jobs.router)
api_router.include_router(demo.router)

public_router = APIRouter()
public_router.include_router(webhooks.router)
public_router.include_router(integration.public_router)

__all__ = ["api_router", "public_router"]
