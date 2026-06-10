"""Türk hukuku RAG: ChromaDB'den ilgili kanun maddelerini getirir.

Embedding modeli (intfloat/multilingual-e5-large) lokal çalışır ve hf_cache
volume'una indirilir. e5 modeli "query: " / "passage: " önekleri ister.
"""
from __future__ import annotations

import threading

from app.config import get_settings

COLLECTION_NAME = "turk_hukuku"

_embedder = None
_embedder_lock = threading.Lock()
_chroma_collection = None
_chroma_lock = threading.Lock()


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


def _get_collection(create: bool = False):
    global _chroma_collection
    if _chroma_collection is None:
        with _chroma_lock:
            if _chroma_collection is None:
                import chromadb

                settings = get_settings()
                client = chromadb.HttpClient(
                    host=settings.chroma_host, port=settings.chroma_port
                )
                if create:
                    _chroma_collection = client.get_or_create_collection(
                        COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
                    )
                else:
                    _chroma_collection = client.get_collection(COLLECTION_NAME)
    return _chroma_collection


def get_or_create_collection():
    return _get_collection(create=True)


def retrieve(query: str, k: int = 3) -> list[dict]:
    """Sorguya en yakın k kanun maddesini döndürür. Hata olursa boş liste."""
    try:
        collection = _get_collection(create=False)
        emb = embed_query(query)
        res = collection.query(query_embeddings=[emb], n_results=k)
    except Exception:  # noqa: BLE001 — RAG yoksa risk analizi yine de çalışsın
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


def collection_count() -> int:
    try:
        return _get_collection(create=False).count()
    except Exception:  # noqa: BLE001
        return 0
