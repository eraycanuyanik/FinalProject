"""Sohbet ucu: belgeli veya belgesiz (genel) hukuk soru-cevabı (Faz 5 + çok-ülke)."""
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatRequest, ChatResponse, LawReference
from app.prompts.rag_chat import build_chat_messages
from app.services.document_store import document_store
from app.services.llm import llm_client
from app.services.rag import normalize_jurisdiction, retrieve

router = APIRouter(prefix="/chat", tags=["chat"])


def _resolve(req: ChatRequest):
    """Ortak: ülke, kullanıcı, belge bağlamı ve RAG referanslarını çözer."""
    jurisdiction = normalize_jurisdiction(req.jurisdiction)
    user = (req.user or "misafir").strip()[:60] or "misafir"
    document_text = None
    if req.doc_id:
        doc = document_store.get(req.doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail="Belge bulunamadı.")
        document_text = doc.text
        jurisdiction = normalize_jurisdiction(doc.jurisdiction)
        user = doc.user or user
    references = retrieve(req.message, jurisdiction=jurisdiction, k=4)
    messages = build_chat_messages(
        question=req.message,
        history=[m.model_dump() for m in req.history],
        references=references,
        jurisdiction=jurisdiction,
        document_text=document_text,
    )
    return messages, references, user


@router.post("/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    """Yanıtı NDJSON akışı olarak döndürür: meta(references) → delta'lar → done."""
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Boş mesaj.")
    messages, references, user = _resolve(req)

    async def gen():
        yield json.dumps(
            {"type": "meta", "references": references}, ensure_ascii=False
        ) + "\n"
        try:
            async for delta in llm_client.chat_stream(messages, temperature=0.3, user=user):
                yield json.dumps({"type": "delta", "text": delta}, ensure_ascii=False) + "\n"
            yield json.dumps({"type": "done"}) + "\n"
        except Exception as exc:  # noqa: BLE001
            yield json.dumps({"type": "error", "detail": str(exc)}) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Boş mesaj.")

    document_text: str | None = None
    jurisdiction = normalize_jurisdiction(req.jurisdiction)
    user = (req.user or "misafir").strip()[:60] or "misafir"

    # Belge bağlamı varsa onu ve belgenin ülkesini kullan.
    if req.doc_id:
        doc = document_store.get(req.doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail="Belge bulunamadı.")
        document_text = doc.text
        jurisdiction = normalize_jurisdiction(doc.jurisdiction)
        user = doc.user or user

    # Soruyla ilgili kanun maddelerini getir (RAG).
    references = retrieve(req.message, jurisdiction=jurisdiction, k=4)

    messages = build_chat_messages(
        question=req.message,
        history=[m.model_dump() for m in req.history],
        references=references,
        jurisdiction=jurisdiction,
        document_text=document_text,
    )

    try:
        answer = await llm_client.chat(messages, temperature=0.3, user=user)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"LLM sohbet hatası: {exc}") from exc

    return ChatResponse(
        answer=answer,
        references=[LawReference(**r) for r in references],
    )
