"""Belge bağlamlı sohbet prompt'u (Türkçe, RAG referanslı)."""

SYSTEM_PROMPT = """Sen "Anlattım" adlı bir asistansın. Kullanıcı sana yüklediği \
sözleşme hakkında soru soruyor. Görevin:

- SADECE verilen sözleşme metnine ve ilgili Türk mevzuatına dayanarak yanıt ver.
- Sade, anlaşılır Türkçe kullan. Avukatı olmayan biri anlasın.
- Mümkün olduğunda ilgili KANUN ve MADDE NUMARASINI belirt (ör. "TBK m. 343").
- Sözleşmede ya da mevzuatta cevap yoksa, dürüstçe "Bu konuda belgede/mevzuatta \
net bir bilgi yok" de; uydurma.
- Kesin hukuki tavsiye verme; bilgilendirme amaçlı açıkla ve gerekiyorsa avukata \
danışılmasını öner.
- Yalnızca Türkçe yanıt ver. KISA ve NET ol: en fazla 2-3 paragraf. Aynı cümleleri \
veya fikri TEKRAR ETME. Soruyu doğrudan yanıtla."""

CONTEXT_TEMPLATE = """## Sözleşme Metni
\"\"\"
{document_text}
\"\"\"

## İlgili Türk Mevzuatı (referans için)
{references}

## Soru
{question}"""


def _format_references(references: list[dict]) -> str:
    if not references:
        return "(İlgili mevzuat bulunamadı.)"
    lines = []
    for r in references:
        lines.append(
            f"- {r.get('kanun_adi', '')} Madde {r.get('madde_no', '')}: "
            f"{r.get('snippet', '')[:350]}"
        )
    return "\n".join(lines)


def build_chat_messages(
    document_text: str,
    question: str,
    history: list[dict],
    references: list[dict],
    max_doc_chars: int = 10000,
) -> list[dict[str, str]]:
    doc = document_text.strip()
    if len(doc) > max_doc_chars:
        doc = doc[:max_doc_chars] + "\n[... belge kısaltıldı ...]"

    messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    # Geçmiş sohbet turları (rol/içerik).
    for turn in history[-6:]:
        role = turn.get("role")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append(
        {
            "role": "user",
            "content": CONTEXT_TEMPLATE.format(
                document_text=doc,
                references=_format_references(references),
                question=question,
            ),
        }
    )
    return messages
