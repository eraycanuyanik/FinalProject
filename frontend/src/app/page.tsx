"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  API_URL,
  ChatMessage,
  Jurisdiction,
  LawReference,
  streamChat,
  uploadDocument,
} from "@/lib/api";
import { JURISDICTIONS, useJurisdiction } from "@/lib/jurisdiction";
import { useUser } from "@/lib/user";
import CountrySwitch from "@/components/CountrySwitch";
import HealthBadge from "@/components/HealthBadge";
import DocumentCard from "@/components/DocumentCard";

const COPY: Record<
  Jurisdiction,
  { greeting: string; subtitle: string; placeholder: string; chips: string[]; refs: string }
> = {
  tr: {
    greeting: "Hukuki sorununu anlat",
    subtitle:
      "Türk mevzuatına dayalı yanıt veririm. Bir sözleşme de yükleyebilirsin — sohbetin içinde analiz ederim.",
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
      "I answer based on U.S. law. You can also upload a contract — I'll analyze it right in the chat.",
    placeholder: "Ask a question or upload a contract…",
    chips: [
      "Can my landlord keep my security deposit?",
      "Am I entitled to overtime pay?",
      "What is an implied warranty of merchantability?",
    ],
    refs: "Relevant law",
  },
};

type Item =
  | { id: number; kind: "user"; text: string }
  | { id: number; kind: "assistant"; text: string; references?: LawReference[] }
  | { id: number; kind: "doc"; docId: string; filename: string };

export default function Home() {
  const [jurisdiction, setJurisdiction] = useJurisdiction();
  const [user, setUser, userReady] = useUser();
  const [nameInput, setNameInput] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [docContext, setDocContext] = useState<{ id: string; name: string } | null>(null);
  const idRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const copy = COPY[jurisdiction];
  const nextId = () => ++idRef.current;
  const scrollDown = () =>
    setTimeout(() => scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 60);

  function refsChips(references?: LawReference[]) {
    if (!references || references.length === 0) return null;
    return (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <span className="text-xs text-slate-500">{copy.refs}:</span>
        {references.slice(0, 4).map((r, j) => (
          <span
            key={j}
            title={r.snippet}
            className="cursor-help rounded bg-slate-800 px-1.5 py-0.5 text-xs text-emerald-300"
          >
            {r.kanun_adi.split(" ")[0]} {r.madde_no}
          </span>
        ))}
      </div>
    );
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");

    const history: ChatMessage[] = items
      .filter((it): it is Extract<Item, { kind: "user" | "assistant" }> =>
        it.kind === "user" || it.kind === "assistant"
      )
      .map((it) => ({ role: it.kind, content: it.text }));

    setItems((p) => [...p, { id: nextId(), kind: "user", text: q }]);
    const aId = nextId();
    setItems((p) => [...p, { id: aId, kind: "assistant", text: "" }]);
    setBusy(true);
    scrollDown();

    try {
      await streamChat(
        { message: q, history, jurisdiction, user, docId: docContext?.id },
        {
          onMeta: (references) =>
            setItems((p) =>
              p.map((it) => (it.id === aId && it.kind === "assistant" ? { ...it, references } : it))
            ),
          onDelta: (text) =>
            setItems((p) =>
              p.map((it) =>
                it.id === aId && it.kind === "assistant" ? { ...it, text: it.text + text } : it
              )
            ),
        }
      );
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
      scrollDown();
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const res = await uploadDocument(file, jurisdiction, user);
      setItems((p) => [
        ...p,
        { id: nextId(), kind: "doc", docId: res.id, filename: res.filename },
      ]);
      setDocContext({ id: res.id, name: res.filename });
      scrollDown();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setUploading(false);
    }
  }

  if (userReady && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/60 p-6 text-center">
          <div className="mb-3 text-3xl">⚖️</div>
          <h1 className="text-xl font-bold">Anlattım’a hoş geldin</h1>
          <p className="mt-2 text-sm text-slate-400">
            Seni nasıl çağıralım? (Maliyet panosunda bu adla görünürsün.)
          </p>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && nameInput.trim() && setUser(nameInput)}
            placeholder="Adın"
            className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
          />
          <button
            onClick={() => nameInput.trim() && setUser(nameInput)}
            disabled={!nameInput.trim()}
            className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Başla
          </button>
        </div>
      </div>
    );
  }

  const started = items.length > 0;

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
          onClick={() => {
            setItems([]);
            setDocContext(null);
          }}
          className="flex items-center gap-2 text-lg font-semibold"
          title="Yeni sohbet"
        >
          <span className="text-emerald-400">⚖</span> Anlattım
        </button>
        <div className="flex items-center gap-3">
          <CountrySwitch value={jurisdiction} onChange={setJurisdiction} />
          <button
            onClick={() => setUser("")}
            className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            title="Kullanıcıyı değiştir"
          >
            {user}
          </button>
        </div>
      </header>

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
            {items.map((it) => {
              if (it.kind === "doc") return <DocumentCard key={it.id} docId={it.docId} filename={it.filename} />;
              return (
                <div key={it.id} className={it.kind === "user" ? "text-right" : ""}>
                  <div
                    className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 text-left text-sm ${
                      it.kind === "user" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    {it.kind === "assistant" ? (
                      it.text ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{it.text}</ReactMarkdown>
                      ) : (
                        <span className="text-slate-400">Yanıt yazıyor…</span>
                      )
                    ) : (
                      it.text
                    )}
                  </div>
                  {it.kind === "assistant" && refsChips(it.references)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && <p className="mb-2 rounded-md bg-rose-500/10 p-2 text-sm text-rose-300">{error}</p>}

      <div className="sticky bottom-0 pb-4">
        {docContext && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
            📄 “{docContext.name}” bağlamında soruyorsun
            <button onClick={() => setDocContext(null)} className="text-slate-500 hover:text-slate-200">
              ✕
            </button>
          </div>
        )}
        <div
          className={`flex items-center gap-2 rounded-2xl border bg-slate-900/80 px-3 py-2 backdrop-blur ${
            dragging ? "border-emerald-400" : "border-slate-700"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.tiff,.bmp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Sözleşme yükle"
            className="text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            {uploading ? "…" : "📎"}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(input)}
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
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-center text-xs text-slate-600">
          <HealthBadge />
          <span>·</span>
          <span>
            {JURISDICTIONS[jurisdiction].label} · {JURISDICTIONS[jurisdiction].lang}
          </span>
          <span>·</span>
          <a
            href={`${API_URL.replace(":8000", ":4000")}/ui`}
            target="_blank"
            rel="noreferrer"
            className="text-slate-500 underline hover:text-slate-300"
          >
            Maliyet panosu
          </a>
        </div>
      </div>
    </main>
  );
}
