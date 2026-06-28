"use client";

import { useEffect, useState } from "react";
import { API_URL, getUsage, Usage } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function UsagePanel({
  user,
  refreshKey,
}: {
  user: string;
  refreshKey: number;
}) {
  const t = useT();
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
          <span>💸</span> {t.virtualCost}
        </div>
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-3xl font-bold text-transparent">
          ${cost.toFixed(4)}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {usage ? t.tokensReqs(usage.total_tokens, usage.requests) : "—"}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{t.costNote}</p>
        <a
          href={dashUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          {t.fullDash}
        </a>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span>📚</span> {t.legalCorpus}
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">{t.corpusLabel.tr}</span>
            <span className="font-medium text-slate-800">
              {corpus ? corpus.tr : "…"} {t.articles}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">{t.corpusLabel.us}</span>
            <span className="font-medium text-slate-800">
              {corpus ? corpus.us : "…"} {t.articles}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500 shadow-sm">
        <div className="mb-1 font-semibold text-slate-600">🔒 {t.privacy}</div>
        {t.privacyNote}
      </div>
    </div>
  );
}
