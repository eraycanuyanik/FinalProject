"""Faz 1 dumanı testi: /health ve / uçları cevap veriyor mu?

LM Studio / ChromaDB ayakta olmasa bile uçlar 200 dönmeli (status='degraded').
"""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root():
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["app"] == "Anlattım API"


def test_health_shape():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in {"ok", "degraded"}
    assert "llm" in body and "chroma" in body
    assert "ok" in body["llm"]
