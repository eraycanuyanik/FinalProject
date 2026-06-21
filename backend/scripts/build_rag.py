"""Hukuk korpusunu embed edip ChromaDB'ye yükler (ülkeye göre).

    docker compose exec backend python scripts/build_rag.py tr   # Türk mevzuatı (PDF)
    docker compose exec backend python scripts/build_rag.py us   # ABD (articles.json)

Embedding modeli ilk çalıştırmada indirilir (~2GB) ve hf_cache'e cache'lenir.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.mevzuat_parser import parse_articles  # noqa: E402
from app.services.rag import embed_passages, get_or_create_collection  # noqa: E402
from scripts.scrape_mevzuat import CORPUS_DIR, KANUNLAR  # noqa: E402

BATCH = 64
US_FILE = Path("/data/corpus/us/articles.json")


def _load_tr() -> list[dict]:
    """Türk kanun PDF'lerini madde madde parçalar."""
    items: list[dict] = []
    for no, adi in KANUNLAR.items():
        pdf = CORPUS_DIR / f"{no}.pdf"
        if not pdf.exists():
            print(f"[atla] {pdf} yok — önce scrape_mevzuat.py çalıştır.")
            continue
        for a in parse_articles(pdf.read_bytes(), no, adi):
            items.append(
                {"kanun_adi": a.kanun_adi, "kanun_no": a.kanun_no,
                 "madde_no": a.madde_no, "text": a.text}
            )
    return items


def _load_us() -> list[dict]:
    if not US_FILE.exists():
        print(f"[atla] {US_FILE} yok — önce scrape_us_law.py çalıştır.")
        return []
    return json.loads(US_FILE.read_text())


def build(jurisdiction: str) -> None:
    items = _load_tr() if jurisdiction == "tr" else _load_us()
    if not items:
        print("İndekslenecek madde yok.")
        return

    # id tekilleştir (aynı madde no birden fazla geçebilir → en uzun metni tut).
    by_id: dict[str, dict] = {}
    for a in items:
        key = f"{a['kanun_no']}-{a['madde_no']}"
        if key not in by_id or len(a["text"]) > len(by_id[key]["text"]):
            by_id[key] = a
    items = list(by_id.values())

    collection = get_or_create_collection(jurisdiction)
    print(f"[{jurisdiction}] {len(items)} benzersiz madde, embed ediliyor "
          f"(mevcut koleksiyon: {collection.count()})…")

    for i in range(0, len(items), BATCH):
        chunk = items[i : i + BATCH]
        embeddings = embed_passages([a["text"] for a in chunk])
        collection.upsert(
            ids=[f"{a['kanun_no']}-{a['madde_no']}" for a in chunk],
            embeddings=embeddings,
            documents=[a["text"] for a in chunk],
            metadatas=[
                {"kanun_no": a["kanun_no"], "kanun_adi": a["kanun_adi"],
                 "madde_no": a["madde_no"]}
                for a in chunk
            ],
        )
        print(f"   {min(i + BATCH, len(items))}/{len(items)}")

    print(f"\nTamamlandı. Koleksiyon boyutu: {collection.count()}")


if __name__ == "__main__":
    juris = sys.argv[1].lower() if len(sys.argv) > 1 else "tr"
    if juris not in ("tr", "us"):
        print("Kullanım: build_rag.py [tr|us]")
        sys.exit(1)
    build(juris)
