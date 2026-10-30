import { reviewPlainText } from "@/lib/catalog/review-html";

/** One file in a message. Nine files, each at most 2 MiB. */
export const MESSAGE_ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;
export const MESSAGE_ATTACHMENT_MAX_COUNT = 9;

export const ATTACHMENT_TOO_BIG = "Файл больше 2 МБ.";
export const ATTACHMENT_BAD_TYPE = "Можно прикрепить фото (JPG, PNG, WEBP, GIF), PDF, DOC, DOCX, XLS или XLSX.";
export const ATTACHMENT_TOO_MANY = "Можно прикрепить не больше 9 файлов.";
export const ATTACHMENT_EMPTY = "Файл пустой.";
export const ATTACHMENT_UNREADABLE = "Файл не прочитан.";

const TYPES = [
  { ext: "jpg", mime: "image/jpeg", kind: "image" },
  { ext: "png", mime: "image/png", kind: "image" },
  { ext: "webp", mime: "image/webp", kind: "image" },
  { ext: "gif", mime: "image/gif", kind: "image" },
  { ext: "pdf", mime: "application/pdf", kind: "file" },
  { ext: "doc", mime: "application/msword", kind: "file" },
  { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "file" },
  { ext: "xls", mime: "application/vnd.ms-excel", kind: "file" },
  { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "file" },
] as const;

export type AttachmentKind = "image" | "file";
export type AttachmentExt = (typeof TYPES)[number]["ext"];

const BY_EXT = new Map(TYPES.map((item) => [item.ext, item]));
const BY_MIME = new Map(TYPES.map((item) => [item.mime, item]));

export function attachmentLabel(fileName: string) {
  const base = (fileName.split(/[/\\]/).pop() ?? "").replace(/[\u0000-\u001f]/g, "").trim();
  return base.slice(0, 180) || "file";
}

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(attachmentLabel(fileName));
  const ext = match?.[1]?.toLowerCase() ?? "";
  return ext === "jpeg" ? "jpg" : ext;
}

function normalizeMime(mime: string) {
  const value = mime.trim().toLowerCase();
  return value === "image/jpg" ? "image/jpeg" : value;
}

/** `crypto.randomUUID` is missing on plain http, including trenio.local. */
export function newMessageClientId() {
  const source = globalThis.crypto;
  if (typeof source?.randomUUID === "function") return source.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof source?.getRandomValues === "function") source.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The visible editor wins when it already has text. React state can lag behind Ctrl+Enter or ⌘+Enter. */
export function composerBody(liveHtml: string | undefined, stateHtml: string) {
  if (liveHtml != null && reviewPlainText(liveHtml).length > 0) return liveHtml;
  return stateHtml;
}

export function clientAttachmentIssue(
  file: { name: string; type: string; size: number },
  already: number,
): string | null {
  if (already >= MESSAGE_ATTACHMENT_MAX_COUNT) return ATTACHMENT_TOO_MANY;
  if (file.size <= 0) return ATTACHMENT_EMPTY;
  if (file.size > MESSAGE_ATTACHMENT_MAX_BYTES) return ATTACHMENT_TOO_BIG;
  const ext = extensionOf(file.name);
  const mime = normalizeMime(file.type);
  const knownExt = BY_EXT.has(ext as AttachmentExt);
  const knownMime = BY_MIME.has(mime as (typeof TYPES)[number]["mime"]);
  if (!knownExt && !knownMime) return ATTACHMENT_BAD_TYPE;
  if (knownExt && knownMime && BY_EXT.get(ext as AttachmentExt)?.mime !== mime && mime !== "application/octet-stream") {
    return ATTACHMENT_BAD_TYPE;
  }
  return null;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function asciiIncludes(bytes: Uint8Array, needle: string) {
  const text = new TextDecoder("latin1").decode(bytes);
  return text.includes(needle);
}

type Detected = "jpg" | "png" | "webp" | "gif" | "pdf" | "ole" | "zip";

function detect(bytes: Uint8Array): Detected | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return "gif";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes.length >= 12
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) return "webp";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  return null;
}

export type SniffedAttachment = {
  ext: AttachmentExt;
  mime: string;
  kind: AttachmentKind;
  name: string;
};

/** Bytes decide the type. The name and the declared mime only have to agree. */
export function sniffAttachment(bytes: Uint8Array, fileName: string, declaredMime: string): { ok: true; file: SniffedAttachment } | { ok: false; message: string } {
  if (bytes.length === 0) return { ok: false, message: ATTACHMENT_EMPTY };
  if (bytes.length > MESSAGE_ATTACHMENT_MAX_BYTES) return { ok: false, message: ATTACHMENT_TOO_BIG };
  const found = detect(bytes);
  const ext = extensionOf(fileName);
  const mime = normalizeMime(declaredMime);
  let resolved: AttachmentExt | null = null;
  if (found === "jpg" || found === "png" || found === "webp" || found === "gif" || found === "pdf") resolved = found;
  if (found === "ole") resolved = ext === "xls" || mime === BY_EXT.get("xls")?.mime ? "xls" : ext === "doc" || mime === BY_EXT.get("doc")?.mime ? "doc" : null;
  if (found === "zip") {
    if ((ext === "docx" || mime === BY_EXT.get("docx")?.mime) && asciiIncludes(bytes, "word/")) resolved = "docx";
    else if ((ext === "xlsx" || mime === BY_EXT.get("xlsx")?.mime) && asciiIncludes(bytes, "xl/")) resolved = "xlsx";
  }
  if (!resolved) return { ok: false, message: ATTACHMENT_BAD_TYPE };
  const spec = BY_EXT.get(resolved);
  if (!spec) return { ok: false, message: ATTACHMENT_BAD_TYPE };
  if (ext && ext !== resolved) return { ok: false, message: ATTACHMENT_BAD_TYPE };
  if (mime && mime !== "application/octet-stream" && mime !== spec.mime) return { ok: false, message: ATTACHMENT_BAD_TYPE };
  return { ok: true, file: { ext: resolved, mime: spec.mime, kind: spec.kind, name: attachmentLabel(fileName) } };
}

export function decodeAttachmentDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    const bytes = bytesFromBase64(match[2]);
    return { mime: normalizeMime(match[1]), bytes };
  } catch {
    return null;
  }
}

function bytesFromBase64(value: string) {
  const clean = value.replace(/\s/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let index = 0; index < bin.length; index += 1) out[index] = bin.charCodeAt(index);
  return out;
}
