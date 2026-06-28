"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function HealthBadge() {
  const t = useT();
  const [status, setStatus] = useState<"ok" | "degraded" | "down" | "loading">("loading");

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setStatus(d.status === "ok" ? "ok" : "degraded"))
      .catch(() => setStatus("down"));
  }, []);

  const map = {
    loading: { c: "bg-slate-400", t: t.checking },
    ok: { c: "bg-emerald-500", t: t.allReady },
    degraded: { c: "bg-amber-400", t: t.someNotReady },
    down: { c: "bg-rose-500", t: t.backendDown },
  }[status];

  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-500">
      <span className={`h-2 w-2 rounded-full ${map.c}`} />
      {map.t}
    </span>
  );
}
