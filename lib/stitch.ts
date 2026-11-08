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
    // Each part ends its last section without a trailing rule, so joining two
    // parts leaves the seam with no divider where every other section boundary
    // has one. Insert it here, at the join, rather than hoping a part emits it.
    if (body.innerHTML.trim()) {
      body.insertAdjacentHTML("beforeend", '\n\n<div class="divider"></div>\n\n');
    }
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
  const toc: { id: string; title: string; takeaway: string }[] = [];
  sections.forEach((sec, i) => {
    const id = `sec-${i + 1}`;
    sec.setAttribute("id", id);
    // Renumber the VISIBLE badge too, not just the id. Each part numbers its
    // own sections from its own starting point, so after a join the ids ran
    // 1..11 while the badges still read 1..6 then 4..8 — the document openly
    // contradicted its own TOC (see CHANGELOG 2026-11-08). Only a badge that
    // already holds a plain number is touched, so a non-numeric icon (★, an
    // emoji) is left alone.
    const iconEl = sec.querySelector(".sec-icon");
    if (iconEl && /^\s*\d+\s*$/.test(iconEl.textContent ?? "")) {
      iconEl.set_content(String(i + 1));
    }
    // Match the client stitcher: take the first h2/h3 in document order (not
    // h2-always-before-h3), so server- and client-stitched docs are identical.
    const titleEl = sec.querySelector(".sec-title") ?? sec.querySelector("h2, h3");
    const title = (titleEl?.textContent ?? `Section ${i + 1}`).trim();
    // The at-a-glance list is assembled HERE, not by the model: the stitcher is
    // the only place that sees every part. It used to reuse the section title,
    // which made the list a verbatim echo of the tab bar — eleven headings
    // twice over, telling the reader nothing (2026-11-08 review). Prefer the
    // section's own data-takeaway, which the split-part prompt now asks for,
    // and fall back to the heading so a part that omits it still yields a card.
    const takeaway = (sec.getAttribute("data-takeaway") ?? "").trim();
    toc.push({ id, title, takeaway });
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
            t.takeaway || t.title,
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
