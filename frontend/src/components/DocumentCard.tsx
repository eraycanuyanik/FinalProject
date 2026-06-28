"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ClauseRisk,
  DocumentResponse,
  getDocument,
  streamAnalyze,
  summarizeDocument,
} from "@/lib/api";
import RiskHighlighter, { riskColor } from "@/components/RiskHighlighter";

export default function DocumentCard({
  docId,
  filename,
}: {
  docId: string;
  filename: string;
}) {
  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(true);
  const [clauses, setClauses] = useState<ClauseRisk[] | null>(null);
  const [total, setTotal] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [expand, setExpand] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    getDocument(docId)
      .then(async (d) => {
        setDoc(d);
        try {
          setSummary(d.summary ?? (await summarizeDocument(docId)));
        } catch (e) {
          setErr(String(e instanceof Error ? e.message : e));
        } finally {
          setSummarizing(false);
        }
      })
      .catch((e) => {
        setErr(String(e instanceof Error ? e.message : e));
        setSummarizing(false);
      });
  }, [docId]);

  const runAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setClauses([]);
    setTotal(0);
    const acc: ClauseRisk[] = [];
    try {
      await streamAnalyze(docId, {
        onMeta: (t) => setTotal(t),
        onClause: (c) => {
          acc.push(c);
          setClauses([...acc]);
        },
      });
      setExpand(true);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setAnalyzing(false);
    }
  }, [docId]);

  const risky = (clauses ?? [])
    .filter((c) => c.risk_skoru >= 21)
    .sort((a, b) => b.risk_skoru - a.risk_skoru);

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-left text-sm">
      <div className="mb-2 flex items-center gap-2 text-slate-300">
        <span>📄</span>
        <span className="font-medium">{filename}</span>
        {doc && (
          <span className="ml-auto text-xs text-slate-500">
            {doc.pages > 0 ? `${doc.pages} sayfa · ` : ""}
            {doc.method}
            {doc.ocr_used ? " · OCR" : ""} · {doc.jurisdiction.toUpperCase()}
          </span>
        )}
      </div>

      {err && <p className="rounded-md bg-rose-500/10 p-2 text-rose-300">{err}</p>}

      {summarizing ? (
        <p className="text-slate-400">Belge okunuyor ve özetleniyor… (lokal model)</p>
      ) : (
        summary && (
          <div className="prose-invert max-w-none text-slate-300 [&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-emerald-300 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
          </div>
        )
      )}

      {/* Risk analizi — isteğe bağlı (ağır işlem) */}
      <div className="mt-3 border-t border-slate-800 pt-3">
        {!clauses && !analyzing && (
          <button
            onClick={runAnalyze}
            className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Maddeleri tek tek risk analizinden geçir
          </button>
        )}

        {analyzing && (
          <div>
            <div className="mb-1 text-xs text-slate-400">
              Risk analizi… {total > 0 && `${clauses?.length ?? 0}/${total}`}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: total ? `${((clauses?.length ?? 0) / total) * 100}%` : "8%" }}
              />
            </div>
          </div>
        )}

        {clauses && clauses.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Riskli maddeler ({risky.length}/{clauses.length})
              </span>
              {doc && (
                <button
                  onClick={() => setExpand((v) => !v)}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  {expand ? "Belgeyi gizle" : "Belgeyi madde madde gör"}
                </button>
              )}
            </div>
            {risky.length === 0 && !analyzing && (
              <p className="text-xs text-emerald-300">Belirgin bir riskli madde bulunamadı.</p>
            )}
            <ul className="space-y-1.5">
              {risky.slice(0, 6).map((c) => {
                const col = riskColor(c.risk_skoru);
                return (
                  <li
                    key={c.index}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-800 px-2.5 py-1.5"
                  >
                    <div className="min-w-0">
                      <span className="text-slate-200">{c.label}</span>
                      <span className="ml-2 text-xs text-slate-500">{c.risk_turu}</span>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-slate-950 ${col.dot}`}
                    >
                      {c.risk_skoru}
                    </span>
                  </li>
                );
              })}
            </ul>

            {expand && doc && (
              <div className="mt-3 max-h-[60vh] overflow-auto rounded-lg border border-slate-800 p-2">
                <RiskHighlighter text={doc.text} clauses={clauses} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
