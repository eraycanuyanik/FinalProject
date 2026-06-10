"""Belge yükleme, görüntüleme, özetleme uçları (Faz 2)."""
import asyncio
import json

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.models.schemas import (
    AnalyzeResponse,
    ClauseRisk,
    DocumentResponse,
    SummaryResponse,
    UploadResponse,
)
from app.services.document_store import document_store
from app.services.extractor import (
    SUPPORTED_EXTENSIONS,
    UnsupportedFileType,
    extract_text,
)
from app.services.risk import analyze_document, iter_analysis
from app.services.summarizer import summarize_document

router = APIRouter(prefix="/documents", tags=["documents"])

# Belge başına analiz kilidi: aynı belge için eşzamanlı /analyze istekleri
# (ör. çift sekme/yenileme) tek bir hesaplamayı paylaşsın, modeli iki kez yormasın.
_analyze_locks: dict[str, asyncio.Lock] = {}

# 20 MB üst sınır.
_MAX_BYTES = 20 * 1024 * 1024


@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)) -> UploadResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Boş dosya.")
    if len(content) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Dosya 20 MB sınırını aşıyor.")

    try:
        result = extract_text(file.filename or "belge", content)
    except UnsupportedFileType as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=422, detail=f"Metin çıkarılamadı: {exc}"
        ) from exc

    if not result.text.strip():
        raise HTTPException(
            status_code=422,
            detail="Belgeden metin çıkarılamadı. Taranmış belgeyse OCR yetersiz kalmış olabilir.",
        )

    doc = document_store.add(
        filename=file.filename or "belge",
        text=result.text,
        method=result.method,
        pages=result.pages,
        ocr_used=result.ocr_used,
    )

    return UploadResponse(
        id=doc.id,
        filename=doc.filename,
        method=doc.method,
        pages=doc.pages,
        ocr_used=doc.ocr_used,
        char_count=doc.char_count,
        text_preview=doc.text[:500],
    )


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str) -> DocumentResponse:
    doc = document_store.get(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Belge bulunamadı.")
    return DocumentResponse(
        id=doc.id,
        filename=doc.filename,
        method=doc.method,
        pages=doc.pages,
        ocr_used=doc.ocr_used,
        char_count=doc.char_count,
        text=doc.text,
        summary=doc.summary,
        analyzed=doc.analysis is not None,
    )


@router.post("/{doc_id}/summarize", response_model=SummaryResponse)
async def summarize(doc_id: str) -> SummaryResponse:
    doc = document_store.get(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Belge bulunamadı.")

    # Önceden özetlendiyse tekrar üretmeyelim.
    if doc.summary:
        return SummaryResponse(id=doc.id, summary=doc.summary)

    try:
        summary = await summarize_document(doc.text)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502, detail=f"LLM özetleme hatası: {exc}"
        ) from exc

    document_store.set_summary(doc.id, summary)
    return SummaryResponse(id=doc.id, summary=summary)


@router.post("/{doc_id}/analyze", response_model=AnalyzeResponse)
async def analyze(doc_id: str) -> AnalyzeResponse:
    doc = document_store.get(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Belge bulunamadı.")

    # Önceden analiz edildiyse tekrar üretmeyelim.
    if doc.analysis is not None:
        clauses = [ClauseRisk(**c) for c in doc.analysis]
        return AnalyzeResponse(id=doc.id, clause_count=len(clauses), clauses=clauses)

    # Eşzamanlı istekleri tek hesaplamada birleştir (modeli iki kez yorma).
    lock = _analyze_locks.setdefault(doc_id, asyncio.Lock())
    async with lock:
        doc = document_store.get(doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail="Belge bulunamadı.")
        # Kilidi beklerken başka bir istek bitirmiş olabilir → cache'i kullan.
        if doc.analysis is not None:
            clauses = [ClauseRisk(**c) for c in doc.analysis]
            return AnalyzeResponse(id=doc.id, clause_count=len(clauses), clauses=clauses)

        try:
            analysis = await analyze_document(doc.text)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=502, detail=f"Risk analizi hatası: {exc}"
            ) from exc

        document_store.set_analysis(doc.id, analysis)

    clauses = [ClauseRisk(**c) for c in analysis]
    return AnalyzeResponse(id=doc.id, clause_count=len(clauses), clauses=clauses)


@router.post("/{doc_id}/analyze/stream")
async def analyze_stream(doc_id: str) -> StreamingResponse:
    """Analizi NDJSON olarak akıtır: maddeler bittikçe satır satır gönderir.

    Toplam süre aynıdır ama istemci ilerlemeyi (ve sonuçları) canlı görür.
    """
    doc = document_store.get(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Belge bulunamadı.")

    async def gen():
        # Önbellekte varsa anında geri oynat.
        if doc.analysis is not None:
            yield json.dumps({"type": "meta", "total": len(doc.analysis)}) + "\n"
            for c in doc.analysis:
                yield json.dumps({"type": "clause", "clause": c}, ensure_ascii=False) + "\n"
            yield json.dumps({"type": "done"}) + "\n"
            return

        collected: list[dict] = []
        try:
            async for ev in iter_analysis(doc.text):
                if ev["type"] == "clause":
                    collected.append(ev["clause"])
                yield json.dumps(ev, ensure_ascii=False) + "\n"
            document_store.set_analysis(doc_id, collected)
            yield json.dumps({"type": "done"}) + "\n"
        except Exception as exc:  # noqa: BLE001
            yield json.dumps({"type": "error", "detail": str(exc)}) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")


@router.delete("/{doc_id}")
async def delete_document(doc_id: str) -> dict[str, str]:
    if not document_store.delete(doc_id):
        raise HTTPException(status_code=404, detail="Belge bulunamadı.")
    return {"status": "deleted", "id": doc_id}


@router.get("")
async def supported_types() -> dict[str, list[str]]:
    return {"supported_extensions": sorted(SUPPORTED_EXTENSIONS)}
