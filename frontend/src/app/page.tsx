"use client";

import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage, LawReference, streamChat, uploadDocument } from "@/lib/api";
import { useJurisdiction, useT } from "@/lib/i18n";
import { useUser } from "@/lib/user";
import CountrySwitch from "@/components/CountrySwitch";
import HealthBadge from "@/components/HealthBadge";
import DocumentCard from "@/components/DocumentCard";
import UsagePanel from "@/components/UsagePanel";

type Item =
  | { id: number; kind: "user"; text: string }
  | { id: number; kind: "assistant"; text: string; references?: LawReference[] }
  | { id: number; kind: "doc"; docId: string; filename: string };

export default function Home() {
  const [jurisdiction, setJurisdiction] = useJurisdiction();
  const t = useT();
  const [user, setUser, userReady] = useUser();
  const [nameInput, setNameInput] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [docContext, setDocContext] = useState<{ id: string; name: string } | null>(null);
  const [usageKey, setUsageKey] = useState(0);
  const idRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const nextId = () => ++idRef.current;
  const bumpUsage = () => setUsageKey((k) => k + 1);
  const scrollDown = () =>
    setTimeout(() => scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 60);

  const docs = useMemo(
    () => items.filter((it): it is Extract<Item, { kind: "doc" }> => it.kind === "doc"),
    [items]
  );

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
      bumpUsage();
      scrollDown();
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const res = await uploadDocument(file, jurisdiction, user);
      setItems((p) => [...p, { id: nextId(), kind: "doc", docId: res.id, filename: res.filename }]);
      setDocContext({ id: res.id, name: res.filename });
      scrollDown();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setUploading(false);
    }
  }

  function newChat() {
    setItems([]);
    setDocContext(null);
  }

  if (userReady && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-2xl text-white">
            ⚖
          </div>
          <h1 className="text-xl font-bold text-slate-800">{t.welcome}</h1>
          <p className="mt-2 text-sm text-slate-500">{t.welcomeSub}</p>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && nameInput.trim() && setUser(nameInput)}
            placeholder={t.yourName}
            className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <button
            onClick={() => nameInput.trim() && setUser(nameInput)}
            disabled={!nameInput.trim()}
            className="mt-3 w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {t.start}
          </button>
        </div>
      </div>
    );
  }

  const started = items.length > 0;

  return (
    <div
      className="flex h-screen flex-col"
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
      {/* Üst bar */}
      <header className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-white shadow-sm">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span>⚖</span> Anlattım
          <span className="ml-2 hidden text-xs font-normal text-emerald-100 sm:inline">
            {t.tagline}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <CountrySwitch value={jurisdiction} onChange={setJurisdiction} />
          <button
            onClick={() => setUser("")}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur transition hover:bg-white/25"
            title={t.changeUser}
          >
            {user}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sol panel */}
        <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white/70 p-3 backdrop-blur md:flex">
          <button
            onClick={newChat}
            className="mb-4 w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            {t.newChat}
          </button>
          <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.documents}
          </div>
          <div className="flex-1 space-y-1 overflow-auto">
            {docs.length === 0 ? (
              <p className="px-1 text-xs text-slate-400">{t.noDocs}</p>
            ) : (
              docs.map((d) => (
                <a
                  key={d.id}
                  href={`#doc-${d.id}`}
                  className="block truncate rounded-lg px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
                  title={d.filename}
                >
                  📄 {d.filename}
                </a>
              ))
            )}
          </div>
          <div className="mt-2 border-t border-slate-200 pt-2">
            <HealthBadge />
          </div>
        </aside>

        {/* Orta: sohbet */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-auto">
            <div className="mx-auto max-w-4xl px-4 py-6">
              {!started ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-3xl text-white shadow-lg">
                    💬
                  </div>
                  <h1 className="text-2xl font-bold text-slate-800">{t.greeting}</h1>
                  <p className="mt-2 max-w-md text-sm text-slate-500">{t.subtitle}</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {t.chips.map((c) => (
                      <button
                        key={c}
                        onClick={() => ask(c)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((it) => {
                    if (it.kind === "doc")
                      return (
                        <div key={it.id} id={`doc-${it.id}`}>
                          <DocumentCard docId={it.docId} filename={it.filename} />
                        </div>
                      );
                    return (
                      <div key={it.id} className={it.kind === "user" ? "text-right" : ""}>
                        <div
                          className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 text-left text-sm shadow-sm ${
                            it.kind === "user"
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                              : "border border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          {it.kind === "assistant" ? (
                            it.text ? (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{it.text}</ReactMarkdown>
                            ) : (
                              <span className="cursor-blink text-slate-400">{t.typing}</span>
                            )
                          ) : (
                            it.text
                          )}
                        </div>
                        {it.kind === "assistant" && it.references && it.references.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className="text-xs text-slate-400">{t.refs}:</span>
                            {it.references.slice(0, 4).map((r, j) => (
                              <span
                                key={j}
                                title={r.snippet}
                                className="cursor-help rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700"
                              >
                                {r.kanun_adi.split(" ")[0]} {r.madde_no}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Giriş */}
          <div className="border-t border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
            <div className="mx-auto max-w-4xl">
              {error && (
                <p className="mb-2 rounded-md bg-rose-50 p-2 text-sm text-rose-700">{error}</p>
              )}
              {docContext && (
                <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                  📄 {t.askingAbout(docContext.name)}
                  <button
                    onClick={() => setDocContext(null)}
                    className="text-emerald-500 hover:text-emerald-800"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div
                className={`flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm transition ${
                  dragging ? "border-emerald-400 ring-2 ring-emerald-200" : "border-slate-200"
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
                  title={t.uploadTitle}
                  className="text-lg text-slate-400 transition hover:text-emerald-600 disabled:opacity-50"
                >
                  {uploading ? "…" : "📎"}
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && ask(input)}
                  placeholder={t.placeholder}
                  disabled={busy}
                  className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
                <button
                  onClick={() => ask(input)}
                  disabled={busy || !input.trim()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white transition hover:opacity-90 disabled:opacity-40"
                  title={t.send}
                >
                  ↑
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-slate-400">
                {t.country[jurisdiction]} · {t.langName[jurisdiction]} · {t.disclaimer}
              </p>
            </div>
          </div>
        </main>

        {/* Sağ panel */}
        <aside className="hidden w-72 overflow-auto border-l border-slate-200 bg-white/40 p-4 backdrop-blur lg:block">
          <UsagePanel user={user} refreshKey={usageKey} />
        </aside>
      </div>
    </div>
  );
}
