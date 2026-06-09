import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anlattım — Sözleşme Anlatıcı",
  description: "Türkçe sözleşmelerinizi sade dille anlatan lokal yapay zeka.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
