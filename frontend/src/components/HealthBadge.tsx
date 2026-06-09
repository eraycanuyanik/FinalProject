"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export default function HealthBadge() {
  const [status, setStatus] = useState<"ok" | "degraded" | "down" | "loading">(
    "loading"
  );

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setStatus(d.status === "ok" ? "ok" : "degraded"))
      .catch(() => setStatus("down"));
  }, []);

  const map = {
    loading: { c: "bg-slate-500", t: "kontrol ediliyor…" },
    ok: { c: "bg-emerald-400", t: "tüm servisler hazır" },
    degraded: { c: "bg-amber-400", t: "bazı servisler hazır değil" },
    down: { c: "bg-rose-500", t: "backend'e ulaşılamıyor" },
  }[status];

  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-400">
      <span className={`h-2 w-2 rounded-full ${map.c}`} />
      {map.t}
    </span>
  );
}
