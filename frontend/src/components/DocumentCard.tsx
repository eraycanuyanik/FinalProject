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

const md = {
  h2: (p: any) => <h2 className="mb-1 mt-3 text-base font-semibold text-emerald-300" {...p} />,
  p: (p: any) => <p className="mb-2 leading-relaxed text-slate-300" {...p} />,
  ul: (p: any) => <ul className="mb-2 list-disc space-y-1 pl-5 text-slate-300" {...p} />,
  ol: (p: any) => <ol className="mb-2 list-decimal space-y-1 pl-5 text-slate-300" {...p} />,
  li: (p: any) => <li className="leading-relaxed" {...p} />,
  strong: (p: any) => <strong className="font-semibold text-slate-100" {...p} />,
};

export default function DocumentCard({ docId, filename }: { docId: string; filename: string }) {
  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(true);
  const [clauses, setClauses] = useState<ClauseRisk[]>([]);
  const [total, setTotal] = useState(0);
  const [analyzing, setAnalyzing] = useState(true);
  const [showDoc, setShowDoc] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const startedRef = useRef(false);

  const runAnalyze = useCallback(async () => {
    setAnalyzing(true);
    const acc: ClauseRisk[] = [];
    try {
      await streamAnalyze(docId, {
        onMeta: (t) => setTotal(t),
        onClause: (c) => {
          acc.push(c);
          setClauses([...acc]);
        },
      });
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setAnalyzing(false);
    }
  }, [docId]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    getDocument(docId)
      .then(async (d) => {
        setDoc(d);
        // Önce hızlı özet, sonra maddeler tek tek akarak işaretlenir.
        try {
          setSummary(d.summary ?? (await summarizeDocument(docId)));
        } catch (e) {
          setErr(String(e instanceof Error ? e.message : e));
        } finally {
          setSummarizing(false);
        }
        runAnalyze();
      })
      .catch((e) => {
        setErr(String(e instanceof Error ? e.message : e));
        setSummarizing(false);
        setAnalyzing(false);
      });
  }, [docId, runAnalyze]);

  const risky = clauses
    .filter((c) => c.risk_skoru >= 21)
    .sort((a, b) => b.risk_skoru - a.risk_skoru);
  const pct = total ? Math.round((clauses.length / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-left text-sm">
      <div className="mb-3 flex items-center gap-2 text-slate-300">
        <span className="text-lg">📄</span>
        <span className="font-medium">{filename}</span>
        {doc && (
          <span className="ml-auto text-xs text-slate-500">
            {doc.pages > 0 ? `${doc.pages} sayfa · ` : ""}
            {doc.method}
            {doc.ocr_used ? " · OCR" : ""} · {doc.jurisdiction.toUpperCase()}
          </span>
        )}
      </div>

      {err && <p className="mb-3 rounded-md bg-rose-500/10 p-2 text-rose-300">{err}</p>}

      {/* Özet */}
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Sade Özet
      </div>
      {summarizing ? (
        <p className="text-slate-400">Belge okunuyor ve özetleniyor… (lokal model)</p>
      ) : (
        summary && (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
            {summary}
          </ReactMarkdown>
        )
      )}

      {/* Risk analizi — maddeler tek tek akar */}
      <div className="mt-4 border-t border-slate-800 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Riskli Maddeler{clauses.length > 0 && ` (${risky.length}/${clauses.length})`}
          </span>
          {clauses.length > 0 && doc && (
            <button
              onClick={() => setShowDoc((v) => !v)}
              className="text-xs text-emerald-400 hover:underline"
            >
              {showDoc ? "Belgeyi gizle" : "Belgeyi madde madde gör"}
            </button>
          )}
        </div>

        {analyzing && (
          <div className="mb-3">
            <div className="mb-1 text-xs text-slate-400">
              Maddeler tek tek inceleniyor… {total > 0 && `${clauses.length}/${total}`}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct || 8}%` }} />
            </div>
          </div>
        )}

        {clauses.length > 0 && (
          <ul className="space-y-1.5">
            {risky.map((c) => {
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
        )}
        {!analyzing && clauses.length > 0 && risky.length === 0 && (
          <p className="text-xs text-emerald-300">Belirgin bir riskli madde bulunamadı.</p>
        )}
      </div>

      {/* Renkli, madde-madde belge görünümü */}
      {showDoc && clauses.length > 0 && doc && (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Belge — riskli maddeler işaretli{" "}
            <span className="font-normal normal-case text-slate-600">(üzerine gel → açıklama)</span>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-800 p-2">
            <RiskHighlighter text={doc.text} clauses={clauses} />
          </div>
        </div>
      )}
    </div>
  );
}
