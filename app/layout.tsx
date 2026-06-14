import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  themeColor: "#7c4a32",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Korean-first user; affects IME, autocorrect, and a11y tooling.
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
