"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChatMessage,
  Jurisdiction,
  LawReference,
  sendChat,
  uploadDocument,
} from "@/lib/api";
import { JURISDICTIONS, useJurisdiction } from "@/lib/jurisdiction";
import CountrySwitch from "@/components/CountrySwitch";
import HealthBadge from "@/components/HealthBadge";

const COPY: Record<
  Jurisdiction,
  { greeting: string; subtitle: string; placeholder: string; chips: string[]; refs: string }
> = {
  tr: {
    greeting: "Hukuki sorununu anlat",
    subtitle:
      "Türk mevzuatına dayalı yanıt veririm. İstersen bir sözleşme yükle, riskli maddeleri işaretleyeyim.",
    placeholder: "Sorunu yaz ya da bir sözleşme yükle…",
    chips: [
      "Ev sahibi kiramı ne kadar artırabilir?",
      "İstifa edersem kıdem tazminatı alır mıyım?",
      "İnternetten aldığım üründe cayma hakkım var mı?",
    ],
    refs: "İlgili mevzuat",
  },
  us: {
    greeting: "Describe your legal question",
    subtitle:
      "I answer based on U.S. law. You can also upload a contract and I'll flag risky clauses.",
    placeholder: "Ask a question or upload a contract…",
    chips: [
      "Can my landlord keep my security deposit?",
      "Am I entitled to overtime pay?",
      "What is an implied warranty of merchantability?",
    ],
    refs: "Relevant law",
  },
};

type Turn = ChatMessage & { references?: LawReference[] };

export default function Home() {
  const router = useRouter();
  const [jurisdiction, setJurisdiction] = useJurisdiction();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const copy = COPY[jurisdiction];

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");
    const history: ChatMessage[] = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((p) => [...p, { role: "user", content: q }]);
    setBusy(true);
    try {
      const res = await sendChat({ message: q, history, jurisdiction });
      setTurns((p) => [
        ...p,
        { role: "assistant", content: res.answer, references: res.references },
      ]);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 50);
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const res = await uploadDocument(file, jurisdiction);
      router.push(`/analyze/${res.id}`);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setUploading(false);
    }
  }

  const started = turns.length > 0;

  return (
    <main
      className="mx-auto flex min-h-screen max-w-3xl flex-col px-4"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
    >
      <header className="flex items-center justify-between py-4">
        <button
          onClick={() => setTurns([])}
          className="flex items-center gap-2 text-lg font-semibold"
          title="Yeni sohbet"
        >
          <span className="text-emerald-400">⚖</span> Anlattım
        </button>
        <div className="flex items-center gap-3">
          <CountrySwitch value={jurisdiction} onChange={setJurisdiction} />
          {started && (
            <button
              onClick={() => setTurns([])}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              + Yeni
            </button>
          )}
        </div>
      </header>

      {/* Sohbet alanı */}
      <div ref={scrollRef} className="flex-1 overflow-auto py-4">
        {!started ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
              💬
            </div>
            <h1 className="text-2xl font-bold">{copy.greeting}</h1>
            <p className="mt-2 max-w-md text-sm text-slate-400">{copy.subtitle}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {copy.chips.map((c) => (
                <button
                  key={c}
                  onClick={() => ask(c)}
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {turns.map((t, i) => (
              <div key={i} className={t.role === "user" ? "text-right" : ""}>
                <div
                  className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    t.role === "user"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800 text-slate-200"
                  }`}
                >
                  {t.role === "assistant" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.content}</ReactMarkdown>
                  ) : (
                    t.content
                  )}
                </div>
                {t.role === "assistant" && t.references && t.references.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="text-xs text-slate-500">{copy.refs}:</span>
                    {t.references.slice(0, 4).map((r, j) => (
                      <span
                        key={j}
                        title={r.snippet}
                        className="cursor-help rounded bg-slate-800 px-1.5 py-0.5 text-xs text-emerald-300"
                      >
                        {r.kanun_adi.split(" ")[0]} {r.madde_no}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <p className="text-sm text-slate-400">Yanıt hazırlanıyor… (lokal model)</p>}
          </div>
        )}
      </div>

      {error && (
        <p className="mb-2 rounded-md bg-rose-500/10 p-2 text-sm text-rose-300">{error}</p>
      )}

      {/* Giriş kutusu */}
      <div className="sticky bottom-0 bg-transparent pb-4">
        <div
          className={`flex items-center gap-2 rounded-2xl border bg-slate-900/80 px-3 py-2 backdrop-blur ${
            dragging ? "border-emerald-400" : "border-slate-700"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.tiff,.bmp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            title="Sözleşme yükle"
            className="text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            {uploading ? "…" : "📎"}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask(input);
            }}
            placeholder={copy.placeholder}
            disabled={busy}
            className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
          />
          <button
            onClick={() => ask(input)}
            disabled={busy || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
            title="Gönder"
          >
            ↑
          </button>
        </div>
        <div className="mt-2 flex items-center justify-center gap-3 text-center text-xs text-slate-600">
          <HealthBadge />
          <span>·</span>
          <span>
            {JURISDICTIONS[jurisdiction].label} · {JURISDICTIONS[jurisdiction].lang} · yanıtlar
            bilgilendirme amaçlıdır
          </span>
        </div>
      </div>
    </main>
  );
}
