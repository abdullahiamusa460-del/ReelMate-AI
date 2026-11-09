from __future__ import annotations

import hashlib
import hmac
import json


async def test_webhook_verification_challenge(client):
    response = await client.get(
        "/api/v1/webhooks/instagram",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "test-webhook-token",
            "hub.challenge": "challenge-123",
        },
    )
    assert response.status_code == 200
    assert response.text == "challenge-123"


async def test_webhook_rejects_bad_verification_token(client):
    response = await client.get(
        "/api/v1/webhooks/instagram",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong",
            "hub.challenge": "nope",
        },
    )
    assert response.status_code == 403


async def test_webhook_requires_valid_signature(client):
    body = json.dumps({"object": "instagram", "entry": []}).encode()
    response = await client.post(
        "/api/v1/webhooks/instagram",
        content=body,
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_signature"


async def test_webhook_accepts_signed_payload_idempotently(client):
    body = json.dumps({"object": "instagram", "entry": []}).encode()
    signature = hmac.new(b"test-app-secret", body, hashlib.sha256).hexdigest()
    headers = {
        "content-type": "application/json",
        "x-hub-signature-256": f"sha256={signature}",
    }
    first = await client.post("/api/v1/webhooks/instagram", content=body, headers=headers)
    assert first.status_code == 200
    assert first.json()["duplicate"] is False

    second = await client.post("/api/v1/webhooks/instagram", content=body, headers=headers)
    assert second.status_code == 200
    assert second.json()["duplicate"] is True
