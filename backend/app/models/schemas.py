"""Pydantic şemaları. Faz ilerledikçe genişleyecek."""
from pydantic import BaseModel


class ServiceStatus(BaseModel):
    ok: bool
    detail: str = ""


class HealthResponse(BaseModel):
    status: str
    llm: ServiceStatus
    chroma: ServiceStatus


class PingRequest(BaseModel):
    message: str = "Merhaba"


class PingResponse(BaseModel):
    model: str
    reply: str
