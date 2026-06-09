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

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
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
