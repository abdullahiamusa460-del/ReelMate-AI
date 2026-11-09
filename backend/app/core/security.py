"""Cryptography helpers: token encryption, signed OAuth state, webhook HMAC."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

_STATE_MAX_AGE_SEC = 600


def _fernet() -> Fernet:
    raw_key = settings.encryption_key.strip()
    if raw_key:
        try:
            return Fernet(raw_key.encode())
        except (ValueError, TypeError) as exc:
            raise RuntimeError(
                "ENCRYPTION_KEY is invalid. Generate one with: "
                "python -c \"from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())\""
            ) from exc

    # Development fallback: derive a stable Fernet key from SECRET_KEY. Production
    # startup refuses to run without an explicit ENCRYPTION_KEY.
    digest = hashlib.sha256(settings.secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str) -> str:
    if not value:
        return ""
    return _fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise RuntimeError(
            "Stored credential could not be decrypted. ENCRYPTION_KEY may have changed."
        ) from exc


def mask_secret(value: str | None, visible: int = 4) -> str | None:
    if not value:
        return None
    if len(value) <= visible:
        return "*" * len(value)
    return f"{'*' * max(4, len(value) - visible)}{value[-visible:]}"


def _state_signature(payload: str) -> str:
    return hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()


def create_oauth_state(user_id: str) -> str:
    payload = {
        "uid": user_id,
        "nonce": secrets.token_urlsafe(18),
        "iat": int(time.time()),
    }
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return f"{encoded}.{_state_signature(encoded)}"


def verify_oauth_state(state: str, user_id: str) -> bool:
    try:
        encoded, signature = state.split(".", 1)
    except ValueError:
        return False
    if not hmac.compare_digest(signature, _state_signature(encoded)):
        return False
    try:
        payload: dict[str, Any] = json.loads(base64.urlsafe_b64decode(encoded.encode()))
    except Exception:
        return False
    if payload.get("uid") != user_id:
        return False
    issued = int(payload.get("iat", 0))
    return (time.time() - issued) <= _STATE_MAX_AGE_SEC


def verify_meta_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """Validate X-Hub-Signature-256 from Meta's webhook sender."""
    if not settings.ig_app_secret:
        return False
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(
        settings.ig_app_secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    provided = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, provided)


def hash_payload(raw_body: bytes) -> str:
    return hashlib.sha256(raw_body).hexdigest()
