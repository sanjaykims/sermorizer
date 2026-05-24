"use client";

import { useEffect, useRef, useState } from "react";
import { THEMES } from "@/lib/themes";
import {
  cloudEnabled,
  cloudList,
  cloudInsert,
  cloudUpdateDocs,
  cloudDelete,
} from "@/lib/summaries";

type Lang = "ko" | "en" | "zh";
type Status = "idle" | "generating" | "translating" | "done" | "error";

type Metadata = {
  title: string;
  preacher: string;
  scripture: string;
  date: string;
  occasion: string;
  serviceType: string;
};

type ImagePayload = { media_type: string; data: string };

type HistoryEntry = {
  id: string;
  title: string;
  createdAt: number;
  serviceDate?: string;
  occasion?: string;
  docs: Partial<Record<Lang, string>>;
};

const EMPTY_META: Metadata = {
  title: "",
  preacher: "김영복 담임목사",
  scripture: "",
  date: "",
  occasion: "",
  serviceType: "Sunday Worship Service",
};

/** Load an image File, downscale it, and return base64 JPEG for the API. */
async function imageToBase64(file: File): Promise<ImagePayload> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error(`Could not read ${file.name}`));
    fr.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error(`Could not decode ${file.name}`));
    i.src = dataUrl;
  });
  // Higher resolution = more accurate OCR of the Korean handwriting, which is a
  // key quality input. Capped at 2048px / q0.85 to stay under the upload size
  // limit even with a few photos.
  const MAX = 2048;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", 0.85);
  return { media_type: "image/jpeg", data: out.split(",")[1] ?? "" };
}

function cleanHtml(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) t = t.replace(/^```[a-zA-Z]*\s*\n?/, "");
  if (t.endsWith("```")) t = t.replace(/\n?```$/, "");
  return t.trim();
}

function slug(s: string): string {
  return (s || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

const HISTORY_KEY = "sermorizer.history.v1";

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** Persist newest-first, capping count and shedding oldest if storage is full. */
function persistHistory(list: HistoryEntry[]): HistoryEntry[] {
  let candidate = list.slice(0, 40);
  for (;;) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(candidate));
      return candidate;
    } catch {
      if (candidate.length <= 1) return candidate; // can't shrink further
      candidate = candidate.slice(0, candidate.length - 1); // drop the oldest
    }
  }
}

/** Fallback title from the generated HTML when the user left the field blank. */
function extractTitle(html: string): string {
  const t = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  if (t && t.trim()) return t.trim();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) return h1.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}

function formatEntryDate(e: HistoryEntry): string {
  if (e.serviceDate) return e.serviceDate;
  try {
    return new Date(e.createdAt).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

type StreamHandlers = {
  /** assembled HTML so far (throttled) */
  onHtml: (html: string) => void;
  /** the model's latest thinking progress, before/while it writes */
  onThinking?: () => void;
};

async function streamRequest(
  payload: unknown,
  handlers: StreamHandlers,
): Promise<string> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) {
    let msg = `Request failed (HTTP ${res.status}).`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* keep default message */
    }
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let html = "";
  let lastEmit = 0;

  const handleLine = (line: string) => {
    if (!line) return;
    let evt: { t?: string; d?: string };
    try {
      evt = JSON.parse(line);
    } catch {
      return;
    }
    if (evt.t === "html") {
      html += evt.d ?? "";
      // Throttle iframe repaints — re-rendering on every token bogs down mobile.
      const now = Date.now();
      if (now - lastEmit > 450) {
        lastEmit = now;
        handlers.onHtml(html);
      }
    } else if (evt.t === "think") {
      handlers.onThinking?.();
    } else if (evt.t === "error") {
      throw new Error(evt.d || "The model reported an error mid-generation.");
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      handleLine(line);
    }
  }
  if (buf.trim()) handleLine(buf);
  handlers.onHtml(html); // always paint the final, complete result
  return html;
}

