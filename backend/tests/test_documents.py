"""Faz 2 testleri: yükleme + metin çıkarma + belge yaşam döngüsü.

LLM gerektiren /summarize burada test edilmez (canlı LM Studio gerekir).
"""
import io
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.services.extractor import extract_text

client = TestClient(app)

SAMPLE = Path(__file__).parent / "sample_contracts" / "kira_ornek.txt"


def test_extract_txt():
    content = SAMPLE.read_bytes()
    result = extract_text("kira_ornek.txt", content)
    assert result.method == "txt"
    assert "KİRA SÖZLEŞMESİ" in result.text
    assert result.ocr_used is False


def test_upload_and_get_and_delete():
    content = SAMPLE.read_bytes()
    resp = client.post(
        "/documents/upload",
        files={"file": ("kira_ornek.txt", io.BytesIO(content), "text/plain")},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    doc_id = body["id"]
    assert body["char_count"] > 0
    assert body["method"] == "txt"
    assert "KİRA" in body["text_preview"]

    # get
    got = client.get(f"/documents/{doc_id}")
    assert got.status_code == 200
    assert got.json()["summary"] is None

    # delete
    deleted = client.delete(f"/documents/{doc_id}")
    assert deleted.status_code == 200
    assert client.get(f"/documents/{doc_id}").status_code == 404


def test_unsupported_type_rejected():
    resp = client.post(
        "/documents/upload",
        files={"file": ("tablo.xlsx", io.BytesIO(b"PK\x03\x04..."), "application/vnd.ms-excel")},
    )
    assert resp.status_code == 415
