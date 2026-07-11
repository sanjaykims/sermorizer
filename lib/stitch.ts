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
    if (b) {
      body.insertAdjacentHTML("beforeend", b.innerHTML);
    } else {
      // The part omitted the #sermon-body wrapper. Rather than silently drop a
      // whole slice of the sermon, salvage its thematic sections directly.
      const salvaged = d.querySelectorAll("section, .section");
      for (const sec of salvaged) body.insertAdjacentHTML("beforeend", sec.toString());
    }
  }

  // Renumber sections and collect the table of contents. Prefer <section>
  // elements; fall back to `.section` (the prompts list both), so a document
  // that used the class form still gets a populated TOC + summary.
  let sections = body.querySelectorAll("section");
  if (sections.length === 0) sections = body.querySelectorAll(".section");
  const toc: { id: string; title: string }[] = [];
  sections.forEach((sec, i) => {
    const id = `sec-${i + 1}`;
    sec.setAttribute("id", id);
    // Match the client stitcher: take the first h2/h3 in document order (not
    // h2-always-before-h3), so server- and client-stitched docs are identical.
    const titleEl = sec.querySelector(".sec-title") ?? sec.querySelector("h2, h3");
    const title = (titleEl?.textContent ?? `Section ${i + 1}`).trim();
    toc.push({ id, title });
  });

  // Sticky tab bar: one link per section + the summary.
  const tocEl = base.querySelector(".toc, #toc, nav.toc");
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
          `<div class="sm-item"><div class="sm-num" aria-hidden="true">${i + 1}</div><div class="sm-text">${escapeHtml(
            t.title,
          )}</div></div>`,
      )
      .join("");
    const summary = `<section class="summary" id="summary"><div class="sec-head"><span class="sec-icon">★</span><span class="sec-title">한눈에 보기</span></div><div class="sm-grid">${items}</div></section>`;
    body.insertAdjacentHTML("afterend", summary);
  }

  // Guarantee the tab-bar + summary-card layout regardless of generated CSS.
  // If part 0's shell has no <head> (node-html-parser doesn't synthesize one,
  // unlike the client's DOMParser), fall back to injecting the style into
  // <html> / the body so the layout CSS is never silently omitted.
  if (!base.querySelector("#sermorizer-layout")) {
    const styleTag = `<style id="sermorizer-layout">${ENHANCE_LAYOUT_CSS}</style>`;
    const head = base.querySelector("head");
    const htmlNode = base.querySelector("html");
    if (head) head.insertAdjacentHTML("beforeend", styleTag);
    else if (htmlNode) htmlNode.insertAdjacentHTML("afterbegin", styleTag);
    else base.insertAdjacentHTML("afterbegin", styleTag);
  }

  const htmlEl = base.querySelector("html");
  return "<!DOCTYPE html>\n" + (htmlEl ? htmlEl.toString() : base.toString());
}
