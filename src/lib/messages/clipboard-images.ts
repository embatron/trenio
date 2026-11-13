import {
  MESSAGE_ATTACHMENT_MAX_BYTES,
  clientAttachmentIssue,
  decodeAttachmentDataUrl,
} from "@/lib/messages/attachments";

type ClipboardItemLike = {
  kind: string;
  type: string;
  getAsFile: () => File | null;
};

type ClipboardDataLike = {
  files?: ArrayLike<File>;
  items?: ArrayLike<ClipboardItemLike>;
};

const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function namedAttachment(file: File) {
  if (file.name.trim()) return file;
  const ext = IMAGE_EXT[file.type] ?? "png";
  return new File([file], `screenshot.${ext}`, { type: file.type || "image/png" });
}

function remember(found: File[], seen: Set<string>, file: File | null) {
  if (!file || file.size <= 0) return;
  const key = `${file.name}:${file.type}:${file.size}`;
  if (seen.has(key)) return;
  seen.add(key);
  found.push(file);
}

/** Files from a paste. Screenshots often sit in `items` while `files` stays empty. */
export function clipboardFiles(data: ClipboardDataLike | null): File[] {
  if (!data) return [];
  const found: File[] = [];
  const seen = new Set<string>();
  if (data.files) {
    for (let index = 0; index < data.files.length; index += 1) remember(found, seen, data.files[index] ?? null);
  }
  if (data.items) {
    for (let index = 0; index < data.items.length; index += 1) {
      const item = data.items[index];
      if (!item) continue;
      if (item.kind !== "file" && !item.type.startsWith("image/")) continue;
      remember(found, seen, item.getAsFile());
    }
  }
  return found;
}

export function fileFromDataUrl(dataUrl: string) {
  const decoded = decodeAttachmentDataUrl(dataUrl);
  if (!decoded?.mime.startsWith("image/")) return null;
  const ext = IMAGE_EXT[decoded.mime] ?? "png";
  const bytes = new Uint8Array(decoded.bytes);
  return new File([bytes], `screenshot.${ext}`, { type: decoded.mime });
}

/** A copied picture sometimes arrives only as an `<img src="data:image/...">`. */
export function filesFromHtmlImages(html: string) {
  const files: File[] = [];
  const pattern = /src\s*=\s*["'](data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const file = fileFromDataUrl(match[1] ?? "");
    if (file) files.push(file);
  }
  return files;
}

export function clipboardSuggestsImage(types: readonly string[]) {
  return types.some((type) => type === "Files" || type.startsWith("image/"));
}

async function blobFromCanvas(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

/** A screenshot larger than 5 MB, or a picture the chat cannot store as-is, becomes a JPEG that fits. */
export async function preparePastedFile(file: File): Promise<File> {
  const named = namedAttachment(file);
  if (clientAttachmentIssue(named, 0) == null) return named;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return named;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(named);
  } catch {
    return named;
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return named;
  }
  let width = bitmap.width;
  let height = bitmap.height;
  const edge = Math.max(width, height);
  if (edge > 2560) {
    const scale = 2560 / edge;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
  let quality = 0.86;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    canvas.width = width;
    canvas.height = height;
    context.drawImage(bitmap, 0, 0, width, height);
    blob = await blobFromCanvas(canvas, "image/jpeg", quality);
    if (blob && blob.size > 0 && blob.size <= MESSAGE_ATTACHMENT_MAX_BYTES) break;
    quality = Math.max(0.4, quality - 0.12);
    width = Math.max(1, Math.round(width * 0.8));
    height = Math.max(1, Math.round(height * 0.8));
  }
  bitmap.close();
  if (!blob || blob.size <= 0 || blob.size > MESSAGE_ATTACHMENT_MAX_BYTES) return named;
  return new File([blob], "screenshot.jpg", { type: "image/jpeg" });
}
