"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type ServiceStatus = { ok: boolean; detail: string };
type Health = {
  status: string;
  llm: ServiceStatus;
  chroma: ServiceStatus;
};

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${
        ok ? "bg-emerald-400" : "bg-rose-500"
      }`}
    />
  );
}

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ping, setPing] = useState<string>("");
  const [pinging, setPinging] = useState(false);

  async function loadHealth() {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHealth(await res.json());
    } catch (e) {
      setError(String(e));
      setHealth(null);
    }
  }

  useEffect(() => {
    loadHealth();
  }, []);

  async function doPing() {
    setPinging(true);
    setPing("");
    try {
      const res = await fetch(`${API_URL}/llm/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Merhaba, kendini bir cümlede tanıt." }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPing(`(${data.model}) ${data.reply}`);
    } catch (e) {
      setPing(`Hata: ${e}`);
    } finally {
      setPinging(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Anlattım</h1>
      <p className="mt-2 text-slate-400">
        Türkçe sözleşmelerini sade dille anlatan, %100 lokal yapay zeka.
      </p>

      <section className="mt-10 rounded-xl border border-slate-700 bg-slate-900/50 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Servis Durumu</h2>
          <button
            onClick={loadHealth}
            className="rounded-md border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800"
          >
            Yenile
          </button>
        </div>

        {error && (
          <p className="mt-4 text-rose-400">
            Backend&apos;e ulaşılamadı: {error}
          </p>
        )}

        {health && (
          <ul className="mt-4 space-y-3">
            <li className="flex items-center gap-3">
              <StatusBadge ok={health.status === "ok"} />
              <span className="font-medium">Genel:</span>
              <span className="text-slate-300">{health.status}</span>
            </li>
            <li className="flex items-center gap-3">
              <StatusBadge ok={health.llm.ok} />
              <span className="font-medium">LM Studio:</span>
              <span className="text-slate-400">{health.llm.detail}</span>
            </li>
            <li className="flex items-center gap-3">
              <StatusBadge ok={health.chroma.ok} />
              <span className="font-medium">ChromaDB:</span>
              <span className="text-slate-400">{health.chroma.detail}</span>
            </li>
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-slate-700 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold">LLM Bağlantı Testi</h2>
        <button
          onClick={doPing}
          disabled={pinging}
          className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {pinging ? "Soruluyor…" : "Modele “Merhaba” de"}
        </button>
        {ping && (
          <p className="mt-4 whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-sm text-slate-200">
            {ping}
          </p>
        )}
      </section>
    </main>
  );
}
