"""Sohbet prompt'ları (ülkeye göre TR/EN; belgeli veya belgesiz/genel mod)."""

SYSTEM_PROMPT_TR = """Sen "Anlattım" adlı bir asistansın. Kullanıcının hukuki \
sorularını yanıtlarsın. Görevin:

- SADECE verilen bağlama (varsa sözleşme metni) ve ilgili Türk mevzuatına dayan.
- Sade, anlaşılır Türkçe kullan. Avukatı olmayan biri anlasın.
- Mümkün olduğunda ilgili KANUN ve MADDE NUMARASINI belirt (ör. "TBK m. 343").
- Cevap yoksa dürüstçe "Bu konuda elimde net bilgi yok" de; uydurma.
- Kesin hukuki tavsiye verme; gerekiyorsa avukata danışılmasını öner.
- Yalnızca Türkçe yanıt ver. KISA ve NET ol, en fazla 2-3 paragraf; tekrar etme."""

SYSTEM_PROMPT_EN = """You are "Anlattım", an assistant that answers the user's legal \
questions. Your job:

- Rely ONLY on the given context (the contract text, if any) and relevant U.S. law.
- Use plain, clear English an ordinary person understands.
- When possible, cite the relevant LAW and SECTION (e.g. "UCC § 2-316", "16 CFR § 433").
- If you don't know, honestly say "I don't have clear information on this"; do not invent.
- Do not give definitive legal advice; suggest consulting a lawyer if needed.
- Respond only in English. Be SHORT and clear, at most 2-3 paragraphs; no repetition."""

_LABELS = {
    "tr": {
        "doc": "## Sözleşme Metni",
        "law": "## İlgili Türk Mevzuatı (referans için)",
        "none": "(İlgili mevzuat bulunamadı.)",
        "q": "## Soru",
        "trunc": "\n[... belge kısaltıldı ...]",
    },
    "us": {
        "doc": "## Contract Text",
        "law": "## Relevant U.S. Law (for reference)",
        "none": "(No relevant law found.)",
        "q": "## Question",
        "trunc": "\n[... document truncated ...]",
    },
}


def _format_references(references: list[dict], lang: dict) -> str:
    if not references:
        return lang["none"]
    lines = []
    for r in references:
        lines.append(
            f"- {r.get('kanun_adi', '')} {r.get('madde_no', '')}: {r.get('snippet', '')[:350]}"
        )
    return "\n".join(lines)


def build_chat_messages(
    question: str,
    history: list[dict],
    references: list[dict],
    jurisdiction: str = "tr",
    document_text: str | None = None,
    max_doc_chars: int = 10000,
) -> list[dict[str, str]]:
    is_us = jurisdiction == "us"
    system = SYSTEM_PROMPT_EN if is_us else SYSTEM_PROMPT_TR
    lang = _LABELS["us" if is_us else "tr"]

    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    for turn in history[-6:]:
        role = turn.get("role")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    parts = []
    if document_text:
        doc = document_text.strip()
        if len(doc) > max_doc_chars:
            doc = doc[:max_doc_chars] + lang["trunc"]
        parts.append(f'{lang["doc"]}\n"""\n{doc}\n"""')
    parts.append(f'{lang["law"]}\n{_format_references(references, lang)}')
    parts.append(f'{lang["q"]}\n{question}')

    messages.append({"role": "user", "content": "\n\n".join(parts)})
    return messages
