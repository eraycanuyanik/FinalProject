"""Uygulama ayarları — ortam değişkenlerinden okunur (12-factor)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # LLM (host üzerindeki LM Studio, OpenAI uyumlu API)
    llm_base_url: str = "http://host.docker.internal:1234/v1"
    llm_api_key: str = "lm-studio"
    llm_model: str = "google/gemma-4-e4b"
    llm_request_timeout: float = 120.0

    # Embeddings
    embedding_model: str = "intfloat/multilingual-e5-large"

    # ChromaDB
    chroma_host: str = "chromadb"
    chroma_port: int = 8000

    # CORS — virgülle ayrılmış origin listesi
    cors_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
