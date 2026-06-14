"use client";

import { useEffect, useRef, useState } from "react";
import { THEMES } from "@/lib/themes";
import {
  cloudEnabled,
  cloudList,
  cloudGet,
  cloudUpdate,
  cloudDelete,
  type Lang,
  type Summary,
} from "@/lib/summaries";
import { ENHANCE_LAYOUT_CSS } from "@/lib/enhance";
import { slug, escapeHtml, downloadBlob, extractHtmlTitle } from "@/lib/util";
import dynamic from "next/dynamic";
import AuthGate from "./AuthGate";

// Lazy-load the book panel so it isn't shipped in the initial bundle.
const BookPanel = dynamic(() => import("./BookPanel"), { ssr: false, loading: () => null });

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

// Largest PDF note we'll send inline (base64). A handwritten-note scan is tiny;
// this just guards against someone attaching a huge document.
const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Read a PDF File as base64 for a Claude `document` block (no downscaling). */
async function pdfToBase64(file: File): Promise<ImagePayload> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(
      `${file.name} is too large (max 20 MB). Please attach a smaller PDF or photos.`,
    );
  }
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error(`Could not read ${file.name}`));
    fr.readAsDataURL(file);
  });
  return { media_type: "application/pdf", data: dataUrl.split(",")[1] ?? "" };
}

/** Convert a note/bulletin File to a payload — PDFs go through as documents,
 *  everything else is treated as a (downscaled) image. */
async function fileToPayload(file: File): Promise<ImagePayload> {
  return file.type === "application/pdf" ? pdfToBase64(file) : imageToBase64(file);
}

function fileName(
  parts: { title?: string; occasion?: string; date?: string; createdAt?: number },
  lang: Lang,
): string {
  const date =
    parts.date?.trim() ||
    (parts.createdAt ? new Date(parts.createdAt).toISOString().slice(0, 10) : "") ||
    new Date().toISOString().slice(0, 10);
  const occ = slug(parts.occasion || "", "sunday-service");
  const title = slug(parts.title || "", "sermon");
  const suffix = lang === "en" ? "-EN" : lang === "zh" ? "-中文版" : "";
  return `${date}-${occ}-${title}${suffix}.html`;
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

let titleRestore: (() => void) | null = null;

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
    // Remove any prior pending restorer so listeners can't stack up across
    // multiple completions while the tab stays hidden.
    if (titleRestore) titleRestore();
    document.title = `${ok ? "✅" : "⚠️"} ${message}`;
    const restore = () => {
      document.title = APP_TITLE;
      document.removeEventListener("visibilitychange", restore);
      titleRestore = null;
    };
    titleRestore = restore;
    document.addEventListener("visibilitychange", restore);
  }
}

/** Self-contained "(Ns)" ticker — owns its own 1Hz state so the parent tree
 *  doesn't re-render every second while a job runs. */
function ElapsedTimer() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setS(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return <>({s}s)</>;
}

/* ---- Split generation: chunk a long transcript into multiple parts ---- */

// Above this transcript size, one generation risks exceeding the 300s server
// limit, so we split into parts of roughly this many characters each. (The
// proofreading pre-pass runs on the single-call path only — on the split
// path it's skipped so each part fits the time budget.)
const SPLIT_TRANSCRIPT_CHARS = 16000;
const STEP_TIMEOUT_MS = 330_000;

/** Read a non-2xx fetch Response and surface the server's `error` message if any. */
async function readErr(res: Response): Promise<string> {
  let msg = `Request failed (HTTP ${res.status}).`;
  try {
    const j = (await res.json()) as { error?: string };
    if (j?.error) msg = j.error;
  } catch {
    /* keep default */
  }
  return msg;
}

function splitTranscript(text: string, n: number): string[] {
  const lines = text.split(/\r?\n/);
  const per = Math.ceil(lines.length / n);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const slice = lines.slice(i * per, (i + 1) * per).join("\n").trim();
    if (slice) out.push(slice);
  }
  return out.length ? out : [text];
}

/** Merge each part's #sermon-body into part 0's document → one continuous file,
 *  with a sticky tab table-of-contents and a numbered at-a-glance summary. */
