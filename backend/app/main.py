"""Anlattım — FastAPI giriş noktası (Faz 1: iskelet + servis sağlık kontrolü)."""
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models.schemas import (
    HealthResponse,
    PingRequest,
    PingResponse,
    ServiceStatus,
)
from app.services.llm import llm_client

settings = get_settings()

app = FastAPI(
    title="Anlattım API",
    description="Lokal Türkçe sözleşme anlatıcı — gizlilik öncelikli, %100 lokal.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Tüm bağımlı servislerin (LM Studio, ChromaDB) erişilebilirliğini raporlar."""
    # LM Studio
    try:
        models = await llm_client.list_models()
        llm_ok = settings.llm_model in models
        detail = (
            f"{len(models)} model yüklü"
            if llm_ok
            else f"'{settings.llm_model}' yüklü değil. Mevcut: {models}"
        )
        llm_status = ServiceStatus(ok=llm_ok, detail=detail)
    except Exception as exc:  # noqa: BLE001
        llm_status = ServiceStatus(ok=False, detail=f"Erişilemedi: {exc}")

    # ChromaDB
    chroma_url = f"http://{settings.chroma_host}:{settings.chroma_port}/api/v1/heartbeat"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(chroma_url)
            resp.raise_for_status()
        chroma_status = ServiceStatus(ok=True, detail="heartbeat OK")
    except Exception as exc:  # noqa: BLE001
        chroma_status = ServiceStatus(ok=False, detail=f"Erişilemedi: {exc}")

    overall = "ok" if llm_status.ok and chroma_status.ok else "degraded"
    return HealthResponse(status=overall, llm=llm_status, chroma=chroma_status)


@app.post("/llm/ping", response_model=PingResponse)
async def llm_ping(req: PingRequest) -> PingResponse:
    """LM Studio'ya basit bir Türkçe istek atıp cevabı döndürür (bağlantı testi)."""
    reply = await llm_client.chat(
        messages=[
            {
                "role": "system",
                "content": "Sen yardımsever bir asistansın. Kısa ve Türkçe yanıt ver.",
            },
            {"role": "user", "content": req.message},
        ]
    )
    return PingResponse(model=llm_client.model, reply=reply)


@app.get("/")
async def root() -> dict[str, str]:
    return {"app": "Anlattım API", "docs": "/docs", "health": "/health"}
