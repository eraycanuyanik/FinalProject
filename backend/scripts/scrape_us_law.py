"""ABD hukuk korpusunu kamuya açık kaynaklardan çeker → normalize JSON.

Kaynaklar (saygılı: istekler arası bekleme, cache):
- eCFR API (ecfr.gov)  → 16 CFR (FTC tüketici) + 29 CFR (iş/FLSA) seçili parçalar
- Cornell LII          → UCC Madde 2 (Satış) anahtar bölümleri
- CA leginfo           → California Civil Code kira (residential tenancy) maddeleri

Çıktı: /data/corpus/us/articles.json  (liste: kanun_adi, kanun_no, madde_no, text)
Build sırasında BİR KERE çalıştırılır:
    docker compose exec backend python scripts/scrape_us_law.py
"""
from __future__ import annotations

import html
import json
import re
import time
from pathlib import Path

import httpx

OUT_DIR = Path("/data/corpus/us")
OUT_FILE = OUT_DIR / "articles.json"
HEADERS = {"User-Agent": "Anlattim/0.1 (egitim amacli hukuk asistani; saygili)"}
DELAY = 1.2
ECFR_DATE = "2024-01-01"

# eCFR: (title, part, insan-okunur etiket)
ECFR_PARTS = [
    (16, "429", "16 CFR — Kapıdan Satış (Cooling-Off)"),
    (16, "433", "16 CFR — Holder Rule (Tüketici Hakları)"),
    (16, "435", "16 CFR — Posta/İnternet Sipariş"),
    (16, "444", "16 CFR — Kredi Uygulamaları"),
    (16, "455", "16 CFR — İkinci El Araç"),
    (16, "700", "16 CFR — Magnuson-Moss Garanti"),
    (16, "701", "16 CFR — Garanti Açıklama"),
    (16, "703", "16 CFR — Garanti Uyuşmazlık"),
    (29, "531", "29 CFR — Ücret Ödemeleri (FLSA)"),
    (29, "541", "29 CFR — Fazla Mesai Muafiyetleri"),
    (29, "778", "29 CFR — Fazla Mesai Ücreti"),
    (29, "785", "29 CFR — Çalışılan Saatler"),
    (29, "825", "29 CFR — FMLA (İzin)"),
]

# UCC Madde 2 (Satış) — sözleşme hukuku açısından en önemli bölümler
UCC2_SECTIONS = [
    "2-201", "2-202", "2-204", "2-206", "2-207", "2-209", "2-302",
    "2-313", "2-314", "2-315", "2-316", "2-601", "2-606", "2-608",
    "2-711", "2-714", "2-715", "2-718", "2-719", "2-725",
]

# California Civil Code — konut kirası anahtar maddeler
CA_CIVIL_SECTIONS = [
    "1940", "1941", "1941.1", "1942", "1942.5", "1946", "1946.2",
    "1947", "1950.5", "1954",
]


def _client() -> httpx.Client:
    return httpx.Client(headers=HEADERS, timeout=45.0, follow_redirects=True)


def _clean(text: str) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text).strip()


def fetch_ecfr() -> list[dict]:
    out: list[dict] = []
    with _client() as client:
        for title, part, label in ECFR_PARTS:
            url = f"https://www.ecfr.gov/api/versioner/v1/full/{ECFR_DATE}/title-{title}.xml?part={part}"
            try:
                xml = client.get(url).text
            except Exception as exc:  # noqa: BLE001
                print(f"  [eCFR atla] {label}: {exc}")
                continue
            for m in re.finditer(r'<DIV8[^>]*N="([^"]+)"[^>]*>(.*?)</DIV8>', xml, re.S):
                sec_no, block = m.group(1), m.group(2)
                body = _clean(block)
                if len(body) < 40:
                    continue
                out.append(
                    {
                        "kanun_adi": label,
                        "kanun_no": f"{title} CFR",
                        "madde_no": sec_no,
                        "text": body[:3000],
                    }
                )
            print(f"  [eCFR] {label}: toplam {len(out)} bölüm (kümülatif)")
            time.sleep(DELAY)
    return out


