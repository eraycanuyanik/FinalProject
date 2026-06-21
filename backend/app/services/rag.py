"""Çok-ülkeli hukuk RAG: ülkeye (jurisdiction) göre ayrı ChromaDB koleksiyonu.

- tr → "turk_hukuku"  (Türk mevzuatı)
- us → "us_law"       (ABD federal + eyalet hukuku)

Embedding modeli (intfloat/multilingual-e5-large) hem Türkçe hem İngilizce için
kullanılır; lokal çalışır, hf_cache volume'una indirilir. e5 "query:"/"passage:"
öneklerini ister (dilden bağımsız).
"""
from __future__ import annotations

import threading

from app.config import get_settings

COLLECTIONS = {"tr": "turk_hukuku", "us": "us_law"}
DEFAULT_JURISDICTION = "tr"

_embedder = None
_embedder_lock = threading.Lock()
_collections: dict[str, object] = {}
_chroma_lock = threading.Lock()


def normalize_jurisdiction(j: str | None) -> str:
    j = (j or "").lower().strip()
    return j if j in COLLECTIONS else DEFAULT_JURISDICTION


def get_embedder():
    """SentenceTransformer'ı tek sefer yükler (singleton)."""
    global _embedder
    if _embedder is None:
        with _embedder_lock:
            if _embedder is None:
                from sentence_transformers import SentenceTransformer

                settings = get_settings()
                _embedder = SentenceTransformer(settings.embedding_model)
    return _embedder


def embed_passages(texts: list[str]) -> list[list[float]]:
    model = get_embedder()
    prefixed = [f"passage: {t}" for t in texts]
    return model.encode(prefixed, normalize_embeddings=True, show_progress_bar=False).tolist()


def embed_query(text: str) -> list[float]:
    model = get_embedder()
    return model.encode(
        [f"query: {text}"], normalize_embeddings=True, show_progress_bar=False
    )[0].tolist()


def _client():
    import chromadb

    settings = get_settings()
    return chromadb.HttpClient(host=settings.chroma_host, port=settings.chroma_port)


def _get_collection(jurisdiction: str, create: bool = False):
    name = COLLECTIONS[normalize_jurisdiction(jurisdiction)]
    if name not in _collections:
        with _chroma_lock:
            if name not in _collections:
                client = _client()
                if create:
                    _collections[name] = client.get_or_create_collection(
                        name, metadata={"hnsw:space": "cosine"}
                    )
                else:
                    _collections[name] = client.get_collection(name)
    return _collections[name]


def get_or_create_collection(jurisdiction: str):
    return _get_collection(jurisdiction, create=True)


def retrieve(query: str, jurisdiction: str = DEFAULT_JURISDICTION, k: int = 3) -> list[dict]:
    """Sorguya en yakın k kanun maddesini döndürür. Koleksiyon yoksa boş liste."""
    try:
        collection = _get_collection(jurisdiction, create=False)
        emb = embed_query(query)
        res = collection.query(query_embeddings=[emb], n_results=k)
    except Exception:  # noqa: BLE001 — RAG yoksa analiz yine de çalışsın
        return []

    out: list[dict] = []
    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]
    for doc, meta, dist in zip(docs, metas, dists, strict=False):
        out.append(
            {
                "kanun_adi": meta.get("kanun_adi", ""),
                "kanun_no": meta.get("kanun_no", ""),
                "madde_no": meta.get("madde_no", ""),
                "snippet": (doc or "")[:400],
                "distance": float(dist),
            }
        )
    return out


def collection_count(jurisdiction: str = DEFAULT_JURISDICTION) -> int:
    try:
        return _get_collection(jurisdiction, create=False).count()
    except Exception:  # noqa: BLE001
        return 0