export default function Page() {
  const [meta, setMeta] = useState<Metadata>(EMPTY_META);
  const [theme, setTheme] = useState<string>("auto");
  const [noteFiles, setNoteFiles] = useState<File[]>([]);
  const [bulletinFiles, setBulletinFiles] = useState<File[]>([]);
  const [transcript, setTranscript] = useState<{ name: string; text: string } | null>(
    null,
  );

  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [docs, setDocs] = useState<Partial<Record<Lang, string>>>({});
  const [live, setLive] = useState<string>("");
  const [activeLang, setActiveLang] = useState<Lang>("ko");
  const [elapsed, setElapsed] = useState<number>(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const busy = status === "generating" || status === "translating";
  const startedAt = useRef<number>(0);
  const previewRef = useRef<HTMLDivElement>(null);

  // Load saved summaries on first mount: from the cloud when configured (so
  // they show on any device), otherwise from this browser's local storage.
  useEffect(() => {
    let cancelled = false;
    if (cloudEnabled()) {
      cloudList()
        .then((list) => {
          if (!cancelled) setHistory(list);
        })
        .catch(() => {
          if (!cancelled) setHistory(loadHistory());
        });
    } else {
      setHistory(loadHistory());
    }
    return () => {
      cancelled = true;
    };
  }, []);

  function commitHistory(updater: (prev: HistoryEntry[]) => HistoryEntry[]) {
    setHistory((prev) => persistHistory(updater(prev)));
  }

  /** Save a new summary to the cloud (or local storage); returns its id. */
  async function addSummary(data: {
    title: string;
    serviceDate?: string;
    occasion?: string;
    docs: Partial<Record<Lang, string>>;
  }): Promise<string> {
    if (cloudEnabled()) {
      try {
        const saved = await cloudInsert(data);
        setHistory((prev) => [saved, ...prev]);
        return saved.id;
      } catch {
        /* fall back to local storage below */
      }
    }
    const entry: HistoryEntry = { id: `${Date.now()}`, createdAt: Date.now(), ...data };
    commitHistory((prev) => [entry, ...prev]);
    return entry.id;
  }

  /** Update an existing summary's documents (e.g. after a translation). */
  async function updateSummaryDocs(id: string, docs: Partial<Record<Lang, string>>) {
    if (cloudEnabled()) {
      setHistory((prev) => prev.map((e) => (e.id === id ? { ...e, docs } : e)));
      try {
        await cloudUpdateDocs(id, docs);
      } catch {
        /* keep the in-memory update even if the cloud write fails */
      }
    } else {
      commitHistory((prev) => prev.map((e) => (e.id === id ? { ...e, docs } : e)));
    }
  }

  /** On a stacked (mobile) layout, bring the preview into view. */
  function revealPreview() {
    if (typeof window !== "undefined" && window.innerWidth <= 900) {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  useEffect(() => {
    if (!busy) return;
    startedAt.current = Date.now();
    setElapsed(0);
    const id = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [busy]);

  function setField(key: keyof Metadata, value: string) {
    setMeta((m) => ({ ...m, [key]: value }));
  }

  function addImages(kind: "note" | "bulletin", list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (kind === "note") setNoteFiles((p) => [...p, ...picked]);
    else setBulletinFiles((p) => [...p, ...picked]);
  }

  function onTranscriptFile(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => setTranscript({ name: file.name, text: String(fr.result ?? "") });
    fr.onerror = () => setStatusMsg(`Could not read ${file.name}.`);
    fr.readAsText(file);
  }

  async function onGenerate() {
    if (!transcript || transcript.text.trim().length < 20) {
      setStatus("error");
      setStatusMsg("Please upload the recorded sermon transcript (.txt file).");
      return;
    }
    const hasBulletin = bulletinFiles.length > 0;
    if (!hasBulletin && !meta.title.trim()) {
      setStatus("error");
      setStatusMsg(
        "Enter a sermon title — or add the order-of-service photo in step 4, and it will be read from there.",
      );
      return;
    }
    if (!hasBulletin && !meta.scripture.trim()) {
      setStatus("error");
      setStatusMsg(
        "Enter the scripture passage — or add the order-of-service photo in step 4, and it will be read from there.",
      );
      return;
    }

    setStatus("generating");
    setStatusMsg("Preparing your materials…");
    setDocs({});
    setLive("");
    setActiveLang("ko");
    setCurrentId(null);
    revealPreview();

    try {
      const noteImages = await Promise.all(noteFiles.map(imageToBase64));
      const bulletinImages = await Promise.all(bulletinFiles.map(imageToBase64));
      setStatusMsg("Claude is reading the sermon and planning the summary…");

      let writing = false;
      const final = await streamRequest(
        {
          mode: "generate",
          metadata: meta,
          theme,
          transcript: transcript.text,
          noteImages,
          bulletinImages,
        },
        {
          onThinking: () => {
            if (!writing) {
              setStatusMsg(
                "Claude is reading & planning the summary… (the preview appears once it starts writing — this can take a minute)",
              );
            }
          },
          onHtml: (html) => {
            if (!writing) {
              writing = true;
              setStatusMsg("Writing the summary — the preview fills in as it writes.");
            }
            setLive(html);
          },
        },
      );

      const html = cleanHtml(final);
      if (!html.toLowerCase().includes("</html>")) {
        setDocs({ ko: html });
        setStatus("error");
        setStatusMsg(
          "Generation seems to have stopped early. The preview is a partial result — please try again.",
        );
        return;
      }
      const id = await addSummary({
        title: meta.title.trim() || extractTitle(html) || "Untitled sermon",
        serviceDate: meta.date.trim() || undefined,
        occasion: meta.occasion.trim() || undefined,
        docs: { ko: html },
      });
      setCurrentId(id);
      setDocs({ ko: html });
      setStatus("done");
      setStatusMsg(
        cloudEnabled()
          ? "Your Korean summary is ready and saved to the web."
          : "Your Korean summary is ready and saved below.",
      );
    } catch (e) {
      setStatus("error");
      setStatusMsg(
        e instanceof Error ? e.message : "Something went wrong during generation.",
      );
    }
  }

  async function onTranslate(lang: "en" | "zh") {
    if (docs[lang]) {
      setActiveLang(lang);
      revealPreview();
      return;
    }
    if (!docs.ko) return;

    setStatus("translating");
    setStatusMsg(
      lang === "en" ? "Translating into English…" : "Translating into Chinese…",
    );
    setLive("");
    setActiveLang(lang);
    revealPreview();

    try {
      let writing = false;
      const final = await streamRequest(
        { mode: "translate", language: lang, sourceHtml: docs.ko },
        {
          onThinking: () => {
            if (!writing) {
              setStatusMsg(
                lang === "en"
                  ? "Working through the English translation…"
                  : "Working through the Chinese translation…",
              );
            }
          },
          onHtml: (html) => {
            if (!writing) {
              writing = true;
              setStatusMsg(
                lang === "en"
                  ? "Writing the English translation — the preview fills in as it writes."
                  : "Writing the Chinese translation — the preview fills in as it writes.",
              );
            }
            setLive(html);
          },
        },
      );
      const html = cleanHtml(final);
      if (!html.toLowerCase().includes("</html>")) {
        setStatus("error");
        setStatusMsg("Translation seems to have stopped early — please try again.");
        return;
      }
      const newDocs = { ...docs, [lang]: html };
      setDocs(newDocs);
      if (currentId) await updateSummaryDocs(currentId, newDocs);
      setStatus("done");
      setStatusMsg(
        lang === "en"
          ? "Your English translation is ready."
          : "Your Chinese translation is ready.",
      );
    } catch (e) {
      setStatus("error");
      setStatusMsg(
        e instanceof Error ? e.message : "Something went wrong during translation.",
      );
    }
  }

  function loadEntry(entry: HistoryEntry) {
    setCurrentId(entry.id);
    setDocs(entry.docs);
    setActiveLang(entry.docs.ko ? "ko" : entry.docs.en ? "en" : "zh");
    setLive("");
    setStatus("done");
    setStatusMsg(`Loaded "${entry.title}".`);
    revealPreview();
  }

  function deleteEntry(id: string) {
    if (cloudEnabled()) {
      setHistory((prev) => prev.filter((e) => e.id !== id));
      cloudDelete(id).catch(() => {});
    } else {
      commitHistory((prev) => prev.filter((e) => e.id !== id));
    }
    if (currentId === id) {
      setCurrentId(null);
      setDocs({});
      setStatus("idle");
      setStatusMsg("");
    }
  }

  function download() {
    const html = docs[activeLang];
    if (!html) return;
    const entry = currentId ? history.find((e) => e.id === currentId) : undefined;
    const date =
      entry?.serviceDate ||
      meta.date.trim() ||
      (entry ? new Date(entry.createdAt).toISOString().slice(0, 10) : "") ||
      new Date().toISOString().slice(0, 10);
    const occ = slug(entry?.occasion || meta.occasion) || "sunday-service";
    const title = slug(entry?.title || meta.title) || "sermon";
    const suffix = activeLang === "en" ? "-EN" : activeLang === "zh" ? "-中文版" : "";
    const name = `${date}-${occ}-${title}${suffix}.html`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const previewHtml = busy ? live : docs[activeLang] ?? "";
  const hasAnyDoc = Boolean(docs.ko);

  return (
    <div className="wrap">
      <header className="app-header">
        <h1>Sermorizer</h1>
        <p>
          Turn a week of sermon materials into one beautiful mobile summary —
          Galilee Church
        </p>
      </header>

      {history.length > 0 && (
        <details className="panel history">
          <summary>Saved summaries ({history.length})</summary>
          {cloudEnabled() && (
            <p className="hist-note">
              Stored online — visible on any device that opens this app.
            </p>
          )}
          <ul className="hist-list">
            {history.map((e) => (
              <li key={e.id} className={e.id === currentId ? "active" : ""}>
                <button
                  type="button"
                  className="hist-open"
                  onClick={() => loadEntry(e)}
                >
                  <span className="hist-title">{e.title}</span>
                  <span className="hist-date">
                    {formatEntryDate(e)} ·{" "}
                    {Object.keys(e.docs)
                      .map((l) => l.toUpperCase())
                      .join(" ")}
                  </span>
                </button>
                <button
                  type="button"
                  className="hist-del"
                  aria-label="delete saved summary"
                  onClick={() => deleteEntry(e.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="layout">
        {/* ---------- Input panel ---------- */}
        <div className="panel">
          <h2>1. Sermon details</h2>
          <p className="hint">
            Enter the sermon&apos;s basic information. You can leave the title and
            scripture blank if you add the order-of-service photo in step 4 —
            they will be read from it.
          </p>

          <div className="field">
            <label>Sermon title</label>
            <input
              type="text"
              value={meta.title}
              placeholder="The title of the sermon"
              onChange={(e) => setField("title", e.target.value)}
            />
          </div>
          <div className="row">
            <div className="field">
              <label>Preacher</label>
              <input
                type="text"
                value={meta.preacher}
                onChange={(e) => setField("preacher", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Scripture passage</label>
              <input
                type="text"
                value={meta.scripture}
                placeholder="e.g. Exodus 20:12"
                onChange={(e) => setField("scripture", e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>
                Service date <span className="opt">(optional)</span>
              </label>
              <input
                type="text"
                value={meta.date}
                placeholder="2026-05-17"
                onChange={(e) => setField("date", e.target.value)}
              />
            </div>
            <div className="field">
              <label>
                Service type <span className="opt">(optional)</span>
              </label>
              <input
                type="text"
                value={meta.serviceType}
                onChange={(e) => setField("serviceType", e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>
              Occasion / liturgical season <span className="opt">(optional)</span>
            </label>
            <input
              type="text"
              value={meta.occasion}
              placeholder="e.g. Teachers' Sunday, Lent, Easter"
              onChange={(e) => setField("occasion", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Color theme</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              {THEMES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <hr className="section-divider" />

          <h2>2. Handwritten note</h2>
          <p className="hint">
            Photo(s) of the notes you wrote during the service (JPG/PNG). They
            are used to highlight the points that mattered most to you.
          </p>
          <label className="drop">
            <strong>+ Add note image(s)</strong>
            <span>You can select multiple</span>
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                addImages("note", e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {noteFiles.length > 0 && (
            <ul className="files">
              {noteFiles.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  <span>{f.name}</span>
                  <button
                    type="button"
                    aria-label="remove"
                    onClick={() =>
                      setNoteFiles((p) => p.filter((_, idx) => idx !== i))
                    }
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <hr className="section-divider" />

          <h2>3. Recorded sermon transcript</h2>
          <p className="hint">A .txt file transcribed with Clova Note or similar.</p>
          <label className="drop">
            <strong>
              {transcript ? "Replace transcript .txt" : "+ Upload transcript .txt"}
            </strong>
            <span>{transcript ? transcript.name : "One .txt file"}</span>
            <input
              type="file"
              accept=".txt,text/plain"
              hidden
              onChange={(e) => {
                onTranscriptFile(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          <hr className="section-divider" />

          <h2>
            4. Order of service <span className="opt">(optional)</span>
          </h2>
          <p className="hint">
            A photo of the printed order of service (주보). If provided, it is
            converted into an HTML table, and any sermon details left blank in
            step 1 are read from it.
          </p>
          <label className="drop">
            <strong>+ Add bulletin image(s)</strong>
            <span>You can select multiple</span>
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                addImages("bulletin", e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {bulletinFiles.length > 0 && (
            <ul className="files">
              {bulletinFiles.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  <span>{f.name}</span>
                  <button
                    type="button"
                    aria-label="remove"
                    onClick={() =>
                      setBulletinFiles((p) => p.filter((_, idx) => idx !== i))
                    }
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <hr className="section-divider" />

          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={onGenerate}
          >
            {status === "generating"
              ? `Generating… (${elapsed}s)`
              : "Generate summary"}
          </button>
        </div>

        {/* ---------- Preview panel ---------- */}
        <div className="panel preview-panel" ref={previewRef}>
          <div className="preview-bar">
            <div className="tabs">
              <button
                type="button"
                className={`tab ${activeLang === "ko" ? "active" : ""}`}
                disabled={!docs.ko || busy}
                onClick={() => setActiveLang("ko")}
              >
                Korean
              </button>
              <button
                type="button"
                className={`tab ${activeLang === "en" ? "active" : ""}`}
                disabled={!docs.en || busy}
                onClick={() => setActiveLang("en")}
              >
                English
              </button>
              <button
                type="button"
                className={`tab ${activeLang === "zh" ? "active" : ""}`}
                disabled={!docs.zh || busy}
                onClick={() => setActiveLang("zh")}
              >
                Chinese
              </button>
            </div>
            <div className="spacer" />
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!docs[activeLang] || busy}
              onClick={download}
            >
              ⬇ Download HTML
            </button>
          </div>

          {statusMsg && (
            <div
              className={`status ${
                status === "error"
                  ? "error"
                  : busy
                    ? "working"
                    : status === "done"
                      ? "done"
                      : "working"
              }`}
            >
              {busy ? `${statusMsg} (${elapsed}s)` : statusMsg}
            </div>
          )}

          {previewHtml ? (
            <iframe
              className="preview-frame"
              title="sermon preview"
              srcDoc={previewHtml}
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="placeholder">
              <div className="big">✝</div>
              <p>
                Fill in the sermon details, handwritten note, and transcript on
                the left, then tap <strong>Generate summary</strong> — the
                preview will appear here.
              </p>
            </div>
          )}

          {hasAnyDoc && !busy && (
            <div className="translate-row">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onTranslate("en")}
              >
                {docs.en ? "View English" : "Translate to English"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onTranslate("zh")}
              >
                {docs.zh ? "View Chinese" : "Translate to Chinese"}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="foot">
        Sermorizer · Sermon summary tool for Galilee Church · Powered by Claude
        (claude-opus-4-7)
      </p>
    </div>
  );
}
