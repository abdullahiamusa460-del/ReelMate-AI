from __future__ import annotations


async def test_health_is_public(client):
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] is True
    assert body["mode"] == "demo"


async def test_dashboard_requires_api_token(client, auth_headers):
    unauthorized = await client.get("/api/v1/dashboard")
    assert unauthorized.status_code == 401
    assert unauthorized.json()["error"]["code"] == "unauthorized"

    authorized = await client.get("/api/v1/dashboard", headers=auth_headers)
    assert authorized.status_code == 200
    body = authorized.json()
    assert body["status"]["mode"] == "demo"
    assert body["connection"]["status"] == "not_connected"
    assert body["stats"]["totalMessages"] >= 1
    assert body["recentActivity"]
    assert all(item["isDemo"] for item in body["recentActivity"])


async def test_inbox_and_conversation_detail(client, auth_headers):
    response = await client.get("/api/v1/inbox", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 7
    assert any(item["id"] == "c1" for item in body["conversations"])

    conversation = await client.get(
        "/api/v1/conversations/c1", headers=auth_headers
    )
    assert conversation.status_code == 200
    payload = conversation.json()
    assert payload["displayName"] == "Maya Chen"
    assert payload["messages"][0]["from"] == "them"


async def test_settings_round_trip(client, auth_headers):
    response = await client.put(
        "/api/v1/settings",
        headers=auth_headers,
        json={
            "personality": "witty",
            "tone": "balanced",
            "language": "English",
            "length": "medium",
            "includeEmoji": False,
            "customInstructions": "Be concise.",
            "autoReply": {
                "sendMode": "review",
                "onlyWithReels": True,
                "skipMessageRequests": True,
                "skipGroupChats": True,
                "pauseForSensitiveTopics": True,
                "replyDelaySec": 15,
                "maxPerHour": 20,
                "quietHours": {"enabled": True, "start": "22:00", "end": "06:00"},
                "excludeKeywords": "refund",
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["personality"] == "witty"
    assert body["autoReply"]["quietHours"]["start"] == "22:00"

    fetched = await client.get("/api/v1/settings", headers=auth_headers)
    assert fetched.json()["tone"] == "balanced"


async def test_draft_is_template_and_not_delivered(client, auth_headers):
    response = await client.post(
        "/api/v1/conversations/c2/draft",
        headers=auth_headers,
        json={"instruction": "Keep it casual"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["delivered"] is False
    assert body["source"] == "template"
    assert "not a model reply" in body["warning"].lower()


async def test_demo_send_is_simulated_not_delivered(client, auth_headers):
    response = await client.post(
        "/api/v1/conversations/c1/messages",
        headers=auth_headers,
        json={"text": "A demo-only reply"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["delivered"] is False
    assert body["mode"] == "demo"
    assert body["externalId"] is None
    assert "not transmitted" in body["warning"].lower()


async def test_demo_reel_analysis_is_labelled(client, auth_headers):
    response = await client.post(
        "/api/v1/reels/r2/analyze", headers=auth_headers, json={"force": False}
    )
    assert response.status_code == 200
    body = response.json()
    if body["status"] == "analyzed":
        assert body["analysis"]["source"] == "demo_seed"
        assert body["analysis"]["mediaAccessed"] is False
        assert body["analysis"]["limitations"]


async def test_inaccessible_reel_requires_upload(client, auth_headers):
    response = await client.post(
        "/api/v1/reels/r6/analyze", headers=auth_headers, json={"force": False}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["uploadRequired"] is True
    assert body["analysis"] is None


async def test_integration_reports_no_configuration(client, auth_headers):
    response = await client.get("/api/v1/integration", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["connection"]["status"] == "not_connected"
    assert body["status"]["personalAccountSupported"] is False

    connect = await client.get(
        "/api/v1/integration/connect-url", headers=auth_headers
    )
    assert connect.status_code == 200
    body = connect.json()
    assert body["configured"] is False
    assert set(body["missing"]) == {"IG_APP_ID", "IG_REDIRECT_URI"}
