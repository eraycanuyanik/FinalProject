"""Risk değerlendirme pipeline'ı: segmentasyon + madde başına LLM analizi."""
from __future__ import annotations

import json

from app.prompts.risk_assess import RISK_SCHEMA, build_messages
from app.services.llm import llm_client
from app.services.segmenter import Clause, segment

# Tek bir maddenin LLM'e gönderilen maksimum uzunluğu.
_MAX_CLAUSE_CHARS = 4000


def _safe_int(value, default: int = 0) -> int:
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return default


async def _assess_clause(clause: Clause) -> dict:
    text = clause.text[:_MAX_CLAUSE_CHARS]
    try:
        raw = await llm_client.chat(
            build_messages(text), temperature=0.1, json_schema=RISK_SCHEMA
        )
        data = json.loads(raw)
        return {
            "ozet": str(data.get("ozet", "")).strip(),
            "risk_skoru": _safe_int(data.get("risk_skoru")),
            "risk_turu": str(data.get("risk_turu", "standart")).strip() or "standart",
            "aciklama": str(data.get("aciklama", "")).strip(),
            "taraf": str(data.get("taraf", "notr")).strip() or "notr",
        }
    except Exception as exc:  # noqa: BLE001 — bir madde patlarsa pipeline durmasın
        return {
            "ozet": "",
            "risk_skoru": 0,
            "risk_turu": "değerlendirilemedi",
            "aciklama": f"Bu madde otomatik değerlendirilemedi: {exc}",
            "taraf": "notr",
        }


async def analyze_document(text: str) -> list[dict]:
    """Belgeyi maddelere böler ve her maddeyi sırayla değerlendirir."""
    clauses = segment(text)
    results: list[dict] = []
    for clause in clauses:
        assessment = await _assess_clause(clause)
        results.append(
            {
                "index": clause.index,
                "label": clause.label,
                "text": clause.text,
                "start": clause.start,
                "end": clause.end,
                **assessment,
            }
        )
    return results
