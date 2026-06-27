export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type UploadResponse = {
  id: string;
  filename: string;
  method: string;
  pages: number;
  ocr_used: boolean;
  char_count: number;
  text_preview: string;
};

export type DocumentResponse = {
  id: string;
  filename: string;
  method: string;
  pages: number;
  ocr_used: boolean;
  char_count: number;
  jurisdiction: string;
  text: string;
  summary: string | null;
  analyzed: boolean;
};

export type LawReference = {
  kanun_adi: string;
  kanun_no: number | string;
  madde_no: string;
  snippet: string;
  distance: number;
};

export type ClauseRisk = {
  index: number;
  label: string;
  text: string;
  start: number;
  end: number;
  ozet: string;
  risk_skoru: number;
  risk_turu: string;
  aciklama: string;
  taraf: string;
  references: LawReference[];
};

export type AnalyzeResponse = {
  id: string;
  clause_count: number;
  clauses: ClauseRisk[];
};

export type Jurisdiction = "tr" | "us";

export async function uploadDocument(
  file: File,
  jurisdiction: Jurisdiction = "tr",
  user = "misafir"
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("jurisdiction", jurisdiction);
  form.append("user", user || "misafir");
  const res = await fetch(`${API_URL}/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getDocument(id: string): Promise<DocumentResponse> {
  const res = await fetch(`${API_URL}/documents/${id}`);
  if (!res.ok) throw new Error(`Belge bulunamadı (HTTP ${res.status})`);
  return res.json();
}

export async function summarizeDocument(id: string): Promise<string> {
  const res = await fetch(`${API_URL}/documents/${id}/summarize`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.summary as string;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatResponse = {
  answer: string;
  references: LawReference[];
};

export async function sendChat(params: {
  message: string;
  history: ChatMessage[];
  docId?: string;
  jurisdiction?: Jurisdiction;
  user?: string;
}): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: params.message,
      history: params.history,
      doc_id: params.docId,
      jurisdiction: params.jurisdiction ?? "tr",
      user: params.user || "misafir",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function streamAnalyze(
  docId: string,
  handlers: {
    onMeta?: (total: number) => void;
    onClause?: (clause: ClauseRisk) => void;
    onDone?: () => void;
  }
): Promise<void> {
  const res = await fetch(`${API_URL}/documents/${docId}/analyze/stream`, {
    method: "POST",
  });
  if (!res.ok || !res.body) {
    throw new Error(`Analiz başlatılamadı (HTTP ${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.type === "meta") handlers.onMeta?.(ev.total);
      else if (ev.type === "clause") handlers.onClause?.(ev.clause);
      else if (ev.type === "done") handlers.onDone?.();
      else if (ev.type === "error") throw new Error(ev.detail || "Analiz hatası");
    }
  }
}

export async function analyzeDocument(id: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_URL}/documents/${id}/analyze`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
