"""mevzuat.gov.tr'den ilgili kanunların resmi konsolide PDF'lerini indirir.

Saygılı indirme: küçük sabit liste, sıralı, istekler arası bekleme, cache
(zaten indirilmişse atlar). Build sırasında BİR KERE çalıştırılır:

    docker compose exec backend python scripts/scrape_mevzuat.py

PDF'ler /data/corpus altına kaydedilir (volume).
"""
from __future__ import annotations

import time
from pathlib import Path

import httpx

CORPUS_DIR = Path("/data/corpus")

# Sözleşme analizinde en çok geçen kanunlar.
KANUNLAR: dict[int, str] = {
    6098: "Türk Borçlar Kanunu",
    4857: "İş Kanunu",
    6502: "Tüketicinin Korunması Hakkında Kanun",
}

URL_TMPL = "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.{no}.pdf"
HEADERS = {"User-Agent": "Anlattim/0.1 (egitim amacli; saygili indirme)"}
DELAY_SECONDS = 3.0


def download_all() -> list[Path]:
    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    for no, adi in KANUNLAR.items():
        dest = CORPUS_DIR / f"{no}.pdf"
        if dest.exists() and dest.stat().st_size > 10_000:
            print(f"[cache] {no} {adi} zaten var ({dest.stat().st_size} B), atlanıyor.")
            saved.append(dest)
            continue

        url = URL_TMPL.format(no=no)
        print(f"[indir] {no} {adi} <- {url}")
        with httpx.Client(headers=HEADERS, timeout=60.0, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
        print(f"        kaydedildi: {dest} ({len(resp.content)} B)")
        saved.append(dest)
        time.sleep(DELAY_SECONDS)  # saygılı bekleme

    return saved


if __name__ == "__main__":
    files = download_all()
    print(f"\nToplam {len(files)} kanun PDF'i hazır: {[f.name for f in files]}")
