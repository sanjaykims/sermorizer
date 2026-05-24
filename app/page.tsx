"use client";

import { useEffect, useRef, useState } from "react";
import { THEMES } from "@/lib/themes";
import {
  cloudEnabled,
  cloudList,
  cloudGet,
  cloudDelete,
  type Lang,
  type Summary,
} from "@/lib/summaries";

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
  // Higher resolution = more accurate OCR of the Korean handwriting (a key
  // quality input). Capped at 2048px / q0.85 to stay under the upload limit.
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

function slug(s: string): string {
  return (s || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function downloadBlob(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fileName(
  parts: { title?: string; occasion?: string; date?: string; createdAt?: number },
  lang: Lang,
): string {
  const date =
    parts.date?.trim() ||
    (parts.createdAt ? new Date(parts.createdAt).toISOString().slice(0, 10) : "") ||
    new Date().toISOString().slice(0, 10);
  const occ = slug(parts.occasion || "") || "sunday-service";
  const title = slug(parts.title || "") || "sermon";
  const suffix = lang === "en" ? "-EN" : lang === "zh" ? "-中文版" : "";
  return `${date}-${occ}-${title}${suffix}.html`;
}

/* ---- Local cache (metadata only) — a fallback when the cloud is unreachable ---- */

const CACHE_KEY = "sermorizer.history.v2";

function loadCache(): Summary[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Summary[]) : [];
  } catch {
    return [];
  }
}

function saveCache(list: Summary[]) {
  try {
    // Store metadata only (no large HTML) so the cache always fits.
    const lite = list
      .slice(0, 60)
      .map(({ docs: _docs, ...rest }) => ({ ...rest, docs: {} }));
    localStorage.setItem(CACHE_KEY, JSON.stringify(lite));
  } catch {
    /* quota or unavailable — fine, cache is optional */
  }
}

function formatEntryDate(e: Summary): string {
  if (e.serviceDate) return e.serviceDate;
  try {
    return new Date(e.createdAt).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function upsert(list: Summary[], row: Summary): Summary[] {
  return list.some((e) => e.id === row.id)
    ? list.map((e) => (e.id === row.id ? row : e))
    : [row, ...list];
}

/* ---- Completion alerts (sound / vibration / notification / tab title) ---- */

const APP_TITLE = "Sermorizer — Sermon Summary Tool";
let audioCtx: AudioContext | null = null;

/** Create/resume the audio context during a user gesture so a chime can play later. */
function primeAlerts() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (Ctx) {
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended") void audioCtx.resume();
    }
  } catch {
    /* audio unavailable */
  }
  try {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    /* notifications unavailable */
  }
}

function playChime(ok: boolean) {
  if (!audioCtx) return;
  try {
    const ctx = audioCtx;
    const now = ctx.currentTime;
    const notes = ok ? [880, 1174.66] : [392, 311.13];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.42);
    });
  } catch {
    /* ignore */
  }
}

/** Fire every available "finished" cue. `message` is short, for the notification. */
function announce(message: string, ok: boolean) {
  playChime(ok);
  try {
    navigator.vibrate?.(ok ? [180, 90, 180] : [90, 60, 90, 60, 90]);
  } catch {
    /* vibration unsupported (e.g. iOS) */
  }
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Sermorizer", { body: message, icon: "/icon" });
      }
    } catch {
      /* ignore */
    }
    document.title = `${ok ? "✅" : "⚠️"} ${message}`;
    const restore = () => {
      document.title = APP_TITLE;
      document.removeEventListener("visibilitychange", restore);
    };
    document.addEventListener("visibilitychange", restore);
  }
}

