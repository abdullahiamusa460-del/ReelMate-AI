from __future__ import annotations

import hashlib
import hmac

from app.core.security import (
    create_oauth_state,
    decrypt_secret,
    encrypt_secret,
    hash_payload,
    verify_meta_signature,
    verify_oauth_state,
)


def test_token_encryption_round_trip():
    encrypted = encrypt_secret("ig-secret-token")
    assert encrypted != "ig-secret-token"
    assert decrypt_secret(encrypted) == "ig-secret-token"


def test_oauth_state_is_bound_to_user_and_expires():
    state = create_oauth_state("user-1")
    assert verify_oauth_state(state, "user-1") is True
    assert verify_oauth_state(state, "user-2") is False

    tampered = state[:-1] + ("0" if state[-1] != "0" else "1")
    assert verify_oauth_state(tampered, "user-1") is False


def test_meta_signature_validation():
    payload = b'{"object":"instagram"}'
    signature = hmac.new(b"test-app-secret", payload, hashlib.sha256).hexdigest()
    assert verify_meta_signature(payload, f"sha256={signature}") is True
    assert verify_meta_signature(payload, "sha256=deadbeef") is False
    assert verify_meta_signature(payload, None) is False


def test_hash_payload_is_stable():
    assert hash_payload(b"abcdef") == hashlib.sha256(b"abcdef").hexdigest()
