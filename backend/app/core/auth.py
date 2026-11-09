"""API authentication and rate limiting.

The dashboard is single-workspace by design. If API_ACCESS_TOKEN is configured,
every non-public endpoint requires it. The Next.js proxy injects the token
server-side so it is never exposed in the browser bundle.
"""

from __future__ import annotations

import hmac
import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import settings
from app.core.logging import AppError


def require_api_token(request: Request) -> None:
    expected = settings.api_access_token.strip()
    if not expected:
        # Local development only. Production startup rejects an empty token.
        return

    provided = ""
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        provided = authorization[7:].strip()
    if not provided:
        provided = request.headers.get("x-api-key", "").strip()

    if not provided or not hmac.compare_digest(provided, expected):
        raise AppError(
            "unauthorized",
            "A valid API access token is required.",
            status_code=401,
            headers={"WWW-Authenticate": "Bearer"},
        )


class SlidingWindowRateLimiter:
    """Small in-process limiter.

    This protects a single API process. Production deployments with multiple
    workers should move this to Redis; the call sites stay the same.
    """

    def __init__(self, window_seconds: int = 60) -> None:
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int) -> None:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        bucket = self._hits[key]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            retry_after = max(1, int(self.window_seconds - (now - bucket[0])))
            raise AppError(
                "rate_limited",
                "Too many requests. Please slow down and try again shortly.",
                status_code=429,
                details={"retry_after_seconds": retry_after},
                headers={"Retry-After": str(retry_after)},
            )
        bucket.append(now)


general_limiter = SlidingWindowRateLimiter()
sensitive_limiter = SlidingWindowRateLimiter()


def client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def general_rate_limit(request: Request) -> None:
    general_limiter.check(f"{client_key(request)}:{request.url.path}", settings.api_rate_limit_per_minute)


def sensitive_rate_limit(request: Request) -> None:
    sensitive_limiter.check(
        f"{client_key(request)}:{request.url.path}",
        settings.sensitive_rate_limit_per_minute,
    )
