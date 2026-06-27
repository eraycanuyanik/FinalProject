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
    jurisdiction: str = "tr"
    text_preview: str


class DocumentResponse(BaseModel):
    id: str
    filename: str
    method: str
    pages: int
    ocr_used: bool
    char_count: int
    jurisdiction: str = "tr"
    text: str
    summary: str | None = None
    analyzed: bool = False


class SummaryResponse(BaseModel):
    id: str
    summary: str


class LawReference(BaseModel):
    kanun_adi: str
    kanun_no: int | str = ""
    madde_no: str = ""
    snippet: str = ""
    distance: float = 0.0


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
    references: list[LawReference] = []


class AnalyzeResponse(BaseModel):
    id: str
    clause_count: int
    clauses: list[ClauseRisk]


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    doc_id: str | None = None
    jurisdiction: str = "tr"
    user: str = "misafir"
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    answer: str
    references: list[LawReference] = []
