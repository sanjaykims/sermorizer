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
    icons: [
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
