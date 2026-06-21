"""Özetleme prompt'ları (ülkeye göre Türkçe / İngilizce)."""

SYSTEM_PROMPT_TR = """Sen "Anlattım" adlı bir asistansın. Görevin, hukuki Türkçe \
sözleşmeleri avukatı olmayan sıradan bir kişinin anlayacağı sade Türkçeyle \
açıklamaktır.

Kurallar:
- Sade, günlük dil kullan. Hukuki jargondan kaçın; kullanırsan parantez içinde açıkla.
- Tarafsız ve doğru ol. Belgede olmayan bir şey uydurma.
- Kesin hukuki tavsiye verme; bilgilendirme amaçlı açıkla.
- Yanıtını Markdown ile biçimlendir.
- Yalnızca Türkçe yanıt ver."""

SUMMARIZE_TEMPLATE_TR = """Aşağıdaki sözleşmeyi sade Türkçeyle özetle. Yanıtını şu \
başlıklarla ver:

## Özet
Sözleşmenin ne hakkında olduğunu 2-4 cümleyle anlat.

## Taraflar ve Konu
Kim, kiminle, ne için anlaşıyor?

## Önemli Noktalar
En önemli 4-7 maddeyi madde madde (•) listele.

## Dikkat Edilmesi Gerekenler
İmza atmadan önce kişinin dikkat etmesi gereken noktaları madde madde listele.

Sözleşme metni:
\"\"\"
{document_text}
\"\"\"
"""

SYSTEM_PROMPT_EN = """You are "Anlattım", an assistant that explains legal contracts \
in plain English that an ordinary person without a lawyer can understand.

Rules:
- Use plain, everyday language. Avoid legal jargon; if you must use it, explain in parentheses.
- Be neutral and accurate. Do not invent anything that is not in the document.
- Do not give definitive legal advice; explain for informational purposes.
- Format your answer in Markdown.
- Respond only in English."""

SUMMARIZE_TEMPLATE_EN = """Summarize the following contract in plain English. Use these \
headings:

## Summary
What the contract is about, in 2-4 sentences.

## Parties and Subject
Who is agreeing with whom, and for what?

## Key Points
List the 4-7 most important clauses as bullet points (•).

## Watch Out For
List points the person should be careful about before signing, as bullets.

Contract text:
\"\"\"
{document_text}
\"\"\"
"""


def build_summarize_messages(document_text: str, jurisdiction: str = "tr") -> list[dict[str, str]]:
    if jurisdiction == "us":
        system, template = SYSTEM_PROMPT_EN, SUMMARIZE_TEMPLATE_EN
    else:
        system, template = SYSTEM_PROMPT_TR, SUMMARIZE_TEMPLATE_TR
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": template.format(document_text=document_text)},
    ]
