"use client";

import { useState } from "react";
import { cloudGet, type Lang, type Summary } from "@/lib/summaries";
import { buildBookHtml, type BookMeta } from "@/lib/book";
import { buildEpub } from "@/lib/epub";
import { slug, downloadBlob as dl } from "@/lib/util";

const LANG_LABEL: Record<Lang, string> = { ko: "한국어", en: "English", zh: "中文" };

export default function BookPanel({ summaries }: { summaries: Summary[] }) {
  const [lang, setLang] = useState<Lang>("ko");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState({
    title: "갈릴리교회 설교 모음집",
    subtitle: "",
    author: "김영복 담임목사",
    year: String(new Date().getFullYear()),
    isbn: "",
    preface: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Only finished summaries can go in a book.
  const available = summaries.filter(
    (s) => s.status !== "generating" && s.status !== "translating",
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(available.map((s) => s.id)));
  }
  function clearAll() {
    setSelected(new Set());
  }

  function setField(k: keyof typeof meta, v: string) {
    setMeta((m) => ({ ...m, [k]: v }));
  }

  /** Gather selected summaries (chronological), fetching docs if the cache lacks them. */
  async function gather(): Promise<Summary[]> {
    const chosen = available.filter((s) => selected.has(s.id));
    const full: Summary[] = [];
    for (const s of chosen) {
      let row = s;
      if (!row.docs?.[lang]) {
        try {
          const r = await cloudGet(s.id);
          if (r) row = r;
        } catch {
          /* keep what we have */
        }
      }
      if (row.docs?.[lang]) full.push(row);
    }
    full.sort((a, b) => {
      const da = a.serviceDate || new Date(a.createdAt).toISOString().slice(0, 10);
      const db = b.serviceDate || new Date(b.createdAt).toISOString().slice(0, 10);
      return da.localeCompare(db);
    });
    return full;
  }

  async function makeBook(action: "open" | "download" | "epub") {
    if (selected.size === 0) {
      setMsg("Select at least one summary to include.");
      return;
    }
    setBusy(true);
    setMsg(action === "epub" ? "Building the EPUB…" : "Compiling the book…");
    try {
      const items = await gather();
      if (items.length === 0) {
        setMsg(`None of the selected summaries have a ${LANG_LABEL[lang]} version.`);
        return;
      }
      const bookMeta: BookMeta = { ...meta, lang };

      if (action === "epub") {
        const blob = await buildEpub(items, bookMeta);
        dl(blob, `${slug(meta.title)}-${lang}.epub`);
        setMsg(`Downloaded a ${items.length}-chapter EPUB (e-reader file).`);
        return;
      }

      const html = buildBookHtml(items, bookMeta);
      if (action === "open") {
        // Open via a Blob URL and pass "noopener" so the print window can't
        // reach back into the app through window.opener.
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        // NB: with "noopener" the DOM spec forces window.open to return null
        // even on success, so its return value can't be used to detect a
        // blocked pop-up — checking it revoked the blob mid-load and always
        // showed a false "allow pop-ups" error. Assume it opened; if the pop-up
        // really was blocked the user simply sees nothing and can retry.
        window.open(url, "_blank", "noopener");
        // Keep the URL alive long enough for the popup (and Paged.js) to load.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setMsg(
          `Opened a ${items.length}-chapter book. Use the “Save as PDF / 인쇄” button (or your browser’s Print) to make the PDF. If nothing opened, allow pop-ups and tap again.`,
        );
      } else {
        dl(new Blob([html], { type: "text/html;charset=utf-8" }), `${slug(meta.title)}-${lang}.html`);
        setMsg(`Downloaded a ${items.length}-chapter book (HTML). Open it and print to PDF.`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not build the book.");
    } finally {
      setBusy(false);
    }
  }

  if (available.length === 0) return null;

  return (
    <details className="panel book panel-secondary">
      <summary>Make a book (PDF)</summary>
      <p className="hist-note">
        Compile selected summaries into one print-ready book (6×9″, color). Open
        it and “Save as PDF” for a print-on-demand hard copy.
      </p>

      <div className="book-body">
        <div className="field">
          <label>Book language</label>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </div>

        <div className="field">
          <label>Book title</label>
          <input type="text" value={meta.title} onChange={(e) => setField("title", e.target.value)} />
        </div>
        <div className="row">
          <div className="field">
            <label>Subtitle <span className="opt">(optional)</span></label>
            <input type="text" value={meta.subtitle} onChange={(e) => setField("subtitle", e.target.value)} />
          </div>
          <div className="field">
            <label>Year</label>
            <input type="text" value={meta.year} onChange={(e) => setField("year", e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Author / editor</label>
            <input type="text" value={meta.author} onChange={(e) => setField("author", e.target.value)} />
          </div>
          <div className="field">
            <label>ISBN <span className="opt">(optional)</span></label>
            <input type="text" value={meta.isbn} onChange={(e) => setField("isbn", e.target.value)} />
          </div>
        </div>

        <div className="book-select-head">
          <span>Sermons to include ({selected.size}/{available.length})</span>
          <span>
            <button type="button" className="link-btn" onClick={selectAll}>All</button>
            <button type="button" className="link-btn" onClick={clearAll}>None</button>
          </span>
        </div>
        <ul className="book-list">
          {available.map((s) => {
            const has = Boolean(s.docs?.[lang]);
            return (
              <li key={s.id}>
                <label className={has ? "" : "missing"}>
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <span className="bl-title">{s.title}</span>
                  {!has && <span className="bl-warn">no {LANG_LABEL[lang]}</span>}
                </label>
              </li>
            );
          })}
        </ul>

        {msg && <div className="status working" style={{ marginTop: 12 }}>{msg}</div>}

        <div className="book-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => makeBook("open")}>
            {busy ? "Working…" : "Open book → Save as PDF"}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => makeBook("epub")}>
            Download EPUB (e-reader)
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => makeBook("download")}>
            Download book (.html)
          </button>
        </div>
      </div>
    </details>
  );
}
