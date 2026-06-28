"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Jurisdiction } from "@/lib/api";

export const JURISDICTIONS: Record<Jurisdiction, { code: string }> = {
  tr: { code: "TR" },
  us: { code: "US" },
};

type Strings = {
  tagline: string;
  changeUser: string;
  welcome: string;
  welcomeSub: string;
  yourName: string;
  start: string;
  newChat: string;
  documents: string;
  noDocs: string;
  greeting: string;
  subtitle: string;
  placeholder: string;
  chips: string[];
  refs: string;
  askingAbout: (name: string) => string;
  typing: string;
  disclaimer: string;
  uploadTitle: string;
  send: string;
  // DocumentCard
  summary: string;
  summarizing: string;
  riskyClauses: string;
  reviewing: string;
  docHeading: string;
  hoverHint: string;
  firstClauses: string;
  noRisky: string;
  pages: string;
  // RiskHighlighter
  whatSays: string;
  whyMatters: string;
  relatedLaw: string;
  // UsagePanel
  virtualCost: string;
  tokensReqs: (tokens: number, reqs: number) => string;
  costNote: string;
  fullDash: string;
  legalCorpus: string;
  articles: string;
  privacy: string;
  privacyNote: string;
  // HealthBadge
  checking: string;
  allReady: string;
  someNotReady: string;
  backendDown: string;
  // country + language display names (UI dilinde)
  country: Record<Jurisdiction, string>;
  langName: Record<Jurisdiction, string>;
  corpusLabel: Record<Jurisdiction, string>;
};

