"""Official Meta Instagram API client.

Only documented endpoints from Instagram Platform are used. No password,
session cookie, scraping, or browser automation is involved.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.core.security import decrypt_secret

logger = logging.getLogger("reelmate.instagram")

PROFESSIONAL_TYPES = {"BUSINESS", "CREATOR", "MEDIA_CREATOR", "PROFESSIONAL"}


class InstagramAPIError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        code: str = "instagram_api_error",
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


@dataclass
class TokenResult:
    access_token: str
    user_id: str
    expires_in: int | None = None
    permissions: list[str] | None = None


@dataclass
class AccountProfile:
    user_id: str
    username: str | None
    account_type: str | None
    profile_picture_url: str | None

    @property
    def is_professional(self) -> bool:
        return bool(self.account_type and self.account_type.upper() in PROFESSIONAL_TYPES)


class InstagramClient:
    def __init__(
        self, access_token: str | None = None, account_id: str | None = None
    ) -> None:
        self.base_url = f"{settings.ig_graph_base_url.rstrip('/')}/{settings.ig_graph_version}"
        self.access_token = access_token
        self.account_id = account_id or settings.ig_account_id

    def authorization_url(self, state: str) -> str:
        params = {
            "client_id": settings.ig_app_id,
            "redirect_uri": settings.ig_redirect_uri,
            "response_type": "code",
            "scope": ",".join(settings.oauth_scopes),
            "state": state,
        }
        return f"https://www.instagram.com/oauth/authorize?{urlencode(params)}"

    async def exchange_code(self, code: str) -> TokenResult:
        if not settings.instagram_configured:
            raise InstagramAPIError(
                "Instagram OAuth is not configured on this server.",
                code="instagram_not_configured",
            )
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.instagram.com/oauth/access_token",
                data={
                    "client_id": settings.ig_app_id,
                    "client_secret": settings.ig_app_secret,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.ig_redirect_uri,
                    "code": code,
                },
            )
            if response.status_code >= 400:
                logger.warning("Instagram code exchange failed with HTTP %s", response.status_code)
                raise InstagramAPIError(
                    "Instagram rejected the authorization code.",
                    status_code=response.status_code,
                )
            body = response.json()

        short_token = body.get("access_token")
        user_id = str(body.get("user_id") or "")
        if not short_token or not user_id:
            raise InstagramAPIError("Instagram returned an incomplete token response.")

        # Long-lived token exchange (official Instagram Platform flow).
        async with httpx.AsyncClient(timeout=30) as client:
            long_response = await client.get(
                f"{self.base_url}/access_token",
                params={
                    "grant_type": "ig_exchange_token",
                    "client_secret": settings.ig_app_secret,
                    "access_token": short_token,
                },
            )
        if long_response.status_code < 400:
            long_body = long_response.json()
            return TokenResult(
                access_token=long_body.get("access_token", short_token),
                user_id=user_id,
                expires_in=long_body.get("expires_in"),
                permissions=body.get("permissions"),
            )

        # The short-lived token remains valid and usable; report that instead of
        # pretending the exchange succeeded.
        return TokenResult(
            access_token=short_token,
            user_id=user_id,
            permissions=body.get("permissions"),
        )

    async def get_profile(self, token: str | None = None) -> AccountProfile:
        token = token or self.access_token
        if not token:
            raise InstagramAPIError("No Instagram access token is available.")
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{self.base_url}/me",
                params={"fields": "user_id,username,account_type,profile_picture_url"},
                headers={"Authorization": f"Bearer {token}"},
            )
        if response.status_code >= 400:
            logger.warning("Instagram profile request failed with HTTP %s", response.status_code)
            raise InstagramAPIError(
                "Instagram rejected the access token or the profile request.",
                status_code=response.status_code,
            )
        body = response.json()
        return AccountProfile(
            user_id=str(body.get("user_id") or body.get("id") or ""),
            username=body.get("username"),
            account_type=body.get("account_type"),
            profile_picture_url=body.get("profile_picture_url"),
        )

    async def send_message(self, ig_user_id: str, text: str) -> dict[str, Any]:
        if not self.access_token or not self.account_id:
            raise InstagramAPIError("The Instagram account is not fully configured.")
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.base_url}/{self.account_id}/messages",
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json",
                },
                json={"recipient": {"id": ig_user_id}, "message": {"text": text}},
            )
        if response.status_code >= 400:
            logger.warning("Instagram send failed with HTTP %s", response.status_code)
            try:
                error_body = response.json().get("error", {})
            except Exception:
                error_body = {}
            raise InstagramAPIError(
                error_body.get("message")
                or "Instagram refused to send the message. It was not delivered.",
                status_code=response.status_code,
                code=f"instagram_send_{response.status_code}",
            )
        return response.json()

    async def subscribe_messaging_webhooks(self) -> dict[str, Any]:
        if not self.access_token or not self.account_id:
            raise InstagramAPIError("The Instagram account is not fully configured.")
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.base_url}/{self.account_id}/subscribed_apps",
                headers={"Authorization": f"Bearer {self.access_token}"},
                data={"subscribed_fields": "messages"},
            )
        if response.status_code >= 400:
            raise InstagramAPIError(
                "Instagram did not accept the messaging webhook subscription.",
                status_code=response.status_code,
            )
        return response.json()


def client_for_integration(integration: Any) -> InstagramClient:
    token = None
    if integration.access_token_encrypted:
        token = decrypt_secret(integration.access_token_encrypted)
    return InstagramClient(access_token=token, account_id=integration.account_id)
