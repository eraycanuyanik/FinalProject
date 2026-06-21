"use client";

import { Jurisdiction } from "@/lib/api";
import { JURISDICTIONS } from "@/lib/jurisdiction";

export default function CountrySwitch({
  value,
  onChange,
}: {
  value: Jurisdiction;
  onChange: (j: Jurisdiction) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-700 text-sm">
      {(Object.keys(JURISDICTIONS) as Jurisdiction[]).map((j) => {
        const active = j === value;
        return (
          <button
            key={j}
            onClick={() => onChange(j)}
            className={`px-3 py-1.5 transition ${
              active
                ? "bg-emerald-600 font-medium text-white"
                : "text-slate-400 hover:bg-slate-800"
            }`}
            title={JURISDICTIONS[j].label}
          >
            {JURISDICTIONS[j].code} · {JURISDICTIONS[j].label}
          </button>
        );
      })}
    </div>
  );
}
