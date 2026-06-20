import type { Metadata, Viewport } from "next";
import {
  Gowun_Batang,
  Noto_Serif_KR,
  Noto_Sans_KR,
  Cormorant_Garamond,
  Crimson_Pro,
  Inter,
} from "next/font/google";
import "./globals.css";

// Editorial type system — three roles × two scripts. CSS variables are
// composed in globals.css so Korean glyphs fall through to the KR family
// before the Latin fallback.
const displayKR = Gowun_Batang({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-display-kr",
  display: "swap",
});
const bodyKR = Noto_Serif_KR({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-body-kr",
  display: "swap",
});
const uiKR = Noto_Sans_KR({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-ui-kr",
  display: "swap",
});
const displayLat = Cormorant_Garamond({
  weight: ["500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display-lat",
  display: "swap",
});
const bodyLat = Crimson_Pro({
  weight: ["400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-body-lat",
  display: "swap",
});
const uiLat = Inter({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-ui-lat",
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
  themeColor: "#4f2e1f",
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
    displayKR.variable,
    bodyKR.variable,
    uiKR.variable,
    displayLat.variable,
    bodyLat.variable,
    uiLat.variable,
  ].join(" ");
  // Korean-first user; affects IME, autocorrect, and a11y tooling.
  return (
    <html lang="ko" className={fontVars}>
      <body>{children}</body>
    </html>
  );
}
