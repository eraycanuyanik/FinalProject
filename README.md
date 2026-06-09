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
| LLM (lokal) | LM Studio + `qwen2.5-coder-7b-instruct-mlx` (varsayılan) |
| Embeddings | `sentence-transformers` + `intfloat/multilingual-e5-large` |
| Vector DB | ChromaDB (persist) |
| Backend | Python 3.11 + FastAPI |
| Frontend | Next.js 14 (App Router) + Tailwind |
| Container | Docker + docker-compose |

### Modeller neden bu?
- **qwen2.5-coder-7b (varsayılan)**: MLX hızlandırmalı, akıl yürütme (reasoning)
  üretmediği için hızlı (~45-78 sn) ve Türkçe özetlemede temiz/doğru sonuç verir.
- **google/gemma-4-e4b (alternatif)**: Türkçesi biraz daha doğal ama akıl yürütme
  token'ları nedeniyle ~2x yavaş (~150 sn). `.env` içinde `LLM_MODEL` ile geçilebilir.
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
2. **LM Studio** kurulu; içinde `qwen2.5-coder-7b-instruct-mlx` modeli indirilmiş ve
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

### RAG korpusunu oluşturma (Türk hukuku referansları — bir kerelik)
Risk analizinin ilgili kanun maddelerine atıf yapabilmesi için mevzuat korpusunu
indekslemek gerekir. Servisler ayaktayken:
```bash
# 1) Kanun PDF'lerini mevzuat.gov.tr'den indir (TBK, İş K., Tüketici K.)
docker compose exec backend python scripts/scrape_mevzuat.py

# 2) Maddelere böl, embed et, ChromaDB'ye yükle (embedding modeli ilk seferde ~2GB iner)
docker compose exec backend python scripts/build_rag.py

# 3) Kaç madde indekslendiğini kontrol et
curl http://localhost:8000/rag/status
```
> Bu adım internet gerektirir (sadece korpus indirme + embedding modeli). İndeksleme
> bittikten sonra uygulama tamamen offline çalışır; korpus `data/chroma`'da kalıcıdır.

---

## Geliştirme Yol Haritası (Fazlar)

- [x] **Faz 1 — İskelet:** docker-compose, `/health`, LM Studio bağlantı testi, boş UI.
- [x] **Faz 2 — Belge işleme:** PDF/DOCX/TXT yükleme (drag-drop), metin çıkarma
      (OCR fallback ile), tek-prompt özetleme, "ham metin | özet" görüntüleyici.
- [x] **Faz 3 — Risk pipeline:** madde segmentasyonu (regex + paragraf fallback),
      madde başına yapısal risk skoru/türü/açıklaması (JSON schema), belgede renk
      kodlu highlight + hover açıklama balonu, riskli maddeler listesi.
- [x] **Faz 4 — RAG:** mevzuat.gov.tr konsolide PDF'leri (TBK/İş/Tüketici) → madde
      bazlı parçalama → e5-large embedding → ChromaDB (876 madde). Risk analizinde
      her maddeye ilgili kanun maddesi referansı eklenir.
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

### Sorun giderme
- **Frontend "Module not found" hatası (bağımlılık ekledikten sonra):** Next.js
  `node_modules` anonim bir volume'da tutulur ve image yeniden build edilse de eski
  kalabilir. Çözüm:
  ```bash
  docker compose up -d --build --renew-anon-volumes frontend
  ```
- **Özetleme zaman aşımına uğruyor:** Çok büyük/yavaş bir model kullanıyorsanız
  `.env` içindeki `LLM_REQUEST_TIMEOUT` değerini artırın ya da daha hızlı bir modele
  (`qwen2.5-coder-7b-instruct-mlx`) geçin.

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
