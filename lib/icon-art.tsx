import type { ReactElement } from "react";

/**
 * The Sermorizer app icon, drawn as JSX so Next.js can render it to a PNG at
 * any size (favicon, Apple touch icon, manifest icon). Styled to the Hearth
 * design system: a flat warm-ink field, a clean warm-oat cross, and a single
 * signal-orange mark (the Hearth wordmark square) sealing the foot of the
 * cross. No gradients — depth is weight and contrast. Colours are hex because
 * the OG/Satori renderer doesn't evaluate oklch().
 */
export function iconArt(s: number): ReactElement {
  const vBarW = s * 0.13;
  const vBarH = s * 0.6;
  const hBarW = s * 0.42;
  const hBarH = s * 0.13;
  const radius = s * 0.03;
  const ink = "#1e1712"; // --ink
  const bar = "#faf6ef"; // --paper
  const mark = "#FC4C02"; // --accent (signal orange)

  return (
    <div
      style={{
        width: s,
        height: s,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: ink,
        position: "relative",
      }}
    >
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
            background: bar,
            borderRadius: radius,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: vBarH * 0.28,
            width: hBarW,
            height: hBarH,
            background: bar,
            borderRadius: radius,
          }}
        />
      </div>
      {/* Hearth mark — a small rotated signal-orange square at the cross's foot,
          kept centred so it survives the maskable-icon safe zone. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: s * 0.2,
          width: s * 0.13,
          height: s * 0.13,
          marginLeft: -(s * 0.065),
          background: mark,
          borderRadius: s * 0.026,
          transform: "rotate(45deg)",
          display: "flex",
        }}
      />
    </div>
  );
}
