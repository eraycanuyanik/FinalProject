"""Belge yükleme, görüntüleme, özetleme uçları (Faz 2)."""
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.schemas import (
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
from app.services.summarizer import summarize_document

router = APIRouter(prefix="/documents", tags=["documents"])

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


@router.delete("/{doc_id}")
async def delete_document(doc_id: str) -> dict[str, str]:
    if not document_store.delete(doc_id):
        raise HTTPException(status_code=404, detail="Belge bulunamadı.")
    return {"status": "deleted", "id": doc_id}


@router.get("")
async def supported_types() -> dict[str, list[str]]:
    return {"supported_extensions": sorted(SUPPORTED_EXTENSIONS)}
