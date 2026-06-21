"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage, LawReference, sendChat } from "@/lib/api";

const SUGGESTIONS = [
  "Bu sözleşmede en riskli madde hangisi?",
  "Depozitomu geri alabilir miyim?",
  "Sözleşmeyi erken feshedersem ne olur?",
];

type Turn = ChatMessage & { references?: LawReference[] };

export default function ChatPanel({ docId }: { docId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");
    const history: ChatMessage[] = turns.map((t) => ({
      role: t.role,
      content: t.content,
    }));
    setTurns((prev) => [...prev, { role: "user", content: q }]);
    setBusy(true);
    try {
      const res = await sendChat({ message: q, history, docId });
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, references: res.references },
      ]);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 50);
    }
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/50">
      <header className="border-b border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300">
        Belge Hakkında Sor
        <span className="ml-2 font-normal text-slate-500">
          (cevaplar belgeye ve Türk mevzuatına dayanır)
        </span>
      </header>

      <div ref={scrollRef} className="max-h-[50vh] space-y-4 overflow-auto px-5 py-4">
        {turns.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Sözleşmeyle ilgili merak ettiğini sor. Örnek:
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                t.role === "user"
                  ? "bg-emerald-600/80 text-white"
                  : "bg-slate-800 text-slate-200"
              }`}
            >
              {t.role === "assistant" ? (
                <div className="prose-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.content}</ReactMarkdown>
                </div>
              ) : (
                t.content
              )}
            </div>
            {t.role === "assistant" && t.references && t.references.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="text-xs text-slate-500">İlgili olabilecek mevzuat:</span>
                {t.references.slice(0, 4).map((r, j) => (
                  <span
                    key={j}
                    title={r.snippet}
                    className="cursor-help rounded bg-slate-800 px-1.5 py-0.5 text-xs text-emerald-300"
                  >
                    {r.kanun_adi.split(" ")[0]} m.{r.madde_no}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <p className="text-sm text-slate-400">Yanıt hazırlanıyor… (lokal model)</p>
        )}
        {error && (
          <p className="rounded-md bg-rose-500/10 p-2 text-sm text-rose-300">{error}</p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2 border-t border-slate-700 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Sorunu yaz…"
          disabled={busy}
          className="flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          Gönder
        </button>
      </form>
    </section>
  );
}
