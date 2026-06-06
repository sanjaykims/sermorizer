/* Shared helpers used by both client and server. Kept dependency-free so it
   ships into the smallest bundle possible. */

const ENTITY: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function slug(s: string, fallback = "sermon"): string {
  const out = (s || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return out || fallback;
}

export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeXml(s: string): string {
  return escapeHtml(s).replace(/'/g, "&apos;");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ENTITY[e] ?? "")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return "";
      }
    });
}

/** Pull a human-friendly title from a generated HTML document: <h1> first
 *  (decodes entities), then <title>, rejecting obvious placeholders. */
export function extractHtmlTitle(html: string): string {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) {
    const text = decodeEntities(
      h1.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    );
    if (text) return text;
  }
  const t = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  if (t) {
    const text = decodeEntities(t.trim());
    if (text && !/^(sermon|summary|sermon summary|untitled)$/i.test(text)) {
      return text;
    }
  }
  return "";
}