def _extract_main(htmltext: str, container_patterns: list[str]) -> str:
    """Sayfa süslerini (nav/footer) atıp ana içerik bloğunu döndürür."""
    htmltext = re.sub(r"<(script|style|nav|header|footer)[^>]*>.*?</\1>", " ", htmltext, flags=re.S)
    for pat in container_patterns:
        m = re.search(pat, htmltext, re.S)
        if m:
            return _clean(m.group(1))
    return ""


def fetch_ucc2() -> list[dict]:
    out: list[dict] = []
    with _client() as client:
        for sec in UCC2_SECTIONS:
            url = f"https://www.law.cornell.edu/ucc/2/{sec}"
            try:
                h = client.get(url).text
            except Exception as exc:  # noqa: BLE001
                print(f"  [UCC atla] {sec}: {exc}")
                continue
            title_m = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
            heading = _clean(title_m.group(1)) if title_m else f"UCC § {sec}"
            body = _extract_main(
                h,
                [
                    r'<div[^>]*class="[^"]*field--name-body[^"]*"[^>]*>(.*?)</div>\s*</div>',
                    r'<div[^>]*id="[^"]*node-document[^"]*"[^>]*>(.*?)</div>\s*</div>',
                    r'<article[^>]*>(.*?)</article>',
                ],
            )
            if len(body) < 60:
                print(f"  [UCC zayıf] {sec}: içerik çıkmadı, atlandı")
                continue
            out.append(
                {
                    "kanun_adi": "UCC Madde 2 (Mal Satışı)",
                    "kanun_no": "UCC",
                    "madde_no": sec,
                    "text": f"{heading}. {body}"[:3000],
                }
            )
            time.sleep(DELAY)
    print(f"  [UCC] {len(out)} bölüm")
    return out


def fetch_ca_civil() -> list[dict]:
    out: list[dict] = []
    with _client() as client:
        for sec in CA_CIVIL_SECTIONS:
            url = (
                "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml"
                f"?lawCode=CIV&sectionNum={sec}"
            )
            try:
                h = client.get(url).text
            except Exception as exc:  # noqa: BLE001
                print(f"  [CA atla] {sec}: {exc}")
                continue
            body = _extract_main(
                h,
                [
                    r'<div[^>]*id="codeLawSectionNoHead"[^>]*>(.*?)</div>\s*</div>',
                    r'<div[^>]*id="codeLawSectionNoHead"[^>]*>(.*?)</form>',
                ],
            )
            if len(body) < 60:
                print(f"  [CA zayıf] {sec}: içerik çıkmadı, atlandı")
                continue
            out.append(
                {
                    "kanun_adi": "California Civil Code (Konut Kirası)",
                    "kanun_no": "CA Civil",
                    "madde_no": sec,
                    "text": body[:3000],
                }
            )
            time.sleep(DELAY)
    print(f"  [CA] {len(out)} bölüm")
    return out


def build() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUT_FILE.exists():
        existing = json.loads(OUT_FILE.read_text())
        print(f"[cache] {OUT_FILE} zaten var ({len(existing)} madde). Yeniden çekmek için silin.")
        return

    articles: list[dict] = []
    print("eCFR çekiliyor (federal — tüketici + iş)…")
    articles += fetch_ecfr()
    print("UCC Madde 2 çekiliyor (Cornell LII)…")
    articles += fetch_ucc2()
    print("California Civil Code çekiliyor (leginfo)…")
    articles += fetch_ca_civil()

    OUT_FILE.write_text(json.dumps(articles, ensure_ascii=False, indent=1))
    print(f"\nToplam {len(articles)} ABD maddesi → {OUT_FILE}")


if __name__ == "__main__":
    build()
