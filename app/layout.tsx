import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sermorizer — 설교 요약 도구",
  description:
    "주일 설교 자료를 한 편의 아름다운 모바일 친화적 HTML 요약본으로 만들어 주는 도구.",
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
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
