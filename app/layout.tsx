import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sermorizer — Sermon Summary Tool",
  description:
    "Turn a week of church sermon materials into one beautiful, mobile-friendly HTML summary.",
  appleWebApp: { capable: true, title: "Sermorizer", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#7c4a32",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
