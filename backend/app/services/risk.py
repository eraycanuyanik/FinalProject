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
# Küçük tutuyoruz: akışta (streaming) sonuçlar daha sık görünsün. Üretim süresi
# zaten baskın olduğundan, fazladan birkaç çağrının maliyeti düşük.
_BATCH_MAX_CLAUSES = 4
_BATCH_MAX_CHARS = 2200


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


async def iter_analysis(text: str):
    """Maddeleri batch'ler hâlinde değerlendirir; her madde bittikçe 'yield' eder.

    Önce {'type':'meta','total':N} verir, sonra her madde için
    {'type':'clause','clause':{...}}. Akış (streaming) için kullanılır.
    """
    clauses = segment(text)
    yield {"type": "meta", "total": len(clauses)}

    # RAG referanslarını her madde için topla (LLM'e göre ucuz).
    refs_by_index = {c.index: retrieve(c.text[:_MAX_CLAUSE_CHARS], k=3) for c in clauses}

    for batch in _make_batches(clauses):
        assessments = await _assess_batch(batch, refs_by_index)
        for c in batch:
            a = assessments.get(c.index) or _fallback("Model bu maddeyi atladı.")
            yield {
                "type": "clause",
                "clause": {
                    "index": c.index,
                    "label": c.label,
                    "text": c.text,
                    "start": c.start,
                    "end": c.end,
                    "references": refs_by_index.get(c.index, []),
                    **a,
                },
            }


async def analyze_document(text: str) -> list[dict]:
    """Tüm analizi toplayıp döndürür (akış gerektirmeyen yollar için)."""
    results: list[dict] = []
    async for ev in iter_analysis(text):
        if ev["type"] == "clause":
            results.append(ev["clause"])
    return results
