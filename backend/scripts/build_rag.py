"""Kanun PDF'lerini madde madde parçalar, embed eder ve ChromaDB'ye yükler.

Build sırasında BİR KERE çalıştırılır (scrape_mevzuat.py'den sonra):

    docker compose exec backend python scripts/build_rag.py

Embedding modeli ilk çalıştırmada indirilir (~2GB) ve hf_cache'e cache'lenir.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Script doğrudan çalıştırıldığında 'app' paketini bulabilsin.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.mevzuat_parser import parse_articles  # noqa: E402
from app.services.rag import embed_passages, get_or_create_collection  # noqa: E402
from scripts.scrape_mevzuat import CORPUS_DIR, KANUNLAR  # noqa: E402

BATCH = 64


def build() -> None:
    collection = get_or_create_collection()
    print(f"Koleksiyon hazır. Mevcut kayıt: {collection.count()}")

    total = 0
    for no, adi in KANUNLAR.items():
        pdf_path = CORPUS_DIR / f"{no}.pdf"
        if not pdf_path.exists():
            print(f"[atla] {pdf_path} yok — önce scrape_mevzuat.py çalıştır.")
            continue

        articles = parse_articles(pdf_path.read_bytes(), no, adi)

        # Aynı madde no birden fazla geçebilir (değişiklik notları, fihrist vb.).
        # Her id için en uzun metni tut → tekilleştir.
        by_id: dict[str, object] = {}
        for a in articles:
            key = f"{a.kanun_no}-{a.madde_no}"
            if key not in by_id or len(a.text) > len(by_id[key].text):
                by_id[key] = a
        articles = list(by_id.values())
        print(f"[{no}] {adi}: {len(articles)} benzersiz madde, embed ediliyor…")

        for i in range(0, len(articles), BATCH):
            chunk = articles[i : i + BATCH]
            embeddings = embed_passages([a.text for a in chunk])
            collection.upsert(
                ids=[f"{a.kanun_no}-{a.madde_no}" for a in chunk],
                embeddings=embeddings,
                documents=[a.text for a in chunk],
                metadatas=[
                    {
                        "kanun_no": a.kanun_no,
                        "kanun_adi": a.kanun_adi,
                        "madde_no": a.madde_no,
                    }
                    for a in chunk
                ],
            )
            print(f"   {min(i + BATCH, len(articles))}/{len(articles)}")
            total += len(chunk)

    print(f"\nTamamlandı. Toplam {total} madde indekslendi. "
          f"Koleksiyon boyutu: {collection.count()}")


if __name__ == "__main__":
    build()
