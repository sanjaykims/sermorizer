import type { Metadata, Viewport } from "next";
import {
  Newsreader,
  Geist,
  Geist_Mono,
  Nanum_Myeongjo,
  Noto_Sans_KR,
} from "next/font/google";
import "./globals.css";

// Hearth type system — a committed pairing, not a single font:
//   • Newsreader (modernized old-style serif) → display & headings
//   • Geist (modern grotesque)                → all body & UI
//   • Geist Mono (the one outlier register)   → data, wordmark tag, tabular figures
// Hearth's faces are Latin-only, so two Korean companions are embedded so
// Hangul in the UI never falls back to a system face:
//   • Nanum Myeongjo (한글 세리프) → pairs with Newsreader in the display stack
//   • Noto Sans KR                → pairs with Geist in the body/UI stack
// The CSS variables are composed in globals.css so a Korean glyph falls through
// to its Korean companion while Latin stays on the Hearth face.
const displayLat = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});
const bodyLat = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});
const monoLat = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
// "korean" is not a named Google-Fonts subset for these families, so we omit
// `subsets` and set preload:false. next/font then self-hosts the full set of
// unicode-range-split faces (Latin + every Hangul block) and the browser
// lazy-loads only the ranges each glyph actually needs. (subsets:["latin"]
// would ship only ~13 Hangul glyphs and drop the rest to the system face —
// which would make embedding the Korean serif pointless.)
const displayKR = Nanum_Myeongjo({
  weight: ["400", "700", "800"],
  preload: false,
  variable: "--font-nanum-myeongjo",
  display: "swap",
});
const bodyKR = Noto_Sans_KR({
  weight: ["400", "500", "700"],
  preload: false,
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sermorizer — Sermon Summary Tool",
  description:
    "Turn a week of church sermon materials into one beautiful, mobile-friendly HTML summary.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Sermorizer",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  // Warm ink — matches the dark photographic hero that paints first.
  themeColor: "#1e1712",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontVars = [
    displayLat.variable,
    bodyLat.variable,
    monoLat.variable,
    displayKR.variable,
    bodyKR.variable,
  ].join(" ");
  // Korean-first user; affects IME, autocorrect, and a11y tooling.
  return (
    <html lang="ko" className={fontVars}>
      <body>{children}</body>
    </html>
  );
}
