"""Madde bazlı risk değerlendirmesi prompt'u (Türkçe, yapısal JSON çıktı)."""

# LM Studio'nun zorlayacağı JSON şeması.
RISK_SCHEMA = {
    "type": "object",
    "properties": {
        "ozet": {"type": "string"},
        "risk_skoru": {"type": "integer", "minimum": 0, "maximum": 100},
        "risk_turu": {"type": "string"},
        "aciklama": {"type": "string"},
        "taraf": {"type": "string", "enum": ["yukumluluk", "hak", "notr"]},
    },
    "required": ["ozet", "risk_skoru", "risk_turu", "aciklama", "taraf"],
}

SYSTEM_PROMPT = """Sen "Anlattım" adlı bir hukuki risk analiz asistanısın. Bir \
sözleşmenin tek bir maddesini, o sözleşmeyi imzalayacak SIRADAN/ZAYIF taraf \
(kiracı, işçi, tüketici, hizmet alan) gözünden değerlendirirsin.

Görevin, maddenin bu kişinin ALEYHİNE olup olmadığını ölçmek:
- risk_skoru: 0-100 arası. 0-20 = zararsız/standart, 21-50 = dikkat edilmeli,
  51-75 = riskli, 76-100 = ciddi şekilde aleyhte/haksız.
- risk_turu: kısa etiket (ör. "tek taraflı cezai şart", "cayma hakkı yok",
  "yetkili mahkeme aleyhte", "fahiş gecikme faizi", "haksız tahliye", "standart").
- ozet: maddenin ne dediğini 1-2 cümlede sade Türkçeyle anlat.
- aciklama: neden riskli (ya da neden zararsız) olduğunu sade Türkçeyle açıkla.
- taraf: madde çoğunlukla kişiye bir "yukumluluk" mu yüklüyor, bir "hak" mı
  tanıyor, yoksa "notr" mü?

Kurallar: Sadece Türkçe. Abartma, uydurma. Yalnızca geçerli JSON döndür."""

USER_TEMPLATE = """Aşağıdaki sözleşme maddesini değerlendir:

\"\"\"
{clause_text}
\"\"\"
{context_block}"""

CONTEXT_HEADER = """

İlgili Türk mevzuatı (referans için — uygunsa açıklamanda ilgili kanun ve madde \
numarasını an):
{references}"""


def _format_references(references: list[dict]) -> str:
    if not references:
        return ""
    lines = []
    for r in references:
        lines.append(
            f"- {r.get('kanun_adi', '')} (No {r.get('kanun_no', '')}) "
            f"Madde {r.get('madde_no', '')}: {r.get('snippet', '')[:300]}"
        )
    return CONTEXT_HEADER.format(references="\n".join(lines))


def build_messages(clause_text: str, references: list[dict] | None = None) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": USER_TEMPLATE.format(
                clause_text=clause_text,
                context_block=_format_references(references or []),
            ),
        },
    ]


# --- Toplu (batch) değerlendirme: birden çok maddeyi tek LLM çağrısında değerlendirir ---

BATCH_SCHEMA = {
    "type": "object",
    "properties": {
        "maddeler": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "no": {"type": "integer"},
                    "ozet": {"type": "string"},
                    "risk_skoru": {"type": "integer", "minimum": 0, "maximum": 100},
                    "risk_turu": {"type": "string"},
                    "aciklama": {"type": "string"},
                    "taraf": {"type": "string", "enum": ["yukumluluk", "hak", "notr"]},
                },
                "required": ["no", "ozet", "risk_skoru", "risk_turu", "aciklama", "taraf"],
            },
        }
    },
    "required": ["maddeler"],
}

BATCH_SYSTEM_PROMPT_TR = SYSTEM_PROMPT + """

Sana NUMARALANDIRILMIŞ birden fazla madde verilecek. HER madde için ayrı bir \
değerlendirme üret ve "no" alanına o maddenin numarasını yaz. Tüm maddeleri \
"maddeler" dizisinde döndür; hiçbirini atlama.

KISA YAZ: "ozet" en fazla 1 cümle, "aciklama" en fazla 1-2 cümle olsun. \
Gereksiz tekrar yapma. Bu, hızlı yanıt için önemlidir."""

SYSTEM_PROMPT_EN = """You are "Anlattım", a legal risk-analysis assistant. You \
evaluate a single clause of a contract from the perspective of the ORDINARY/WEAKER \
party who will sign it (tenant, employee, consumer, service recipient).

Your job is to measure whether the clause is AGAINST this person's interests:
- risk_skoru: 0-100. 0-20 = harmless/standard, 21-50 = pay attention, 51-75 = risky,
  76-100 = seriously unfair/against them.
- risk_turu: a short English label (e.g. "one-sided penalty", "no right to cancel",
  "unfair venue", "excessive late fee", "broad waiver", "standard").
- ozet: what the clause says, in 1 plain-English sentence.
- aciklama: why it is risky (or harmless), in plain English.
- taraf: does the clause mainly impose an obligation ("yukumluluk"), grant a right
  ("hak"), or is it neutral ("notr")?

Rules: Respond only in English. Do not exaggerate or invent. Return only valid JSON."""

BATCH_SYSTEM_PROMPT_EN = SYSTEM_PROMPT_EN + """

You will be given several NUMBERED clauses. Produce a separate evaluation for EACH \
clause and put its number in the "no" field. Return all clauses in the "maddeler" \
array; do not skip any.

BE BRIEF: "ozet" at most 1 sentence, "aciklama" at most 1-2 sentences. Do not repeat \
yourself. This matters for fast responses."""


def build_batch_messages(clauses: list[dict], jurisdiction: str = "tr") -> list[dict[str, str]]:
    """clauses: [{'no': int, 'text': str, 'references': [...]}, ...]"""
    is_us = jurisdiction == "us"
    parts = []
    for c in clauses:
        label = "Clause" if is_us else "Madde"
        block = f"### {label} {c['no']}\n{c['text']}"
        refs = c.get("references") or []
        if refs:
            ref_lines = "; ".join(
                f"{r.get('kanun_adi', '')} {r.get('madde_no', '')}" for r in refs[:2]
            )
            block += f"\n({'Relevant law' if is_us else 'İlgili mevzuat'}: {ref_lines})"
        parts.append(block)
    if is_us:
        system = BATCH_SYSTEM_PROMPT_EN
        user = "Evaluate EACH of the following clauses:\n\n" + "\n\n".join(parts)
    else:
        system = BATCH_SYSTEM_PROMPT_TR
        user = "Aşağıdaki maddelerin HER BİRİNİ değerlendir:\n\n" + "\n\n".join(parts)
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
