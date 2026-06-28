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
import { useT } from "@/lib/i18n";

const md = {
  h2: (p: any) => <h2 className="mb-1 mt-3 text-sm font-semibold text-emerald-700" {...p} />,
  p: (p: any) => <p className="mb-2 leading-relaxed text-slate-600" {...p} />,
  ul: (p: any) => <ul className="mb-2 list-disc space-y-1 pl-5 text-slate-600" {...p} />,
  ol: (p: any) => <ol className="mb-2 list-decimal space-y-1 pl-5 text-slate-600" {...p} />,
  li: (p: any) => <li className="leading-relaxed" {...p} />,
  strong: (p: any) => <strong className="font-semibold text-slate-900" {...p} />,
};

export default function DocumentCard({ docId, filename }: { docId: string; filename: string }) {
  const t = useT();
  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(true);
  const [clauses, setClauses] = useState<ClauseRisk[]>([]);
  const [total, setTotal] = useState(0);
  const [analyzing, setAnalyzing] = useState(true);
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

  const risky = clauses.filter((c) => c.risk_skoru >= 21).sort((a, b) => b.risk_skoru - a.risk_skoru);
  const pct = total ? Math.round((clauses.length / total) * 100) : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3">
        <span className="text-lg">📄</span>
        <span className="font-medium text-slate-800">{filename}</span>
        {doc && (
          <span className="ml-auto text-xs text-slate-500">
            {doc.pages > 0 ? `${doc.pages} ${t.pages} · ` : ""}
            {doc.method}
            {doc.ocr_used ? " · OCR" : ""} · {doc.jurisdiction.toUpperCase()}
          </span>
        )}
      </div>

      {err && <p className="m-4 rounded-md bg-rose-50 p-2 text-rose-700">{err}</p>}

      <div className="grid gap-0 lg:grid-cols-[1fr_1.1fr]">
        {/* Sol: özet + riskli maddeler */}
        <div className="border-b border-slate-100 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.summary}
          </div>
          {summarizing ? (
            <p className="text-slate-400">{t.summarizing}</p>
          ) : (
            summary && (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                {summary}
              </ReactMarkdown>
            )
          )}

          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t.riskyClauses}
              {clauses.length > 0 && ` (${risky.length}/${clauses.length})`}
            </div>
            {analyzing && (
              <div className="mb-3">
                <div className="mb-1 text-xs text-slate-500">
                  {t.reviewing} {total > 0 && `${clauses.length}/${total}`}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                    style={{ width: `${pct || 8}%` }}
                  />
                </div>
              </div>
            )}
            <ul className="space-y-1.5">
              {risky.map((c) => {
                const col = riskColor(c.risk_skoru);
                return (
                  <li
                    key={c.index}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5"
                  >
                    <div className="min-w-0">
                      <span className="text-slate-700">{c.label}</span>
                      <span className="ml-2 text-xs text-slate-400">{c.risk_turu}</span>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white ${col.dot}`}
                    >
                      {c.risk_skoru}
                    </span>
                  </li>
                );
              })}
            </ul>
            {!analyzing && clauses.length > 0 && risky.length === 0 && (
              <p className="text-xs text-emerald-600">{t.noRisky}</p>
            )}
          </div>
        </div>

        {/* Sağ: renkli madde-madde belge */}
        <div className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.docHeading}{" "}
            <span className="font-normal normal-case text-slate-400">{t.hoverHint}</span>
          </div>
          {clauses.length === 0 ? (
            <p className="text-slate-400">{analyzing ? t.firstClauses : "—"}</p>
          ) : (
            doc && (
              <div className="max-h-[64vh] overflow-auto rounded-lg border border-slate-100 bg-slate-50/50 p-2">
                <RiskHighlighter text={doc.text} clauses={clauses} />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
