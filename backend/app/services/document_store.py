"""Yüklenen belgeler için basit, bellek-içi depo.

Gizlilik: belgeler diske yazılmaz, yalnızca süreç belleğinde tutulur.
Süreç yeniden başladığında temizlenir. (İleride opt-in kalıcı kayıt eklenebilir.)
"""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field


@dataclass
class StoredDocument:
    id: str
    filename: str
    text: str
    method: str
    pages: int
    ocr_used: bool
    char_count: int
    summary: str | None = field(default=None)


class DocumentStore:
    def __init__(self) -> None:
        self._docs: dict[str, StoredDocument] = {}
        self._lock = threading.Lock()

    def add(
        self, filename: str, text: str, method: str, pages: int, ocr_used: bool
    ) -> StoredDocument:
        doc_id = uuid.uuid4().hex[:12]
        doc = StoredDocument(
            id=doc_id,
            filename=filename,
            text=text,
            method=method,
            pages=pages,
            ocr_used=ocr_used,
            char_count=len(text),
        )
        with self._lock:
            self._docs[doc_id] = doc
        return doc

    def get(self, doc_id: str) -> StoredDocument | None:
        with self._lock:
            return self._docs.get(doc_id)

    def set_summary(self, doc_id: str, summary: str) -> None:
        with self._lock:
            if doc_id in self._docs:
                self._docs[doc_id].summary = summary

    def delete(self, doc_id: str) -> bool:
        with self._lock:
            return self._docs.pop(doc_id, None) is not None


document_store = DocumentStore()
