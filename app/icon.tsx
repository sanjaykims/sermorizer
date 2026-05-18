import { ImageResponse } from "next/og";
import { iconArt } from "@/lib/icon-art";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(iconArt(size.width), { ...size });
}
