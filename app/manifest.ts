import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sermorizer — Sermon Summary",
    short_name: "Sermorizer",
    description: "Turn weekly church sermon materials into one beautiful HTML summary.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#7c4a32",
    orientation: "portrait",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
