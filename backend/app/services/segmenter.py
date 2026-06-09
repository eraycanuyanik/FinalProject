"""Sözleşme metnini maddelere böler.

Strateji: önce "Madde N", "MADDE N", "N." gibi başlıkları regex ile yakala
(deterministik, karakter ofsetlerini korur). Yeterli başlık yoksa paragraflara
göre böl. Ofsetler frontend'de highlight için kullanılır.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# "Madde 1", "MADDE 12 -", "Madde 3." gibi başlıklar (satır başında).
_MADDE_RE = re.compile(
    r"^[ \t]*(madde\s*\d+[\.\)]?(?:\s*[-–—].*)?)\s*$",
    re.IGNORECASE | re.MULTILINE,
)

# "1.", "12)", "3-" ile başlayan numaralı madde başlıkları (yedek).
_NUM_RE = re.compile(r"^[ \t]*(\d{1,2}[\.\)\-])\s+", re.MULTILINE)

_MIN_CLAUSES = 2


@dataclass
class Clause:
    index: int
    label: str        # "Madde 3" gibi etiket
    text: str         # maddenin tam metni (başlık dahil)
    start: int        # orijinal metindeki başlangıç ofseti
    end: int          # bitiş ofseti


def _split_by_matches(text: str, matches: list[re.Match]) -> list[Clause]:
    clauses: list[Clause] = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chunk = text[start:end].strip()
        if not chunk:
            continue
        # Etiket: ilk satırın ilk birkaç kelimesi.
        first_line = chunk.splitlines()[0].strip()
        label = first_line[:40] if first_line else f"Bölüm {i + 1}"
        clauses.append(
            Clause(index=len(clauses) + 1, label=label, text=chunk, start=start, end=end)
        )
    return clauses


def segment(text: str) -> list[Clause]:
    """Metni maddelere böler. En az 1 madde döndürür."""
    text = text or ""

    # 1) "Madde N" başlıkları
    madde_matches = list(_MADDE_RE.finditer(text))
    if len(madde_matches) >= _MIN_CLAUSES:
        return _split_by_matches(text, madde_matches)

    # 2) Numaralı maddeler
    num_matches = list(_NUM_RE.finditer(text))
    if len(num_matches) >= _MIN_CLAUSES:
        return _split_by_matches(text, num_matches)

    # 3) Yedek: çift satır boşluğuyla paragraflara böl
    clauses: list[Clause] = []
    pos = 0
    for para in re.split(r"\n\s*\n", text):
        stripped = para.strip()
        if not stripped:
            pos += len(para) + 2
            continue
        start = text.find(stripped, pos)
        if start == -1:
            start = pos
        end = start + len(stripped)
        pos = end
        label = stripped.splitlines()[0][:40]
        clauses.append(
            Clause(index=len(clauses) + 1, label=label, text=stripped, start=start, end=end)
        )

    # 4) Hiç bölünemediyse tüm belgeyi tek madde say
    if not clauses and text.strip():
        clauses.append(
            Clause(index=1, label="Belge", text=text.strip(), start=0, end=len(text))
        )
    return clauses
