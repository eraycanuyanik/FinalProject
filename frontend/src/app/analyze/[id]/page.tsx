"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DocumentResponse,
  getDocument,
  summarizeDocument,
} from "@/lib/api";

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
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

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
        else runSummary();
      })
      .catch((e) => setError(String(e instanceof Error ? e.message : e)));
  }, [id, runSummary]);

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

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
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

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Ham metin */}
        <section className="rounded-xl border border-slate-700 bg-slate-900/50">
          <header className="border-b border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300">
            Orijinal Metin
          </header>
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-slate-300">
            {doc?.text ?? "Yükleniyor…"}
          </pre>
        </section>

        {/* Özet */}
        <section className="rounded-xl border border-slate-700 bg-slate-900/50">
          <header className="flex items-center justify-between border-b border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300">
            <span>Sade Özet</span>
            {!summarizing && (
              <button
                onClick={runSummary}
                className="rounded border border-slate-600 px-2 py-0.5 text-xs hover:bg-slate-800"
              >
                Yeniden özetle
              </button>
            )}
          </header>
          <div className="max-h-[70vh] overflow-auto px-5 py-4 text-sm">
            {summarizing && (
              <p className="text-slate-400">
                Yapay zeka belgeyi okuyup özetliyor… (model lokal çalıştığı için
                birkaç saniye sürebilir)
              </p>
            )}
            {summaryError && (
              <p className="rounded-md bg-rose-500/10 p-3 text-rose-300">
                {summaryError}
              </p>
            )}
            {!summarizing && summary && (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                {summary}
              </ReactMarkdown>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
