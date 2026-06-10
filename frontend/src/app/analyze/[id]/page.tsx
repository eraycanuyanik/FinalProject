"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AnalyzeResponse,
  ClauseRisk,
  DocumentResponse,
  analyzeDocument,
  getDocument,
  summarizeDocument,
} from "@/lib/api";
import RiskHighlighter, { riskColor } from "@/components/RiskHighlighter";
import ChatPanel from "@/components/ChatPanel";

const md = {
  h2: (p: any) => <h2 className="mt-5 mb-2 text-lg font-semibold text-emerald-300" {...p} />,
  p: (p: any) => <p className="mb-3 leading-relaxed text-slate-300" {...p} />,
  ul: (p: any) => <ul className="mb-3 list-disc space-y-1 pl-5 text-slate-300" {...p} />,
  ol: (p: any) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-slate-300" {...p} />,
  li: (p: any) => <li className="leading-relaxed" {...p} />,
  strong: (p: any) => <strong className="font-semibold text-slate-100" {...p} />,
};

export default function AnalyzePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [clauses, setClauses] = useState<ClauseRisk[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const runAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res: AnalyzeResponse = await analyzeDocument(id);
      setClauses(res.clauses);
    } catch (e) {
      setAnalyzeError(String(e instanceof Error ? e.message : e));
    } finally {
      setAnalyzing(false);
    }
  }, [id]);

  const runSummary = useCallback(async () => {
    setSummarizing(true);
    setSummaryError(null);
    try {
      setSummary(await summarizeDocument(id));
    } catch (e) {
      setSummaryError(String(e instanceof Error ? e.message : e));
    } finally {
      setSummarizing(false);
    }
  }, [id]);

  useEffect(() => {
    getDocument(id)
      .then((d) => {
        setDoc(d);
        if (d.summary) setSummary(d.summary);
        runAnalyze();
      })
      .catch((e) => setError(String(e instanceof Error ? e.message : e)));
  }, [id, runAnalyze]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-rose-300">{error}</p>
        <Link href="/" className="mt-4 inline-block text-emerald-400 hover:underline">
          ← Yeni belge yükle
        </Link>
      </main>
    );
  }

  const risky = (clauses ?? [])
    .filter((c) => c.risk_skoru >= 21)
    .sort((a, b) => b.risk_skoru - a.risk_skoru);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-emerald-400 hover:underline">
            ← Yeni belge
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{doc?.filename ?? "Belge"}</h1>
        </div>
        {doc && (
          <div className="text-xs text-slate-500">
            {doc.char_count.toLocaleString("tr-TR")} karakter · yöntem: {doc.method}
            {doc.pages > 0 && ` · ${doc.pages} sayfa`}
            {doc.ocr_used && " · OCR"}
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Sol: highlight'lı belge */}
        <section className="rounded-xl border border-slate-700 bg-slate-900/50">
          <header className="border-b border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300">
            Belge — riskli maddeler işaretli{" "}
            <span className="font-normal text-slate-500">(üzerine gel → açıklama)</span>
          </header>
          <div className="max-h-[78vh] overflow-auto p-3">
            {analyzing && (
              <p className="px-3 py-2 text-slate-400">
                Maddeler analiz ediliyor… Her madde lokal yapay zekayla
                değerlendiriliyor, bu birkaç dakika sürebilir.
              </p>
            )}
            {analyzeError && (
              <p className="m-3 rounded-md bg-rose-500/10 p-3 text-rose-300">
                {analyzeError}
                <button onClick={runAnalyze} className="ml-2 underline">
                  Tekrar dene
                </button>
              </p>
            )}
            {!analyzing && clauses && doc && (
              <RiskHighlighter text={doc.text} clauses={clauses} />
            )}
          </div>
        </section>

        {/* Sağ: riskli maddeler listesi + özet */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-700 bg-slate-900/50">
            <header className="border-b border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300">
              Riskli Maddeler{" "}
              {clauses && (
                <span className="font-normal text-slate-500">
                  ({risky.length}/{clauses.length})
                </span>
              )}
            </header>
            <div className="max-h-[40vh] overflow-auto p-3">
              {!clauses && !analyzeError && (
                <p className="px-2 py-1 text-sm text-slate-500">Hesaplanıyor…</p>
              )}
              {clauses && risky.length === 0 && (
                <p className="px-2 py-1 text-sm text-emerald-300">
                  Belirgin bir riskli madde bulunamadı.
                </p>
              )}
              <ul className="space-y-2">
                {risky.map((c) => {
                  const col = riskColor(c.risk_skoru);
                  return (
                    <li key={c.index}>
                      <a
                        href={`#clause-${c.index}`}
                        className="block rounded-md border border-slate-700 px-3 py-2 hover:border-slate-500"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-200">
                            {c.label}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold text-slate-950 ${col.dot}`}
                          >
                            {c.risk_skoru}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{c.risk_turu}</p>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-900/50">
            <header className="flex items-center justify-between border-b border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300">
              <span>Sade Özet</span>
              {!summarizing && (
                <button
                  onClick={runSummary}
                  className="rounded border border-slate-600 px-2 py-0.5 text-xs hover:bg-slate-800"
                >
                  {summary ? "Yenile" : "Özet oluştur"}
                </button>
              )}
            </header>
            <div className="max-h-[40vh] overflow-auto px-5 py-4 text-sm">
              {summarizing && (
                <p className="text-slate-400">Belge özetleniyor…</p>
              )}
              {summaryError && (
                <p className="rounded-md bg-rose-500/10 p-3 text-rose-300">{summaryError}</p>
              )}
              {!summarizing && summary && (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                  {summary}
                </ReactMarkdown>
              )}
              {!summarizing && !summary && !summaryError && (
                <p className="text-slate-500">
                  Belgenin sade bir özetini görmek için “Özet oluştur”a bas.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="mt-6">
        <ChatPanel docId={id} />
      </div>

      <p className="mt-6 text-xs text-slate-600">
        Risk skorları ve sohbet yanıtları yapay zeka tahminidir, kesin hukuki
        değerlendirme değildir.
      </p>
    </main>
  );
}
