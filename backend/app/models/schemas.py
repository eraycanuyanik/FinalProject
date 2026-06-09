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


class UploadResponse(BaseModel):
    id: str
    filename: str
    method: str
    pages: int
    ocr_used: bool
    char_count: int
    text_preview: str


class DocumentResponse(BaseModel):
    id: str
    filename: str
    method: str
    pages: int
    ocr_used: bool
    char_count: int
    text: str
    summary: str | None = None


class SummaryResponse(BaseModel):
    id: str
    summary: str
