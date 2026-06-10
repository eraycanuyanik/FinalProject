"""Belge bağlamlı sohbet ucu (Faz 5): belge + RAG + LLM."""
from fastapi import APIRouter, HTTPException

from app.models.schemas import ChatRequest, ChatResponse, LawReference
from app.prompts.rag_chat import build_chat_messages
from app.services.document_store import document_store
from app.services.llm import llm_client
from app.services.rag import retrieve

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    doc = document_store.get(req.doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Belge bulunamadı.")
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Boş mesaj.")

    # Soruyla ilgili kanun maddelerini getir (RAG).
    references = retrieve(req.message, k=4)

    messages = build_chat_messages(
        document_text=doc.text,
        question=req.message,
        history=[m.model_dump() for m in req.history],
        references=references,
    )

    try:
        answer = await llm_client.chat(messages, temperature=0.3)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"LLM sohbet hatası: {exc}") from exc

    return ChatResponse(
        answer=answer,
        references=[LawReference(**r) for r in references],
    )
