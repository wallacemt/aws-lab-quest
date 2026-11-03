import { BLOB_MIN_LENGTH } from "@/lib/rich-text-constants";

export type StatementSegment =
  | { type: "prose"; text: string }
  | { type: "code"; language: "json" | "text"; text: string }
  | { type: "blob"; text: string };

const blobToken = new RegExp(`[A-Za-z0-9+/=_\\-.]{${BLOB_MIN_LENGTH},}`, "g");

function pushProse(out: StatementSegment[], text: string) {
  if (text) out.push({ type: "prose", text });
}

function splitBlobs(text: string): StatementSegment[] {
  const out: StatementSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(blobToken)) {
    const token = match[0];
    const start = match.index ?? 0;
    const precedingContext = text.slice(Math.max(0, start - 8), start);
    if (token.includes("://") || /https?:$/i.test(precedingContext)) continue;
    pushProse(out, text.slice(cursor, start));
    out.push({ type: "blob", text: token });
    cursor = start + token.length;
  }
  pushProse(out, text.slice(cursor));
  return out;
}

function containerEnd(text: string, start: number): number {
  const stack = [text[start] === "{" ? "}" : "]"];
  let quote = false;
  let escaped = false;
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quote = false;
      continue;
    }
    if (c === '`') {
      const close = text.indexOf("`", i + 1);
      if (close < 0) return -1;
      i = close;
    } else if (c === '"') quote = true;
    else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") {
      if (stack.at(-1) !== c) return -1;
      stack.pop();
      if (!stack.length) return i + 1;
    }
  }
  return -1;
}

function extractJson(text: string): StatementSegment[] {
  const out: StatementSegment[] = [];
  let cursor = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '`') { const end = text.indexOf('`', i + 1); if (end >= 0) i = end; continue; }
    if ((text[i] !== "{" && text[i] !== "[") || text[i - 1] === "$" || i < cursor) continue;
    const end = containerEnd(text, i);
    if (end < 0) continue;
    const raw = text.slice(i, end);
    const normalized = raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\u00a0/g, " ");
    let parsed: string | null = null;
    try { parsed = JSON.stringify(JSON.parse(normalized), null, 2); } catch { /* malformed short containers remain prose */ }
    if (parsed === null && !(raw.length >= 40 && /"\s*[^"\n]+"\s*:/u.test(normalized))) continue;
    pushProse(out, text.slice(cursor, i));
    out.push({ type: "code", language: "json", text: parsed ?? normalized });
    cursor = end;
    i = end - 1;
  }
  pushProse(out, text.slice(cursor));
  return out;
}

function classifyRemaining(segment: StatementSegment): StatementSegment[] {
  if (segment.type !== "prose") return [segment];
  const text = segment.text;
  const error = /(?:A client error \([^)]+\) occurred|An error occurred \([^)]+\)|Mensagem de falha(?: de autorização)? codificada:)/i.exec(text);
  if (error) {
    const before = text.slice(0, error.index);
    const remainder = text.slice(error.index);
    const beforeSegments = before ? classifyRemaining({ type: "prose", text: before }) : [];
    const payload = /\b[A-Za-z0-9+/=_\-.]{64,}/.exec(remainder);
    if (payload && remainder.slice(payload.index + payload[0].length).length > 0) {
      const start = payload.index;
      const end = start + payload[0].length;
      return [...beforeSegments, ...splitBlobs(remainder.slice(0, start)), { type: "blob", text: payload[0] }, ...splitBlobs(remainder.slice(end))];
    }
    return [...beforeSegments, { type: "code", language: "text", text: remainder.trim() }];
  }
  const lines = text.split("\n");
  const out: StatementSegment[] = [];
  let prose = "";
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (/^\s*(?:\$\s|aws\s|curl\s)/.test(line)) {
      pushProse(out, prose); prose = ""; out.push({ type: "code", language: "text", text: line.trim() }); i++; continue;
    }
    const yaml = (v: string) => /^\s*[\w-]+:(?:\s|$)|^\s*-\s/.test(v);
    if (yaml(line)) {
      const start = i; while (i < lines.length && yaml(lines[i])) i++;
      if (i - start >= 3) { pushProse(out, prose); prose = ""; out.push({ type: "code", language: "text", text: lines.slice(start, i).join("\n") }); }
      else prose += lines.slice(start, i).join("\n") + (i < lines.length ? "\n" : "");
      continue;
    }
    prose += line + (i < lines.length - 1 ? "\n" : ""); i++;
  }
  pushProse(out, prose);
  return out.flatMap((item) => item.type === "prose" ? splitBlobs(item.text) : [item]);
}

export function segmentRichText(text: string): StatementSegment[] {
  return extractJson(text).flatMap(classifyRemaining);
}

export const formatStatement = segmentRichText;