function stitchParts(parts: Record<string, string>, n: number): string {
  const part0 = parts["0"];
  if (!part0) return "";
  const parser = new DOMParser();
  const base = parser.parseFromString(part0, "text/html");
  const body = base.querySelector("#sermon-body");
  if (!body) {
    throw new Error(
      'Stitching failed: part 1 is missing the <div id="sermon-body"> wrapper. Please try again.',
    );
  }

  for (let k = 1; k < n; k++) {
    const html = parts[String(k)];
    if (!html) continue;
    const d = parser.parseFromString(html, "text/html");
    const b = d.querySelector("#sermon-body");
    if (b) body.insertAdjacentHTML("beforeend", b.innerHTML);
  }

  // Renumber sections and collect the table of contents.
  const sections = Array.from(body.querySelectorAll("section"));
  const toc: { id: string; title: string }[] = [];
  sections.forEach((sec, i) => {
    const id = `sec-${i + 1}`;
    sec.id = id;
    const titleEl = sec.querySelector(".sec-title") ?? sec.querySelector("h2, h3");
    const title = (titleEl?.textContent ?? `Section ${i + 1}`).trim();
    toc.push({ id, title });
  });

  // Sticky tab bar: one link per section (tap to jump) + the summary.
  const tocEl = base.querySelector(".toc, #toc, nav.toc");
  if (tocEl && toc.length) {
    tocEl.innerHTML =
      toc.map((t) => `<a href="#${t.id}">${escapeHtml(t.title)}</a>`).join("") +
      `<a href="#summary">한눈에 보기</a>`;
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
  if (head && !base.getElementById("sermorizer-layout")) {
    const style = base.createElement("style");
    style.id = "sermorizer-layout";
    style.textContent = ENHANCE_LAYOUT_CSS;
    head.appendChild(style);
  }

  return "<!DOCTYPE html>\n" + base.documentElement.outerHTML;
}

/** Poll a row until `predicate` is true, throwing on error/timeout. */
async function waitForRow(
  id: string,
  predicate: (r: Summary) => boolean,
  timeoutMs = STEP_TIMEOUT_MS,
): Promise<Summary> {
  const start = Date.now();
  for (;;) {
    let row: Summary | null = null;
    try {
      row = await cloudGet(id);
    } catch {
      /* transient — keep waiting */
    }
    if (row) {
      if (row.status === "error") throw new Error(row.error || "Generation failed.");
      if (predicate(row)) return row;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("A part took longer than the server allows. Please try again.");
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

type Job = { id: string; kind: "generate" | "translate"; lang?: Lang };

export default function Page() {
  return (
    <AuthGate>
      <Sermorizer />
    </AuthGate>
  );
}

function Sermorizer() {
  const [meta, setMeta] = useState<Metadata>(EMPTY_META);
  const [theme, setTheme] = useState<string>("auto");
  const [noteFiles, setNoteFiles] = useState<File[]>([]);
  const [bulletinFiles, setBulletinFiles] = useState<File[]>([]);
  const [transcript, setTranscript] = useState<{ name: string; text: string } | null>(
    null,
  );
  // Have Claude proofread the Clova Note transcript before summarizing. On by
  // default; turning it off is faster/cheaper when the transcript is already clean.
  const [proofread, setProofread] = useState<boolean>(true);

  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [docs, setDocs] = useState<Partial<Record<Lang, string>>>({});
  const [activeLang, setActiveLang] = useState<Lang>("ko");
  const [history, setHistory] = useState<Summary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  // List-row translations: `${entryId}:${lang}` keys currently in flight.
  const [entryTranslating, setEntryTranslating] = useState<Set<string>>(new Set());
  const entryTranslateStartsRef = useRef<Map<string, number>>(new Map());

  const busy = status === "generating" || status === "translating";
  const previewRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jobRef = useRef<Job | null>(null);

  // Safety net: if a job never reports done/error within this window, the
  // server almost certainly hit its time limit and died without recording a
  // result. Surface it as a failure instead of spinning forever. (Server limit
  // is 300s; allow a 30s buffer.)
  const JOB_TIMEOUT_MS = 330_000;

  function revealPreview() {
    if (typeof window !== "undefined" && window.innerWidth <= 900) {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
    jobRef.current = null;
  }

  async function onJobTimeout(job: Job) {
    if (jobRef.current?.id !== job.id) return;
    // The work may actually have completed — verify before declaring failure,
    // so a finished summary/translation is never mismarked as "error".
    try {
      const row = await cloudGet(job.id);
      const haveResult =
        job.kind === "translate"
          ? Boolean(job.lang && row?.docs?.[job.lang])
          : Boolean(row?.docs?.ko);
      if (row && (row.status === "done" || haveResult)) {
        stopPolling();
        setHistory((prev) => upsert(prev, { ...row, status: "done" }));
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
        if (row.status !== "done") {
          cloudUpdate(job.id, { status: "done", error: null }).catch(() => {});
        }
        return;
      }
    } catch {
      /* fall through to the genuine-timeout path */
    }

    if (jobRef.current?.id !== job.id) return;
    stopPolling();
    if (currentIdRef.current === job.id) {
      setStatus("error");
      setStatusMsg(
        "This took longer than the server allows (~5 min) and was stopped. The sermon may be very long — please try again.",
      );
    }
    announce("It didn't finish in time — please try again.", false);
    setHistory((prev) =>
      prev.map((e) =>
        e.id === job.id ? { ...e, status: "error", error: "Timed out." } : e,
      ),
    );
    cloudUpdate(job.id, {
      status: "error",
      error: "Timed out — generation exceeded the server time limit.",
    }).catch(() => {});
  }

  async function pollOnce(job: Job) {
    let row: Summary | null;
    try {
      row = await cloudGet(job.id);
    } catch {
      return; // transient network error — keep polling
    }
    if (!row) return;
    setHistory((prev) => upsert(prev, row!));

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
    timeoutRef.current = setTimeout(() => void onJobTimeout(job), JOB_TIMEOUT_MS);
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
      try {
        list = await cloudList();
      } catch {
        /* keep empty list on cloud-unreachable */
      }
      if (cancelled) return;
      setHistory(list);
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

  // Poll any list-row translations the user kicked off until each one is
  // done, fails, or trips the per-job timeout. Runs alongside the main
  // jobRef pipeline so the preview panel keeps working independently.
  useEffect(() => {
    if (entryTranslating.size === 0) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      for (const key of Array.from(entryTranslating)) {
        const [id, langStr] = key.split(":");
        const lang = langStr as Lang;
        const started = entryTranslateStartsRef.current.get(key) ?? Date.now();
        if (Date.now() - started > STEP_TIMEOUT_MS) {
          entryTranslateStartsRef.current.delete(key);
          setEntryTranslating((prev) => {
            const n = new Set(prev);
            n.delete(key);
            return n;
          });
          announce(
            `${lang === "en" ? "English" : "Chinese"} translation took too long — please try again.`,
            false,
          );
          continue;
        }
        try {
          const row = await cloudGet(id);
          if (!row) continue;
          if (row.docs?.[lang]) {
            entryTranslateStartsRef.current.delete(key);
            setEntryTranslating((prev) => {
              const n = new Set(prev);
              n.delete(key);
              return n;
            });
            setHistory((prev) => upsert(prev, row));
            announce(
              `Your ${lang === "en" ? "English" : "Chinese"} translation is ready.`,
              true,
            );
          } else if (row.status === "error") {
            entryTranslateStartsRef.current.delete(key);
            setEntryTranslating((prev) => {
              const n = new Set(prev);
              n.delete(key);
              return n;
            });
            announce(
              `${lang === "en" ? "English" : "Chinese"} translation didn't finish — please try again.`,
              false,
            );
          }
        } catch {
          /* transient network error — keep polling */
        }
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [entryTranslating]);


  function setField(key: keyof Metadata, value: string) {
    setMeta((m) => ({ ...m, [key]: value }));
  }

  function addImages(kind: "note" | "bulletin", list: FileList | null) {
    if (!list) return;
    // Notes may be photos or a PDF scan; the bulletin stays photos-only.
    const allowed = (f: File) =>
      f.type.startsWith("image/") ||
      (kind === "note" && f.type === "application/pdf");
    const picked = Array.from(list).filter(allowed);
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
      const noteImages = await Promise.all(noteFiles.map(fileToPayload));
      const bulletinImages = await Promise.all(bulletinFiles.map(imageToBase64));

      // Long sermons are split into parts that each fit the 300s server limit,
      // then stitched into one continuous file. The proofreading pass runs on
      // the single-call path only — too slow to fit alongside per-part HTML
      // generation in 300s — so we skip it when we split.
      const nParts = Math.ceil(transcript.text.length / SPLIT_TRANSCRIPT_CHARS);
      if (nParts > 1) {
        await runSplitGeneration(transcript.text, nParts, noteImages, bulletinImages);
        return;
      }

      setStatusMsg(
        proofread ? "Proofreading the transcript, then writing…" : "Starting generation…",
      );
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
          proofread,
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
        (proofread
          ? "Claude is proofreading the transcript, then writing the summary, on the server"
          : "Claude is writing the summary on the server") +
          " — you can lock your phone or switch apps; it keeps working. You'll be alerted when it's ready.",
      );
      startPolling({ id, kind: "generate" });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Something went wrong starting generation.";
      setStatus("error");
      setStatusMsg(msg);
      announce("Generation didn't finish — please try again.", false);
      if (currentIdRef.current) {
        cloudUpdate(currentIdRef.current, { status: "error", error: msg }).catch(() => {});
      }
    }
  }

  /** Generate a long sermon in parts (each under the time limit) and stitch them. */
  async function runSplitGeneration(
    text: string,
    requestedParts: number,
    noteImages: ImagePayload[],
    bulletinImages: ImagePayload[],
  ) {
    const slices = splitTranscript(text, requestedParts);
    const n = slices.length;
    let id: string | null = null;
    let workingSlices = slices;

    // Phase 1 (optional): proofread every slice in parallel, then read the
    // cleaned text back from Supabase. Each server call is a single Opus
    // pass on one slice — well within the 300s function limit. Parallelism
    // keeps wall time at ~one slice's worth instead of N.
    if (proofread) {
      setStatusMsg(
        `Long sermon — proofreading ${n} parts in parallel on the server…`,
      );
      // The first proofread call creates the row; later ones reference it.
      // Kick off part 0 first so we have an id, then fan out the rest.
      const firstRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "proofread",
          id: null,
          partIndex: 0,
          partCount: n,
          metadata: meta,
          transcript: slices[0],
        }),
      });
      if (!firstRes.ok) throw new Error(await readErr(firstRes));
      const firstJson = (await firstRes.json()) as { id: string };
      id = firstJson.id;
      setCurrentId(id);
      currentIdRef.current = id;

      if (n > 1) {
        const fanout = slices.slice(1).map((slice, idx) =>
          fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "proofread",
              id,
              partIndex: idx + 1,
              partCount: n,
              metadata: meta,
              transcript: slice,
            }),
          }).then(async (r) => {
            if (!r.ok) throw new Error(await readErr(r));
            return r.json();
          }),
        );
        await Promise.all(fanout);
      }

      // Wait until every cleaned slice is back; preserve the original on any
      // slice that failed/timed out so we never lose content.
      setStatusMsg(`Proofreading on the server (${n} parts)…`);
      const ready = await waitForRow(id, (r) => {
        const pp = r.proofreadParts ?? {};
        return Object.keys(pp).length >= n;
      });
      const cleaned = ready.proofreadParts ?? {};
      workingSlices = slices.map((s, k) => cleaned[String(k)] || s);
    }

    // Phase 2: per-part HTML generation, sequential as today. Each is a
    // single Opus pass on a (possibly proofread) slice.
    for (let k = 0; k < n; k++) {
      setStatusMsg(
        `Long sermon — writing part ${k + 1} of ${n} on the server… (you can switch away; it keeps working)`,
      );
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "part",
          id,
          partIndex: k,
          partCount: n,
          metadata: meta,
          theme,
          transcript: workingSlices[k],
          noteImages,
          bulletinImages: k === 0 ? bulletinImages : [],
          // Proofreading already ran in phase 1 (if enabled); never proofread again here.
          proofread: false,
        }),
      });
      if (!res.ok) throw new Error(await readErr(res));
      const j = (await res.json()) as { id: string };
      id = j.id;
      if (k === 0 && !currentIdRef.current) {
        setCurrentId(id);
        currentIdRef.current = id;
      }
      await waitForRow(id, (r) => Boolean(r.parts?.[String(k)]));
    }

    setStatusMsg("Assembling the parts into one document…");
    const finalRow = await cloudGet(id!);
    const combined = stitchParts(finalRow?.parts ?? {}, n);
    if (!combined.toLowerCase().includes("</html>")) {
      throw new Error("Could not assemble the parts. Please try again.");
    }
    const title = meta.title.trim() || extractHtmlTitle(combined) || "Untitled sermon";
    await cloudUpdate(id!, { docs: { ko: combined }, title, status: "done", error: null });

    setDocs({ ko: combined });
    setActiveLang("ko");
    setStatus("done");
    setStatusMsg(`Your summary is ready — assembled from ${n} parts — and saved to the web.`);
    announce("Your sermon summary is ready.", true);
    setHistory((prev) =>
      upsert(prev, {
        id: id!,
        title,
        createdAt: finalRow?.createdAt ?? Date.now(),
        serviceDate: meta.date.trim() || undefined,
        occasion: meta.occasion.trim() || undefined,
        docs: { ko: combined },
        status: "done",
      }),
    );
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
    downloadBlob(
      new Blob([html], { type: "text/html;charset=utf-8" }),
      fileName(entry, lang),
    );
  }

  /** Kick off a translation of a PAST summary in the history list. The Korean
   *  HTML is the source of truth; the new language is appended to the row.
   *  Runs alongside any active job — the user can keep working with what's on
   *  the preview panel. Multiple list-row translations can be in flight at
   *  once across DIFFERENT entries; we serialize per-entry to avoid the
   *  read-merge-write race when EN and ZH would both write to the same row. */
  async function translateEntry(entry: Summary, lang: "en" | "zh") {
    const key = `${entry.id}:${lang}`;
    if (entryTranslating.has(key)) return;
    if (entry.docs?.[lang]) return;

    let ko = entry.docs?.ko;
    if (!ko) {
      try {
        const r = await cloudGet(entry.id);
        ko = r?.docs?.ko;
      } catch {
        /* leave undefined */
      }
    }
    if (!ko) {
      setStatusMsg(
        "This summary has no Korean version to translate from — please re-generate it first.",
      );
      return;
    }

    primeAlerts();
    entryTranslateStartsRef.current.set(key, Date.now());
    setEntryTranslating((prev) => new Set(prev).add(key));

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "translate",
          id: entry.id,
          language: lang,
          sourceHtml: ko,
        }),
      });
      if (!res.ok) throw new Error(await readErr(res));
      await res.json();
    } catch (e) {
      entryTranslateStartsRef.current.delete(key);
      setEntryTranslating((prev) => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
      announce(
        e instanceof Error
          ? e.message
          : "Translation didn't start — please try again.",
        false,
      );
    }
  }

  function deleteEntry(id: string) {
    setHistory((prev) => prev.filter((e) => e.id !== id));
    if (cloudEnabled()) cloudDelete(id).catch(() => {});
    // Clear any list-row translations still tracked for this id.
    setEntryTranslating((prev) => {
      const n = new Set<string>();
      for (const k of prev) if (!k.startsWith(`${id}:`)) n.add(k);
      return n;
    });
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
      new Blob([html], { type: "text/html;charset=utf-8" }),
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
                    {/* Show downloads whenever files exist — even if the row was
                        mistakenly marked failed — so nothing usable is hidden. */}
                    {langs.length > 0 ? (
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
                    ) : inProgress ? (
                      <span className="hist-tag">generating…</span>
                    ) : e.status === "error" ? (
                      <span className="hist-tag">failed</span>
                    ) : (
                      <span className="hist-tag">no file</span>
                    )}
                    {/* Translate buttons for languages this row doesn't yet
                        have — only when a Korean source exists. We serialize
                        per-entry (disable the other target while one is in
                        flight) so concurrent docs writes can't race. */}
                    {e.docs?.ko && !inProgress &&
                      (["en", "zh"] as const).map((l) => {
                        if (e.docs?.[l]) return null;
                        const k = `${e.id}:${l}`;
                        const pending = entryTranslating.has(k);
                        const otherPending = entryTranslating.has(
                          `${e.id}:${l === "en" ? "zh" : "en"}`,
                        );
                        return (
                          <button
                            key={`t-${l}`}
                            type="button"
                            className="hist-tr"
                            disabled={pending || otherPending}
                            onClick={() => translateEntry(e, l)}
                          >
                            {pending
                              ? `Translating ${l.toUpperCase()}…`
                              : `+ ${l.toUpperCase()}`}
                          </button>
                        );
                      })}
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

      {history.length > 0 && <BookPanel summaries={history} />}

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
            Photo(s) or a PDF of the notes you wrote during the service
            (JPG/PNG/PDF). They are used to highlight the points that mattered
            most to you.
          </p>
          <label className="drop">
            <strong>+ Add note image(s) or PDF</strong>
            <span>Photos or a PDF — you can select multiple</span>
            <input
              type="file"
              accept="image/*,application/pdf,.pdf"
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

          <label className="proofread-toggle">
            <input
              type="checkbox"
              checked={proofread}
              disabled={busy}
              onChange={(e) => setProofread(e.target.checked)}
            />
            <span>
              <strong>Proofread the transcript first</strong>
              <small>
                Claude cleans up the Clova Note transcript — fixing misheard
                words, the pastor&apos;s name, and Bible references — before
                writing the summary. More accurate; takes a bit longer.
                For very long sermons the proofreading runs in parallel
                across parts, so the extra wait is roughly the same as one
                part&apos;s worth.
              </small>
            </span>
          </label>

          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={onGenerate}
          >
            {status === "generating" ? (
              <>Generating… <ElapsedTimer /></>
            ) : (
              "Generate summary"
            )}
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
              {statusMsg} {busy && <ElapsedTimer />}
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
