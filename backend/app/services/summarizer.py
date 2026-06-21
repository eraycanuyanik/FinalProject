"""Tüm belgeyi tek prompt'la özetler (Faz 2 — basit özetleme)."""
from app.prompts.summarize import build_summarize_messages
from app.services.llm import llm_client

# gemma-4-e4b bağlamına sığması için kaba bir karakter sınırı.
# (Madde bazlı işleme Faz 3'te gelecek; burada amaç tek-prompt özet.)
_MAX_CHARS = 24000


async def summarize_document(text: str, jurisdiction: str = "tr") -> str:
    snippet = text.strip()
    if len(snippet) > _MAX_CHARS:
        snippet = (
            snippet[:_MAX_CHARS]
            + "\n\n[... belge çok uzun olduğu için kısaltıldı ...]"
        )
    messages = build_summarize_messages(snippet, jurisdiction)
    return await llm_client.chat(messages, temperature=0.2)
