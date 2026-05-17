"use client";

import { useEffect, useRef, useState } from "react";
import { THEMES } from "@/lib/themes";

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

const EMPTY_META: Metadata = {
  title: "",
  preacher: "김영복 담임목사",
  scripture: "",
  date: "",
  occasion: "",
  serviceType: "주일예배",
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
  const MAX = 1800;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", 0.82);
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

async function streamRequest(
  payload: unknown,
  onChunk: (acc: string) => void,
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
  let acc = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
    onChunk(acc);
  }
  return acc;
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

  const busy = status === "generating" || status === "translating";
  const startedAt = useRef<number>(0);

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
    if (!meta.title.trim()) {
      setStatus("error");
      setStatusMsg("설교 제목을 입력해 주세요.");
      return;
    }
    if (!meta.scripture.trim()) {
      setStatus("error");
      setStatusMsg("본문 성경 구절을 입력해 주세요.");
      return;
    }
    if (!transcript || transcript.text.trim().length < 20) {
      setStatus("error");
      setStatusMsg("녹음 설교 전사본(.txt 파일)을 업로드해 주세요.");
      return;
    }

    setStatus("generating");
    setStatusMsg("입력 자료를 준비하고 있습니다…");
    setDocs({});
    setLive("");
    setActiveLang("ko");

    try {
      const noteImages = await Promise.all(noteFiles.map(imageToBase64));
      const bulletinImages = await Promise.all(bulletinFiles.map(imageToBase64));
      setStatusMsg("Claude가 설교 요약본을 작성하고 있습니다…");

      const final = await streamRequest(
        {
          mode: "generate",
          metadata: meta,
          theme,
          transcript: transcript.text,
          noteImages,
          bulletinImages,
        },
        (acc) => setLive(acc),
      );

      const html = cleanHtml(final);
      if (!html.toLowerCase().includes("</html>")) {
        setDocs({ ko: html });
        setStatus("error");
        setStatusMsg(
          "생성이 완료되기 전에 중단된 것 같습니다. 미리보기는 부분 결과입니다. 다시 시도해 주세요.",
        );
        return;
      }
      setDocs({ ko: html });
      setStatus("done");
      setStatusMsg("한국어 요약본이 완성되었습니다.");
    } catch (e) {
      setStatus("error");
      setStatusMsg(e instanceof Error ? e.message : "생성 중 오류가 발생했습니다.");
    }
  }

  async function onTranslate(lang: "en" | "zh") {
    if (docs[lang]) {
      setActiveLang(lang);
      return;
    }
    if (!docs.ko) return;

    setStatus("translating");
    setStatusMsg(
      lang === "en" ? "영어로 번역하고 있습니다…" : "중국어로 번역하고 있습니다…",
    );
    setLive("");
    setActiveLang(lang);

    try {
      const final = await streamRequest(
        { mode: "translate", language: lang, sourceHtml: docs.ko },
        (acc) => setLive(acc),
      );
      const html = cleanHtml(final);
      if (!html.toLowerCase().includes("</html>")) {
        setStatus("error");
        setStatusMsg("번역이 중단된 것 같습니다. 다시 시도해 주세요.");
        return;
      }
      setDocs((d) => ({ ...d, [lang]: html }));
      setStatus("done");
      setStatusMsg(lang === "en" ? "영어 번역본이 완성되었습니다." : "중국어 번역본이 완성되었습니다.");
    } catch (e) {
      setStatus("error");
      setStatusMsg(e instanceof Error ? e.message : "번역 중 오류가 발생했습니다.");
    }
  }

  function download() {
    const html = docs[activeLang];
    if (!html) return;
    const date = meta.date.trim() || new Date().toISOString().slice(0, 10);
    const occ = slug(meta.occasion) || "주일예배";
    const title = slug(meta.title) || "sermon";
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
        <p>주일 설교 자료를 한 편의 아름다운 모바일 요약본으로 — 갈릴리교회</p>
      </header>

      <div className="layout">
        {/* ---------- Input panel ---------- */}
        <div className="panel">
          <h2>1. 설교 정보</h2>
          <p className="hint">설교의 기본 정보를 입력하세요.</p>

          <div className="field">
            <label>설교 제목</label>
            <input
              type="text"
              value={meta.title}
              placeholder="예) 당연한 사랑은 없습니다"
              onChange={(e) => setField("title", e.target.value)}
            />
          </div>
          <div className="row">
            <div className="field">
              <label>설교자</label>
              <input
                type="text"
                value={meta.preacher}
                onChange={(e) => setField("preacher", e.target.value)}
              />
            </div>
            <div className="field">
              <label>본문 성경</label>
              <input
                type="text"
                value={meta.scripture}
                placeholder="예) 출애굽기 20:12"
                onChange={(e) => setField("scripture", e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>
                예배 날짜 <span className="opt">(선택)</span>
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
                예배 종류 <span className="opt">(선택)</span>
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
              절기 / 행사 <span className="opt">(선택)</span>
            </label>
            <input
              type="text"
              value={meta.occasion}
              placeholder="예) 스승의 주일, 사순절, 부활절"
              onChange={(e) => setField("occasion", e.target.value)}
            />
          </div>
          <div className="field">
            <label>색상 테마</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              {THEMES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <hr className="section-divider" />

          <h2>2. 손글씨 노트</h2>
          <p className="hint">
            예배 중 적은 손글씨 메모 사진(JPG/PNG). 중요하게 들은 부분을 강조하는 데
            쓰입니다.
          </p>
          <label className="drop">
            <strong>+ 노트 이미지 추가</strong>
            <span>여러 장 선택 가능</span>
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

          <h2>3. 녹음 설교 전사본</h2>
          <p className="hint">Clova Note 등으로 전사한 .txt 파일.</p>
          <label className="drop">
            <strong>{transcript ? "전사본 .txt 교체" : "+ 전사본 .txt 업로드"}</strong>
            <span>{transcript ? transcript.name : ".txt 파일 1개"}</span>
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
            4. 주보 <span className="opt">(선택)</span>
          </h2>
          <p className="hint">
            인쇄된 예배 순서지(주보) 사진. 있으면 HTML 표로 변환됩니다.
          </p>
          <label className="drop">
            <strong>+ 주보 이미지 추가</strong>
            <span>여러 장 선택 가능</span>
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
              ? `요약본 생성 중… (${elapsed}초)`
              : "요약본 생성하기"}
          </button>
        </div>

        {/* ---------- Preview panel ---------- */}
        <div className="panel preview-panel">
          <div className="preview-bar">
            <div className="tabs">
              <button
                type="button"
                className={`tab ${activeLang === "ko" ? "active" : ""}`}
                disabled={!docs.ko || busy}
                onClick={() => setActiveLang("ko")}
              >
                한국어
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
                中文
              </button>
            </div>
            <div className="spacer" />
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!docs[activeLang] || busy}
              onClick={download}
            >
              ⬇ HTML 다운로드
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
              {busy ? `${statusMsg} (${elapsed}초)` : statusMsg}
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
                왼쪽에 설교 정보·손글씨 노트·전사본을 입력하고
                <br />
                <strong>요약본 생성하기</strong>를 누르면
                <br />
                여기에 미리보기가 표시됩니다.
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
                {docs.en ? "English 보기" : "English 번역"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onTranslate("zh")}
              >
                {docs.zh ? "中文 보기" : "中文 (简体) 번역"}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="foot">
        Sermorizer · 갈릴리교회 설교 요약 도구 · Claude (claude-opus-4-7) 기반
      </p>
    </div>
  );
}
