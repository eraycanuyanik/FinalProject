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
