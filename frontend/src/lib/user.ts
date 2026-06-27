"use client";

import { useEffect, useState } from "react";

const KEY = "anlattim.user";

export function getStoredUser(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) || "";
}

/** Kullanıcı adı (LiteLLM'de "kim" için). localStorage'da saklanır. */
export function useUser(): [string, (name: string) => void, boolean] {
  const [user, setUserState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUserState(getStoredUser());
    setReady(true);
  }, []);

  const setUser = (name: string) => {
    const clean = name.trim().slice(0, 60);
    setUserState(clean);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, clean);
  };

  return [user, setUser, ready];
}
