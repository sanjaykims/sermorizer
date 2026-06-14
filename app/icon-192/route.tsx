import { ImageResponse } from "next/og";
import { iconArt } from "@/lib/icon-art";

export const runtime = "nodejs";

// 192×192 PNG for the PWA manifest (Android Add-to-Home-Screen).
export function GET() {
  return new ImageResponse(iconArt(192), { width: 192, height: 192 });
}