export const STRINGS: Record<Jurisdiction, Strings> = {
  tr: {
    tagline: "lokal hukuk asistanı",
    changeUser: "Kullanıcıyı değiştir",
    welcome: "Anlattım’a hoş geldin",
    welcomeSub: "Seni nasıl çağıralım? (Maliyet panosunda bu adla görünürsün.)",
    yourName: "Adın",
    start: "Başla",
    newChat: "+ Yeni sohbet",
    documents: "Belgeler",
    noDocs: "Henüz belge yüklemedin.",
    greeting: "Hukuki sorununu anlat",
    subtitle:
      "Türk mevzuatına dayalı yanıt veririm. Bir sözleşme de yükleyebilirsin — sohbetin içinde analiz ederim.",
    placeholder: "Sorunu yaz ya da bir sözleşme yükle…",
    chips: [
      "Ev sahibi kiramı ne kadar artırabilir?",
      "İstifa edersem kıdem tazminatı alır mıyım?",
      "İnternetten aldığım üründe cayma hakkım var mı?",
    ],
    refs: "İlgili mevzuat",
    askingAbout: (n) => `“${n}” bağlamında soruyorsun`,
    typing: "Yanıt yazıyor",
    disclaimer: "yanıtlar bilgilendirme amaçlıdır",
    uploadTitle: "Sözleşme yükle",
    send: "Gönder",
    summary: "Sade Özet",
    summarizing: "Belge okunuyor ve özetleniyor… (lokal model)",
    riskyClauses: "Riskli Maddeler",
    reviewing: "Maddeler tek tek inceleniyor…",
    docHeading: "Belge — riskli maddeler işaretli",
    hoverHint: "(üzerine gel → açıklama)",
    firstClauses: "İlk maddeler hazırlanıyor…",
    noRisky: "Belirgin bir riskli madde bulunamadı.",
    pages: "sayfa",
    whatSays: "Ne diyor:",
    whyMatters: "Neden önemli:",
    relatedLaw: "İlgili mevzuat",
    virtualCost: "Sanal Maliyet",
    tokensReqs: (t, r) => `${t.toLocaleString("tr-TR")} token · ${r} istek`,
    costNote: "ChatGPT (GPT-4o) tarifesiyle hesaplandı. Gerçek maliyet $0 — model lokal çalışıyor.",
    fullDash: "Detaylı pano (LiteLLM) →",
    legalCorpus: "Hukuk Korpusu",
    articles: "madde",
    privacy: "Gizlilik",
    privacyNote: "Belgelerin bilgisayarından çıkmaz; tüm analiz lokal yapay zekayla yapılır.",
    checking: "kontrol ediliyor…",
    allReady: "tüm servisler hazır",
    someNotReady: "bazı servisler hazır değil",
    backendDown: "backend’e ulaşılamıyor",
    country: { tr: "Türkiye", us: "ABD" },
    langName: { tr: "Türk hukuku", us: "ABD hukuku" },
    corpusLabel: { tr: "🇹🇷 Türk mevzuatı", us: "🇺🇸 ABD hukuku" },
  },
  us: {
    tagline: "local legal assistant",
    changeUser: "Change user",
    welcome: "Welcome to Anlattım",
    welcomeSub: "What should we call you? (You'll appear under this name on the cost dashboard.)",
    yourName: "Your name",
    start: "Start",
    newChat: "+ New chat",
    documents: "Documents",
    noDocs: "No documents yet.",
    greeting: "Describe your legal question",
    subtitle:
      "I answer based on U.S. law. You can also upload a contract — I'll analyze it right in the chat.",
    placeholder: "Ask a question or upload a contract…",
    chips: [
      "Can my landlord keep my security deposit?",
      "Am I entitled to overtime pay?",
      "What is an implied warranty of merchantability?",
    ],
    refs: "Relevant law",
    askingAbout: (n) => `asking about “${n}”`,
    typing: "Typing",
    disclaimer: "answers are for information only",
    uploadTitle: "Upload a contract",
    send: "Send",
    summary: "Plain Summary",
    summarizing: "Reading and summarizing the document… (local model)",
    riskyClauses: "Risky Clauses",
    reviewing: "Reviewing clauses one by one…",
    docHeading: "Document — risky clauses highlighted",
    hoverHint: "(hover → explanation)",
    firstClauses: "Preparing first clauses…",
    noRisky: "No notable risky clauses found.",
    pages: "pages",
    whatSays: "What it says:",
    whyMatters: "Why it matters:",
    relatedLaw: "Relevant law",
    virtualCost: "Virtual Cost",
    tokensReqs: (t, r) => `${t.toLocaleString("en-US")} tokens · ${r} requests`,
    costNote: "Priced at ChatGPT (GPT-4o) rates. Real cost is $0 — the model runs locally.",
    fullDash: "Full dashboard (LiteLLM) →",
    legalCorpus: "Legal Corpus",
    articles: "articles",
    privacy: "Privacy",
    privacyNote: "Your documents never leave your computer; all analysis runs on local AI.",
    checking: "checking…",
    allReady: "all services ready",
    someNotReady: "some services not ready",
    backendDown: "backend unreachable",
    country: { tr: "Turkey", us: "USA" },
    langName: { tr: "Turkish law", us: "U.S. law" },
    corpusLabel: { tr: "🇹🇷 Turkish law", us: "🇺🇸 U.S. law" },
  },
};

const KEY = "anlattim.jurisdiction";
const Ctx = createContext<{ j: Jurisdiction; setJ: (x: Jurisdiction) => void }>({
  j: "tr",
  setJ: () => {},
});

export function JurisdictionProvider({ children }: { children: React.ReactNode }) {
  const [j, setJState] = useState<Jurisdiction>("tr");
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem(KEY) === "us") {
      setJState("us");
    }
  }, []);
  const setJ = (x: Jurisdiction) => {
    setJState(x);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, x);
  };
  return <Ctx.Provider value={{ j, setJ }}>{children}</Ctx.Provider>;
}

export function useJurisdiction(): [Jurisdiction, (x: Jurisdiction) => void] {
  const { j, setJ } = useContext(Ctx);
  return [j, setJ];
}

export function useT(): Strings {
  const { j } = useContext(Ctx);
  return STRINGS[j];
}
