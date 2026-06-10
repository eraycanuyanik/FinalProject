"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument } from "@/lib/api";
import HealthBadge from "@/components/HealthBadge";

const ACCEPT = ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.tiff,.bmp";

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const res = await uploadDocument(file);
      router.push(`/analyze/${res.id}`);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold tracking-tight">Anlattım</h1>
        <HealthBadge />
      </div>
      <p className="mt-2 text-slate-400">
        Sözleşmeni yükle; sade Türkçeyle ne imzaladığını anlatalım. Belgen
        bilgisayarından dışarı çıkmaz.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`mt-10 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 text-center transition ${
          dragging
            ? "border-emerald-400 bg-emerald-400/5"
            : "border-slate-700 hover:border-slate-500"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {busy ? (
          <p className="text-slate-300">Yükleniyor ve metin çıkarılıyor…</p>
        ) : (
          <>
            <p className="text-lg font-medium">
              Sözleşmeni buraya sürükle ya da tıklayıp seç
            </p>
            <p className="mt-2 text-sm text-slate-500">
              PDF, DOCX, TXT veya fotoğraf (JPG/PNG) · en fazla 20 MB
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <p className="mt-8 text-xs text-slate-600">
        Anlattım yasal tavsiye vermez; çıktılar bilgilendirme amaçlıdır.
      </p>
    </main>
  );
}
