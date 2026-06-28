"use client";

import { Jurisdiction } from "@/lib/api";
import { JURISDICTIONS, useT } from "@/lib/i18n";

export default function CountrySwitch({
  value,
  onChange,
}: {
  value: Jurisdiction;
  onChange: (j: Jurisdiction) => void;
}) {
  const t = useT();
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
      {(Object.keys(JURISDICTIONS) as Jurisdiction[]).map((j) => {
        const active = j === value;
        return (
          <button
            key={j}
            onClick={() => onChange(j)}
            className={`px-3 py-1.5 transition ${
              active
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 font-medium text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
            title={t.country[j]}
          >
            {JURISDICTIONS[j].code} · {t.country[j]}
          </button>
        );
      })}
    </div>
  );
}
