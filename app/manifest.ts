import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sermorizer — 설교 요약",
    short_name: "Sermorizer",
    description: "주일 설교 자료를 한 편의 아름다운 HTML 요약본으로.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#7c4a32",
    icons: [
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
