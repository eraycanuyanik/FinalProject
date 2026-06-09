"""Faz 3: madde segmentasyonu testleri (LLM gerektirmez)."""
from pathlib import Path

from app.services.segmenter import segment

SAMPLE = Path(__file__).parent / "sample_contracts" / "kira_ornek.txt"


def test_segments_madde_headers():
    text = SAMPLE.read_text()
    clauses = segment(text)
    # Örnek sözleşmede 7 "Madde N" başlığı var.
    assert len(clauses) == 7
    assert clauses[0].label.lower().startswith("madde 1")
    # Ofsetler artan ve metinle tutarlı olmalı.
    for c in clauses:
        assert text[c.start:c.end].strip().startswith(c.text.splitlines()[0][:10])


def test_fallback_paragraphs():
    text = "Bu bir paragraftır.\n\nBu ikinci paragraftır.\n\nÜçüncü paragraf."
    clauses = segment(text)
    assert len(clauses) == 3


def test_empty():
    assert segment("") == []
