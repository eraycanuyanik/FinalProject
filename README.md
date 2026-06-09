# Anlattım 📄⚖️

**Türkçe sözleşmelerini sade dille anlatan, %100 lokal çalışan yapay zeka asistanı.**

Avukatı olmayan bireyler ve küçük işletmeler için: kira, iş, hizmet sözleşmesi veya
kullanım koşulları yükleyin; Anlattım belgeyi sade Türkçeyle özetler, aleyhinize olan
riskli maddeleri işaretler ve Türk mevzuatına (TBK, İş Kanunu, Tüketici Kanunu)
referansla uyarır.

> 🔒 **Gizlilik birinci kural:** Hiçbir belge dış bir API'ye gönderilmez. Tüm yapay
> zeka çıkarımı bilgisayarınızda, lokal olarak çalışır.

---

## Mimari

```
[Next.js UI :3000]  ⇄  [FastAPI backend :8000]  ⇄  [LM Studio :1234 (HOST)]
                              ⇅
                      [ChromaDB :8001 (Türk hukuku RAG)]
```

- **LLM** host üzerinde çalışan **LM Studio**'dur (OpenAI uyumlu API). Container'lar
  ona `host.docker.internal:1234` üzerinden erişir — Ollama kullanılmaz.
- Backend, frontend ve ChromaDB `docker compose` ile ayağa kalkar.
- İlk build sonrası **internet gerekmez**.

| Katman | Teknoloji |
|--------|-----------|
| LLM (lokal) | LM Studio + `google/gemma-4-e4b` (Türkçe için güçlü) |
| Embeddings | `sentence-transformers` + `intfloat/multilingual-e5-large` |
| Vector DB | ChromaDB (persist) |
| Backend | Python 3.11 + FastAPI |
| Frontend | Next.js 14 (App Router) + Tailwind |
| Container | Docker + docker-compose |

### Modeller neden bu?
- **gemma-4-e4b**: Türkçe metinde güçlü, 8 GB RAM'le çalışabilir, LM Studio'da hazır.
- **multilingual-e5-large**: Türkçe destekli, lokal embedding üretir; RAG kalitesi yüksek.

---

## Donanım Gereksinimi
- **En az:** 8 GB RAM (gemma-4-e4b için yeterli)
- **İdeal:** 16 GB RAM
- macOS / Linux / Windows (Docker Desktop)

---

## Kurulum & Çalıştırma

### Ön koşullar
1. **Docker Desktop** kurulu ve çalışıyor.
2. **LM Studio** kurulu; içinde `google/gemma-4-e4b` modeli indirilmiş ve
   **Local Server** başlatılmış (varsayılan port `1234`).

### Adımlar
```bash
# 1) Ortam dosyasını oluştur
cp .env.example .env

# 2) Tüm servisleri ayağa kaldır
docker compose up --build

# 3) Tarayıcıda aç
#    Frontend:  http://localhost:3000
#    API docs:  http://localhost:8000/docs
#    Health:    http://localhost:8000/health
```

Ana sayfadaki **Servis Durumu** panelinde LM Studio ve ChromaDB yeşil yanıyorsa
her şey hazır. **"Modele Merhaba de"** butonu ile LLM bağlantısını test edebilirsiniz.

---

## Geliştirme Yol Haritası (Fazlar)

- [x] **Faz 1 — İskelet:** docker-compose, `/health`, LM Studio bağlantı testi, boş UI.
- [ ] **Faz 2 — Belge işleme:** PDF/DOCX/TXT yükleme, metin çıkarma, özetleme.
- [ ] **Faz 3 — Risk pipeline:** madde segmentasyonu, risk skorlama, highlight.
- [ ] **Faz 4 — RAG:** mevzuat.gov.tr korpusu, ChromaDB, yasa referansları.
- [ ] **Faz 5 — Chat:** belge bağlamında soru-cevap.
- [ ] **Faz 6 — Polish:** hata yönetimi, responsive, demo, doğruluk ölçümü.

---

## Geliştirici Notları

```bash
# Backend testleri (container içinde)
docker compose exec backend pytest

# Sadece backend loglarını izle
docker compose logs -f backend
```

| Servis | Host portu |
|--------|-----------|
| Frontend (Next.js) | 3000 |
| Backend (FastAPI) | 8000 |
| ChromaDB | 8001 |
| LM Studio (host) | 1234 |

---

## Lisans
Eğitim amaçlı bitirme projesi. Kullanılan tüm bileşenler açık kaynak / ücretsizdir.
Yasal tavsiye değildir; çıktılar bilgilendirme amaçlıdır.
