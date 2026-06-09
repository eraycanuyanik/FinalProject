"""Özetleme prompt'ları (Türkçe)."""

SYSTEM_PROMPT = """Sen "Anlattım" adlı bir asistansın. Görevin, hukuki Türkçe \
sözleşmeleri avukatı olmayan sıradan bir kişinin anlayacağı sade Türkçeyle \
açıklamaktır.

Kurallar:
- Sade, günlük dil kullan. Hukuki jargondan kaçın; kullanırsan parantez içinde açıkla.
- Tarafsız ve doğru ol. Belgede olmayan bir şey uydurma.
- Kesin hukuki tavsiye verme; bilgilendirme amaçlı açıkla.
- Yanıtını Markdown ile biçimlendir.
- Yalnızca Türkçe yanıt ver."""

SUMMARIZE_TEMPLATE = """Aşağıdaki sözleşmeyi sade Türkçeyle özetle. Yanıtını şu \
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


def build_summarize_messages(document_text: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": SUMMARIZE_TEMPLATE.format(document_text=document_text)},
    ]
