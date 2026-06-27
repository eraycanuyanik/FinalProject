"use client";

import { useRouter } from "next/navigation";
import DocumentAnalysis from "@/components/DocumentAnalysis";

export default function AnalyzePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <DocumentAnalysis docId={params.id} onBack={() => router.push("/")} />
    </main>
  );
}
