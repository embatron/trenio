export const MAX_TRAINER_CERTIFICATES = 5;
export const CERTIFICATE_CAPTION_MAX = 80;

export type TrainerCertificate = {
  path: string;
  caption: string;
};

export function certificateCaption(fileName: string) {
  const base = fileName.split(/[/\\]/).pop() ?? "";
  const stem = base.replace(/\.[a-z0-9]{1,8}$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return stem.slice(0, CERTIFICATE_CAPTION_MAX) || "Документ";
}

export function readCertificates(value: unknown): TrainerCertificate[] {
  if (!Array.isArray(value)) return [];
  const items: TrainerCertificate[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      const stored = item.split("?")[0];
      items.push({ path: stored, caption: certificateCaption(stored) });
      continue;
    }
    if (!item || typeof item !== "object" || !("path" in item)) continue;
    const stored = String((item as { path: unknown }).path ?? "").split("?")[0].trim();
    if (!stored.startsWith("/")) continue;
    const raw = "caption" in item ? String((item as { caption: unknown }).caption ?? "") : "";
    const caption = raw.trim().slice(0, CERTIFICATE_CAPTION_MAX) || certificateCaption(stored);
    items.push({ path: stored, caption });
  }
  return items.slice(0, MAX_TRAINER_CERTIFICATES);
}
