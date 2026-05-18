import type { ReactElement } from "react";

/**
 * The Sermorizer app icon, drawn as JSX so Next.js can render it to a PNG at
 * any size (favicon, Apple touch icon, manifest icon). A warm terracotta
 * gradient with a clean ivory cross — matching the app's liturgical palette.
 */
export function iconArt(s: number): ReactElement {
  const vBarW = s * 0.135;
  const vBarH = s * 0.62;
  const hBarW = s * 0.44;
  const hBarH = s * 0.135;
  const radius = s * 0.045;
  const barColor = "#f6ecd4";
  const shadow = `0 ${s * 0.022}px ${s * 0.06}px rgba(38, 22, 12, 0.4)`;

  return (
    <div
      style={{
        width: s,
        height: s,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(145deg, #b56e42 0%, #7c4a32 54%, #4f372a 100%)",
      }}
    >
      {/* soft warm glow behind the cross */}
      <div
        style={{
          position: "absolute",
          width: s * 0.92,
          height: s * 0.92,
          borderRadius: s,
          background:
            "radial-gradient(circle, rgba(246,236,212,0.26) 0%, rgba(246,236,212,0) 68%)",
        }}
      />
      {/* the cross */}
      <div
        style={{
          position: "relative",
          width: hBarW,
          height: vBarH,
          display: "flex",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: (hBarW - vBarW) / 2,
            top: 0,
            width: vBarW,
            height: vBarH,
            background: barColor,
            borderRadius: radius,
            boxShadow: shadow,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: vBarH * 0.3,
            width: hBarW,
            height: hBarH,
            background: barColor,
            borderRadius: radius,
            boxShadow: shadow,
          }}
        />
      </div>
    </div>
  );
}
