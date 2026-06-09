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
    analyzed: bool = False


class SummaryResponse(BaseModel):
    id: str
    summary: str


class ClauseRisk(BaseModel):
    index: int
    label: str
    text: str
    start: int
    end: int
    ozet: str
    risk_skoru: int
    risk_turu: str
    aciklama: str
    taraf: str


class AnalyzeResponse(BaseModel):
    id: str
    clause_count: int
    clauses: list[ClauseRisk]
