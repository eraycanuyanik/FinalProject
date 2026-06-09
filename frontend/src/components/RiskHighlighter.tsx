"use client";

import { ClauseRisk } from "@/lib/api";

export function riskColor(score: number) {
  if (score >= 76) return { bg: "bg-rose-500/25 hover:bg-rose-500/35", dot: "bg-rose-500", label: "Ciddi risk" };
  if (score >= 51) return { bg: "bg-orange-500/20 hover:bg-orange-500/30", dot: "bg-orange-400", label: "Riskli" };
  if (score >= 21) return { bg: "bg-amber-400/15 hover:bg-amber-400/25", dot: "bg-amber-300", label: "Dikkat" };
  return { bg: "hover:bg-slate-700/40", dot: "bg-emerald-400", label: "Zararsız" };
}

function ClauseBlock({ clause }: { clause: ClauseRisk }) {
  const c = riskColor(clause.risk_skoru);
  return (
    <div
      id={`clause-${clause.index}`}
      className={`group relative scroll-mt-4 rounded-md px-3 py-2 transition ${c.bg}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.dot}`} />
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-200">
          {clause.text}
        </pre>
      </div>

      {/* Hover açıklama balonu */}
      <div className="pointer-events-none absolute left-3 right-3 top-full z-10 mt-1 hidden rounded-lg border border-slate-600 bg-slate-950 p-4 shadow-xl group-hover:block">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {clause.risk_turu}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-slate-950 ${c.dot}`}>
            {clause.risk_skoru}/100
          </span>
        </div>
        {clause.ozet && (
          <p className="mb-2 text-sm text-slate-200">
            <span className="font-semibold">Ne diyor: </span>
            {clause.ozet}
          </p>
        )}
        {clause.aciklama && (
          <p className="text-sm text-slate-300">
            <span className="font-semibold">Neden önemli: </span>
            {clause.aciklama}
          </p>
        )}
        {clause.references?.length > 0 && (
          <div className="mt-2 border-t border-slate-700 pt-2">
            <p className="mb-1 text-xs font-semibold text-slate-400">
              İlgili mevzuat
            </p>
            <ul className="space-y-0.5">
              {clause.references.slice(0, 3).map((r, i) => (
                <li key={i} className="text-xs text-slate-400">
                  <span className="text-emerald-300">
                    {r.kanun_adi} m.{r.madde_no}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RiskHighlighter({
  text,
  clauses,
}: {
  text: string;
  clauses: ClauseRisk[];
}) {
  // Maddelerden önceki giriş metni (örn. başlık) kaybolmasın.
  const leading = clauses.length ? text.slice(0, clauses[0].start).trim() : text;
  const trailing = clauses.length
    ? text.slice(clauses[clauses.length - 1].end).trim()
    : "";

  return (
    <div className="space-y-1">
      {leading && (
        <p className="px-3 py-2 text-sm font-semibold text-slate-300">{leading}</p>
      )}
      {clauses.map((clause) => (
        <ClauseBlock key={clause.index} clause={clause} />
      ))}
      {trailing && (
        <p className="px-3 py-2 text-sm text-slate-400">{trailing}</p>
      )}
    </div>
  );
}
