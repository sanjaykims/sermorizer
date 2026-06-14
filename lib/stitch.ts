/* Server-side counterpart of the client's stitchParts(): merges each part's
   #sermon-body into part 0's document, renumbers sections, builds the sticky
   tab TOC and the numbered at-a-glance summary, and guarantees the layout CSS.
   Running this server-side means a long (split) sermon finishes even if the
   user closed the app mid-job — which is also what lets us push a completion
   notification. Mirrors app/page.tsx stitchParts exactly. */

import { parse } from "node-html-parser";
import { ENHANCE_LAYOUT_CSS } from "./enhance";
import { escapeHtml } from "./util";

export function stitchPartsServer(parts: Record<string, string>, n: number): string {
  const part0 = parts["0"];
  if (!part0) {
    throw new Error("Stitching failed: part 1 is missing. Please try again.");
  }
  const base = parse(part0);
  const body = base.querySelector("#sermon-body");
  if (!body) {
    throw new Error(
      'Stitching failed: part 1 is missing the <div id="sermon-body"> wrapper. Please try again.',
    );
  }

  for (let k = 1; k < n; k++) {
    const html = parts[String(k)];
    if (!html) continue;
    const d = parse(html);
    const b = d.querySelector("#sermon-body");
    if (b) body.insertAdjacentHTML("beforeend", b.innerHTML);
  }

  // Renumber sections and collect the table of contents.
  const sections = body.querySelectorAll("section");
  const toc: { id: string; title: string }[] = [];
  sections.forEach((sec, i) => {
    const id = `sec-${i + 1}`;
    sec.setAttribute("id", id);
    const titleEl =
      sec.querySelector(".sec-title") ??
      sec.querySelector("h2") ??
      sec.querySelector("h3");
    const title = (titleEl?.textContent ?? `Section ${i + 1}`).trim();
    toc.push({ id, title });
  });

  // Sticky tab bar: one link per section + the summary.
  const tocEl =
    base.querySelector(".toc") ??
    base.querySelector("#toc") ??
    base.querySelector("nav.toc");
  if (tocEl && toc.length) {
    tocEl.set_content(
      toc.map((t) => `<a href="#${t.id}">${escapeHtml(t.title)}</a>`).join("") +
        `<a href="#summary">한눈에 보기</a>`,
    );
  }

  // Numbered at-a-glance summary cards.
  if (toc.length) {
    const items = toc
      .map(
        (t, i) =>
          `<div class="sm-item"><div class="sm-num">${i + 1}</div><div class="sm-text">${escapeHtml(
            t.title,
          )}</div></div>`,
      )
      .join("");
    const summary = `<section class="summary" id="summary"><div class="sec-head"><span class="sec-icon">★</span><span class="sec-title">한눈에 보기</span></div><div class="sm-grid">${items}</div></section>`;
    body.insertAdjacentHTML("afterend", summary);
  }

  // Guarantee the tab-bar + summary-card layout regardless of generated CSS.
  const head = base.querySelector("head");
  if (head && !base.querySelector("#sermorizer-layout")) {
    head.insertAdjacentHTML(
      "beforeend",
      `<style id="sermorizer-layout">${ENHANCE_LAYOUT_CSS}</style>`,
    );
  }

  const htmlEl = base.querySelector("html");
  return "<!DOCTYPE html>\n" + (htmlEl ? htmlEl.toString() : base.toString());
}
