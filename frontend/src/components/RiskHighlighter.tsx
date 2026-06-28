"use client";

import { ClauseRisk } from "@/lib/api";
import { useT } from "@/lib/i18n";

export function riskColor(score: number) {
  if (score >= 76)
    return { bg: "bg-rose-50 hover:bg-rose-100 border-rose-200", dot: "bg-rose-500", label: "Ciddi risk" };
  if (score >= 51)
    return { bg: "bg-orange-50 hover:bg-orange-100 border-orange-200", dot: "bg-orange-500", label: "Riskli" };
  if (score >= 21)
    return { bg: "bg-amber-50 hover:bg-amber-100 border-amber-200", dot: "bg-amber-400", label: "Dikkat" };
  return { bg: "hover:bg-slate-100 border-transparent", dot: "bg-emerald-500", label: "Zararsız" };
}

function ClauseBlock({ clause }: { clause: ClauseRisk }) {
  const t = useT();
  const c = riskColor(clause.risk_skoru);
  return (
    <div
      id={`clause-${clause.index}`}
      className={`group relative scroll-mt-4 rounded-lg border px-3 py-2 transition ${c.bg}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.dot}`} />
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
          {clause.text}
        </pre>
      </div>

      <div className="pointer-events-none absolute left-3 right-3 top-full z-10 mt-1 hidden rounded-xl border border-slate-200 bg-white p-4 shadow-xl group-hover:block">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {clause.risk_turu}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${c.dot}`}>
            {clause.risk_skoru}/100
          </span>
        </div>
        {clause.ozet && (
          <p className="mb-2 text-sm text-slate-700">
            <span className="font-semibold">{t.whatSays} </span>
            {clause.ozet}
          </p>
        )}
        {clause.aciklama && (
          <p className="text-sm text-slate-600">
            <span className="font-semibold">{t.whyMatters} </span>
            {clause.aciklama}
          </p>
        )}
        {clause.references?.length > 0 && (
          <div className="mt-2 border-t border-slate-100 pt-2">
            <p className="mb-1 text-xs font-semibold text-slate-500">{t.relatedLaw}</p>
            <ul className="space-y-0.5">
              {clause.references.slice(0, 3).map((r, i) => (
                <li key={i} className="text-xs text-emerald-700">
                  {r.kanun_adi} m.{r.madde_no}
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
  const leading = clauses.length ? text.slice(0, clauses[0].start).trim() : text;
  const trailing = clauses.length
    ? text.slice(clauses[clauses.length - 1].end).trim()
    : "";

  return (
    <div className="space-y-1">
      {leading && <p className="px-3 py-2 text-sm font-semibold text-slate-600">{leading}</p>}
      {clauses.map((clause) => (
        <ClauseBlock key={clause.index} clause={clause} />
      ))}
      {trailing && <p className="px-3 py-2 text-sm text-slate-500">{trailing}</p>}
    </div>
  );
}
