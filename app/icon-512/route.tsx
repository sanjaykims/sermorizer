import { ImageResponse } from "next/og";
import { iconArt } from "@/lib/icon-art";

export const runtime = "nodejs";

// 512×512 PNG for the PWA manifest, also used as the maskable icon. The cross
// sits within the inner ~62% so it survives One UI's circular mask; the warm
// gradient fills the square as the maskable background.
export function GET() {
  return new ImageResponse(iconArt(512), { width: 512, height: 512 });
}
