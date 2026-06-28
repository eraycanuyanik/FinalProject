"use client";

import { useEffect, useState } from "react";
import { API_URL, getUsage, Usage } from "@/lib/api";

export default function UsagePanel({
  user,
  refreshKey,
}: {
  user: string;
  refreshKey: number;
}) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [corpus, setCorpus] = useState<{ tr: number; us: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = () => getUsage(user).then(setUsage).catch(() => setUsage(null));
    load();
    const t = setInterval(load, 15000); // analiz sürerken maliyet canlı güncellensin
    return () => clearInterval(t);
  }, [user, refreshKey]);

  useEffect(() => {
    fetch(`${API_URL}/rag/status`)
      .then((r) => r.json())
      .then((d) => setCorpus({ tr: d.tr?.indexed_articles ?? 0, us: d.us?.indexed_articles ?? 0 }))
      .catch(() => setCorpus(null));
  }, []);

  const cost = usage?.cost_usd ?? 0;
  const dashUrl = `${API_URL.replace(":8000", ":4000")}/ui`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span>💸</span> Sanal Maliyet
        </div>
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-3xl font-bold text-transparent">
          ${cost.toFixed(4)}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {usage ? `${usage.total_tokens.toLocaleString("tr-TR")} token · ${usage.requests} istek` : "—"}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          ChatGPT (GPT-4o) tarifesiyle hesaplandı. Gerçek maliyet{" "}
          <span className="font-medium text-emerald-600">$0</span> — model lokal çalışıyor.
        </p>
        <a
          href={dashUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Detaylı pano (LiteLLM) →
        </a>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span>📚</span> Hukuk Korpusu
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">🇹🇷 Türk mevzuatı</span>
            <span className="font-medium text-slate-800">{corpus ? corpus.tr : "…"} madde</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">🇺🇸 ABD hukuku</span>
            <span className="font-medium text-slate-800">{corpus ? corpus.us : "…"} madde</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500 shadow-sm">
        <div className="mb-1 font-semibold text-slate-600">🔒 Gizlilik</div>
        Belgelerin bilgisayarından çıkmaz; tüm analiz lokal yapay zekayla yapılır.
      </div>
    </div>
  );
}
