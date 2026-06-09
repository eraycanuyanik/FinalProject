"""Kanun PDF'ini madde madde parçalar.

mevzuat.gov.tr konsolide PDF'lerinde maddeler "MADDE 6- ...", "GEÇİCİ MADDE 1- ..."
biçimindedir. Her maddeyi (no + metin) ayrı bir parça (chunk) yaparız.
"""
from __future__ import annotations

import io
import re
import unicodedata
from dataclasses import dataclass

import pdfplumber

# "MADDE 6-", "Madde 12 -", "GEÇİCİ MADDE 1-" başlıkları (satır başında).
_MADDE_RE = re.compile(
    r"(?m)^\s*((?:GEÇİCİ\s+)?MADDE)\s+(\d+)\s*[-–—]?",
    re.IGNORECASE,
)


def _fold_tr(s: str) -> str:
    """Türkçe aksanları/İ-noktasını düşürüp küçük harfe çevirir (locale-bağımsız)."""
    nkfd = unicodedata.normalize("NFKD", s)
    stripped = "".join(c for c in nkfd if not unicodedata.combining(c))
    return stripped.lower()


@dataclass
class LawArticle:
    kanun_no: int
    kanun_adi: str
    madde_no: str          # "6" ya da "Geçici 1"
    text: str              # madde gövdesi (başlık dahil)


def _pdf_to_text(pdf_bytes: bytes) -> str:
    parts: list[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            parts.append(page.extract_text() or "")
    return "\n".join(parts)


def split_articles_from_text(text: str, kanun_no: int, kanun_adi: str) -> list[LawArticle]:
    matches = list(_MADDE_RE.finditer(text))
    articles: list[LawArticle] = []

    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if len(body) < 15:
            continue
        gecici = "gecici" in _fold_tr(m.group(1))
        madde_no = f"Geçici {m.group(2)}" if gecici else m.group(2)
        # Çok uzun maddeleri makul boyuta indir (embedding bağlamı için).
        body = re.sub(r"[ \t]+", " ", body)
        articles.append(
            LawArticle(
                kanun_no=kanun_no,
                kanun_adi=kanun_adi,
                madde_no=madde_no,
                text=body[:3000],
            )
        )
    return articles


def parse_articles(pdf_bytes: bytes, kanun_no: int, kanun_adi: str) -> list[LawArticle]:
    text = _pdf_to_text(pdf_bytes)
    return split_articles_from_text(text, kanun_no, kanun_adi)
