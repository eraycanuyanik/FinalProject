"use client";

import { useEffect, useState } from "react";
import { Jurisdiction } from "@/lib/api";

const KEY = "anlattim.jurisdiction";

export const JURISDICTIONS: Record<
  Jurisdiction,
  { code: string; label: string; lang: string }
> = {
  tr: { code: "TR", label: "Türkiye", lang: "Türk hukuku" },
  us: { code: "US", label: "ABD", lang: "U.S. law" },
};

export function getStoredJurisdiction(): Jurisdiction {
  if (typeof window === "undefined") return "tr";
  const v = window.localStorage.getItem(KEY);
  return v === "us" ? "us" : "tr";
}

/** Paylaşılan yargı bölgesi durumu (localStorage + sekmeler arası senkron). */
export function useJurisdiction(): [Jurisdiction, (j: Jurisdiction) => void] {
  const [j, setJ] = useState<Jurisdiction>("tr");

  useEffect(() => {
    setJ(getStoredJurisdiction());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setJ(e.newValue === "us" ? "us" : "tr");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = (next: Jurisdiction) => {
    setJ(next);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, next);
  };

  return [j, update];
}