type Job = { id: string; kind: "generate" | "translate"; lang?: Lang };

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
  const [activeLang, setActiveLang] = useState<Lang>("ko");
  const [elapsed, setElapsed] = useState<number>(0);
  const [history, setHistory] = useState<Summary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const busy = status === "generating" || status === "translating";
  const startedAt = useRef<number>(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobRef = useRef<Job | null>(null);

  function applyHistory(updater: (prev: Summary[]) => Summary[]) {
    setHistory((prev) => {
      const next = updater(prev);
      saveCache(next);
      return next;
    });
  }

  function revealPreview() {
    if (typeof window !== "undefined" && window.innerWidth <= 900) {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    jobRef.current = null;
  }

  async function pollOnce(job: Job) {
    let row: Summary | null;
    try {
      row = await cloudGet(job.id);
    } catch {
      return; // transient network error — keep polling
    }
    if (!row) return;
    applyHistory((prev) => upsert(prev, row!));

    if (row.status === "done") {
      stopPolling();
      // Only swap the preview if this job is still the one being viewed.
      if (currentIdRef.current === job.id) {
        setDocs(row.docs);
        setActiveLang(
          job.kind === "translate" && job.lang
            ? job.lang
            : row.docs.ko
              ? "ko"
              : row.docs.en
                ? "en"
                : "zh",
        );
        setStatus("done");
        setStatusMsg(
          job.kind === "translate"
            ? "Your translation is ready."
            : "Your summary is ready and saved to the web.",
        );
      }
      announce(
        job.kind === "translate"
          ? "Your translation is ready."
          : "Your sermon summary is ready.",
        true,
      );
    } else if (row.status === "error") {
      stopPolling();
      if (currentIdRef.current === job.id) {
        setStatus("error");
        setStatusMsg(row.error || "It didn't finish — please try again.");
      }
      announce("It didn't finish — please try again.", false);
    }
  }

  function startPolling(job: Job) {
    stopPolling();
    jobRef.current = job;
    pollRef.current = setInterval(() => void pollOnce(job), 3000);
    void pollOnce(job);
  }

  // Keep a ref of currentId so the polling closure always sees the latest value.
  const currentIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  // Load saved summaries on mount; resume polling anything still in progress.
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      let list: Summary[] = [];
      if (cloudEnabled()) {
        try {
          list = await cloudList();
        } catch {
          list = loadCache();
        }
      } else {
        list = loadCache();
      }
      if (cancelled) return;
      setHistory(list);
      saveCache(list);
      const pending = list.find(
        (e) => e.status === "generating" || e.status === "translating",
      );
      if (pending) {
        setCurrentId(pending.id);
        currentIdRef.current = pending.id;
        setStatus(pending.status === "translating" ? "translating" : "generating");
        setStatusMsg("Picking up a summary that was still being generated…");
        startPolling({
          id: pending.id,
          kind: pending.status === "translating" ? "translate" : "generate",
        });
      }
    };
    void init();
    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the app returns to the foreground, poll immediately for a fast catch-up.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && jobRef.current) {
        void pollOnce(jobRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Elapsed-time counter while a job is running.
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

    primeAlerts();
    stopPolling();
    setStatus("generating");
    setStatusMsg("Preparing your materials…");
    setDocs({});
    setCurrentId(null);
    currentIdRef.current = null;
    setActiveLang("ko");
    revealPreview();

    try {
      const noteImages = await Promise.all(noteFiles.map(imageToBase64));
      const bulletinImages = await Promise.all(bulletinFiles.map(imageToBase64));
      setStatusMsg("Starting generation…");

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate",
          metadata: meta,
          theme,
          transcript: transcript.text,
          noteImages,
          bulletinImages,
        }),
      });
      if (!res.ok) {
        let msg = `Request failed (HTTP ${res.status}).`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* keep default */
        }
        throw new Error(msg);
      }
      const { id } = (await res.json()) as { id: string };
      setCurrentId(id);
      currentIdRef.current = id;
      setStatusMsg(
        "Claude is writing the summary on the server — you can lock your phone or switch apps; it keeps working. You'll be alerted when it's ready.",
      );
      startPolling({ id, kind: "generate" });
    } catch (e) {
      setStatus("error");
      setStatusMsg(
        e instanceof Error ? e.message : "Something went wrong starting generation.",
      );
      announce("Generation didn't start — please try again.", false);
    }
  }

  async function onTranslate(lang: "en" | "zh") {
    if (docs[lang]) {
      setActiveLang(lang);
      revealPreview();
      return;
    }
    if (!docs.ko || !currentId) return;

    primeAlerts();
    stopPolling();
    setStatus("translating");
    setStatusMsg("Starting translation…");
    setActiveLang(lang);
    revealPreview();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "translate",
          id: currentId,
          language: lang,
          sourceHtml: docs.ko,
        }),
      });
      if (!res.ok) {
        let msg = `Request failed (HTTP ${res.status}).`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* keep default */
        }
        throw new Error(msg);
      }
      await res.json();
      setStatusMsg(
        "Translating on the server — you can switch away; it keeps working and will alert you when done.",
      );
      startPolling({ id: currentId, kind: "translate", lang });
    } catch (e) {
      setStatus("error");
      setStatusMsg(
        e instanceof Error ? e.message : "Something went wrong starting translation.",
      );
      announce("Translation didn't start — please try again.", false);
    }
  }

  /** Download a past summary's file directly — no in-app viewing. */
  async function downloadEntry(entry: Summary, lang: Lang) {
    let html = entry.docs?.[lang];
    if (!html) {
      try {
        const r = await cloudGet(entry.id);
        html = r?.docs?.[lang];
      } catch {
        /* leave undefined */
      }
    }
    if (!html) return;
    downloadBlob(html, fileName(entry, lang));
  }

  function deleteEntry(id: string) {
    applyHistory((prev) => prev.filter((e) => e.id !== id));
    if (cloudEnabled()) cloudDelete(id).catch(() => {});
    if (currentId === id) {
      stopPolling();
      setCurrentId(null);
      currentIdRef.current = null;
      setDocs({});
      setStatus("idle");
      setStatusMsg("");
    }
  }

  function download() {
    const html = docs[activeLang];
    if (!html) return;
    const entry = currentId ? history.find((e) => e.id === currentId) : undefined;
    downloadBlob(
      html,
      fileName(
        {
          title: entry?.title || meta.title,
          occasion: entry?.occasion || meta.occasion,
          date: entry?.serviceDate || meta.date,
          createdAt: entry?.createdAt,
        },
        activeLang,
      ),
    );
  }

  const previewHtml = docs[activeLang] ?? "";
  const hasAnyDoc = Boolean(docs.ko || docs.en || docs.zh);

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
          <summary>Download a past summary ({history.length})</summary>
          <p className="hist-note">
            Past summaries aren&apos;t displayed — tap a language to download the
            file.
          </p>
          <ul className="hist-list">
            {history.map((e) => {
              const inProgress =
                e.status === "generating" || e.status === "translating";
              const langs = (["ko", "en", "zh"] as Lang[]).filter(
                (l) => e.docs?.[l],
              );
              return (
                <li key={e.id}>
                  <div className="hist-meta">
                    <span className="hist-title">{e.title}</span>
                    <span className="hist-date">{formatEntryDate(e)}</span>
                  </div>
                  <div className="hist-actions">
                    {inProgress ? (
                      <span className="hist-tag">generating…</span>
                    ) : e.status === "error" ? (
                      <span className="hist-tag">failed</span>
                    ) : langs.length > 0 ? (
                      langs.map((l) => (
                        <button
                          key={l}
                          type="button"
                          className="hist-dl"
                          onClick={() => downloadEntry(e, l)}
                        >
                          ⬇ {l.toUpperCase()}
                        </button>
                      ))
                    ) : (
                      <span className="hist-tag">no file</span>
                    )}
                    <button
                      type="button"
                      className="hist-del"
                      aria-label="delete saved summary"
                      onClick={() => deleteEntry(e.id)}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
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
            A photo of the printed order of service (주보). It is used only to
            read any sermon details you left blank in step 1 (title, preacher,
            scripture, date) — it won&apos;t appear in the summary, which is the
            sermon only.
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

          {busy ? (
            <div className="placeholder">
              <div className="big">⏳</div>
              <p>
                Working on the server — this can take 1–3 minutes.
                <br />
                You can lock your phone or switch apps; it won&apos;t stop.
              </p>
            </div>
          ) : previewHtml ? (
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
