"use client";

/* Full-screen intro hero: the Sermon on the Mount. The scene reveals as the
   viewer scrolls/drags — a golden light "flash" blooms over the sun, faint
   god-rays turn, and Matthew 5:1-2 rises in — then the page continues to the
   input form below. Motion is driven by scroll position + a gentle auto-bloom
   on open, with a subtle device-tilt drift on the light. All effects fall back
   to a static, fully-revealed scene under `prefers-reduced-motion`. */

import { useEffect, useRef } from "react";

export default function SceneHero() {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const setVar = (k: string, v: string) => stage.style.setProperty(k, v);

    if (reduce) {
      setVar("--p", "1");
      return;
    }

    let p = 0;
    let bloom = 0;
    let bloomStart = 0;
    let raf = 0;
    let running = true;

    // Gilt light drifts as the phone is tilted (Android grants without prompt).
    const onTilt = (ev: DeviceOrientationEvent) => {
      const g = Math.max(-15, Math.min(15, ev.gamma ?? 0));
      const b = Math.max(-15, Math.min(15, (ev.beta ?? 0) - 45));
      setVar("--ty", g + "deg");
      setVar("--tx", b + "deg");
    };
    if (
      typeof (window as unknown as { DeviceOrientationEvent?: unknown })
        .DeviceOrientationEvent !== "undefined" &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown })
        .requestPermission !== "function"
    ) {
      window.addEventListener("deviceorientation", onTilt);
    }

    const frame = (t: number) => {
      if (!bloomStart) bloomStart = t + 350; // small delay before the auto-bloom
      // auto-bloom to ~0.68 shortly after open
      bloom = Math.min(0.68, Math.max(0, (t - bloomStart) / 900) * 0.68);

      const vh = window.innerHeight || 1;
      const sy = window.scrollY || 0;
      // scroll within the first ~45% of a screen drives the reveal to full
      const scrollP = Math.min(1, Math.max(0, sy / (vh * 0.45)));
      const target = Math.max(bloom, scrollP);

      p += (target - p) * 0.11;
      setVar("--p", p.toFixed(3));
      // subtle parallax: the photo lags the scroll for depth
      setVar("--sy", Math.round(sy * 0.18) + "px");

      // pause the loop once the hero has fully scrolled away
      running = sy < vh * 1.35;
      if (running) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // resume the loop when the user scrolls back up to the hero
    const onScroll = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, []);

  return (
    <section className="scene-hero" ref={stageRef} aria-label="산상수훈 — 예수께서 제자들을 가르치심">
      <div className="sh-photo" />
      <div className="sh-rays" />
      <div className="sh-bloom" />
      <div className="sh-scrim" />
      <div className="sh-vig" />

      <div className="sh-wordmark">Sermorizer</div>
      <blockquote className="sh-verse">
        <div className="sh-ref">마태복음 5:1–2 · Matthew 5:1–2</div>
        <p className="sh-ko">
          예수께서 무리를 보시고 산에 올라가 앉으시니
          <br />
          제자들이 나아온지라, 입을 열어 가르쳐 이르시되…
        </p>
        <p className="sh-en">
          …he went up on the mountain, and his disciples came to him,
          <br />
          and he opened his mouth and taught them.
        </p>
      </blockquote>
      <div className="sh-pull" aria-hidden="true">
        아래로 스크롤
        <span className="sh-arrow">⌄</span>
      </div>
    </section>
  );
}
