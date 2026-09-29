"""Tests for POST /api/memory-chat (mock Hindsight mode via conftest)."""


def test_memory_chat_mock_mode(client):
    r = client.post("/api/memory-chat", json={"question": "What fixed Weak Seal last year?"})
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["question"] == "What fixed Weak Seal last year?"
    assert isinstance(d["longterm_memories_recalled"], int)
    assert isinstance(d["recent_memories_recalled"], int)
    assert isinstance(d["memory_ids"], list)
    assert isinstance(d["samples"], list)


def test_memory_chat_rejects_empty(client):
    r = client.post("/api/memory-chat", json={"question": "   "})
    assert r.status_code == 400


def test_memory_chat_rejects_missing(client):
    r = client.post("/api/memory-chat", json={})
    assert r.status_code == 422
