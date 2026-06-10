"""Risk değerlendirme pipeline'ı: segmentasyon + toplu (batch) LLM analizi.

Hız için maddeler gruplar halinde TEK LLM çağrısında değerlendirilir
(28 madde → 28 çağrı yerine ~3-4 çağrı).
"""
from __future__ import annotations

import json

from app.prompts.risk_assess import BATCH_SCHEMA, build_batch_messages
from app.services.llm import llm_client
from app.services.rag import retrieve
from app.services.segmenter import segment

# Tek bir maddenin LLM'e gönderilen maksimum uzunluğu.
_MAX_CLAUSE_CHARS = 2500
# Bir batch'teki azami madde sayısı ve toplam karakter bütçesi.
_BATCH_MAX_CLAUSES = 8
_BATCH_MAX_CHARS = 4000


def _safe_int(value, default: int = 0) -> int:
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return default


def _make_batches(clauses: list) -> list[list]:
    """Maddeleri sayı + karakter bütçesine göre gruplara böler."""
    batches: list[list] = []
    cur: list = []
    cur_chars = 0
    for c in clauses:
        clen = min(len(c.text), _MAX_CLAUSE_CHARS)
        if cur and (len(cur) >= _BATCH_MAX_CLAUSES or cur_chars + clen > _BATCH_MAX_CHARS):
            batches.append(cur)
            cur, cur_chars = [], 0
        cur.append(c)
        cur_chars += clen
    if cur:
        batches.append(cur)
    return batches


def _fallback(reason: str) -> dict:
    return {
        "ozet": "",
        "risk_skoru": 0,
        "risk_turu": "değerlendirilemedi",
        "aciklama": reason,
        "taraf": "notr",
    }


async def _assess_batch(clauses: list, refs_by_index: dict[int, list]) -> dict[int, dict]:
    payload = [
        {"no": c.index, "text": c.text[:_MAX_CLAUSE_CHARS], "references": refs_by_index.get(c.index, [])}
        for c in clauses
    ]
    out: dict[int, dict] = {}
    try:
        raw = await llm_client.chat(
            build_batch_messages(payload), temperature=0.1, json_schema=BATCH_SCHEMA
        )
        data = json.loads(raw)
        for item in data.get("maddeler", []):
            no = item.get("no")
            if not isinstance(no, int):
                continue
            out[no] = {
                "ozet": str(item.get("ozet", "")).strip(),
                "risk_skoru": _safe_int(item.get("risk_skoru")),
                "risk_turu": str(item.get("risk_turu", "standart")).strip() or "standart",
                "aciklama": str(item.get("aciklama", "")).strip(),
                "taraf": str(item.get("taraf", "notr")).strip() or "notr",
            }
    except Exception as exc:  # noqa: BLE001 — bir batch patlarsa pipeline durmasın
        for c in clauses:
            out[c.index] = _fallback(f"Otomatik değerlendirilemedi: {exc}")
    return out


async def analyze_document(text: str) -> list[dict]:
    """Belgeyi maddelere böler, RAG referanslarını çeker ve toplu değerlendirir."""
    clauses = segment(text)

    # RAG referanslarını her madde için topla (LLM'e göre ucuz).
    refs_by_index = {c.index: retrieve(c.text[:_MAX_CLAUSE_CHARS], k=3) for c in clauses}

    results: list[dict] = []
    for batch in _make_batches(clauses):
        assessments = await _assess_batch(batch, refs_by_index)
        for c in batch:
            a = assessments.get(c.index) or _fallback("Model bu maddeyi atladı.")
            results.append(
                {
                    "index": c.index,
                    "label": c.label,
                    "text": c.text,
                    "start": c.start,
                    "end": c.end,
                    "references": refs_by_index.get(c.index, []),
                    **a,
                }
            )
    return results
