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

BATCH_SYSTEM_PROMPT = SYSTEM_PROMPT + """

Sana NUMARALANDIRILMIŞ birden fazla madde verilecek. HER madde için ayrı bir \
değerlendirme üret ve "no" alanına o maddenin numarasını yaz. Tüm maddeleri \
"maddeler" dizisinde döndür; hiçbirini atlama.

KISA YAZ: "ozet" en fazla 1 cümle, "aciklama" en fazla 1-2 cümle olsun. \
Gereksiz tekrar yapma. Bu, hızlı yanıt için önemlidir."""


def build_batch_messages(clauses: list[dict]) -> list[dict[str, str]]:
    """clauses: [{'no': int, 'text': str, 'references': [...]}, ...]"""
    parts = []
    for c in clauses:
        block = f"### Madde {c['no']}\n{c['text']}"
        refs = c.get("references") or []
        if refs:
            ref_lines = "; ".join(
                f"{r.get('kanun_adi', '')} m.{r.get('madde_no', '')}" for r in refs[:2]
            )
            block += f"\n(İlgili mevzuat: {ref_lines})"
        parts.append(block)
    user = "Aşağıdaki maddelerin HER BİRİNİ değerlendir:\n\n" + "\n\n".join(parts)
    return [
        {"role": "system", "content": BATCH_SYSTEM_PROMPT},
        {"role": "user", "content": user},
    ]
