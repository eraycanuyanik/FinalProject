"""Faz 5: chat ucu temel testleri (LLM gerektirmeyen yollar)."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_chat_unknown_document():
    resp = client.post("/chat", json={"doc_id": "yok123", "message": "merhaba"})
    assert resp.status_code == 404


def test_chat_empty_message():
    # Önce bir belge yükle, sonra boş mesaj gönder.
    up = client.post(
        "/documents/upload",
        files={"file": ("a.txt", b"Madde 1- Test. Madde 2- Test iki.", "text/plain")},
    )
    doc_id = up.json()["id"]
    resp = client.post("/chat", json={"doc_id": doc_id, "message": "   "})
    assert resp.status_code == 400
